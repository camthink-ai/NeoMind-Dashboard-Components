var NeoMind_MetricCard = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  /* ------------------------------------------------------------------ */
  /*  Glass container style (same pattern as data_list)                   */
  /* ------------------------------------------------------------------ */
  var glassContainer = {
    background: 'linear-gradient(135deg, oklch(1 0 0 / 6%) 0%, oklch(0.75 0.06 270 / 5%) 40%, oklch(1 0 0 / 3%) 60%, oklch(0.75 0.06 200 / 4%) 100%)',
    backgroundSize: '300% 300%',
    animation: 'mc-shimmer 12s ease infinite',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 1px 3px oklch(0 0 0 / 12%), inset 0 1px 0 oklch(1 0 0 / 6%)'
  };

  /* ---- inject keyframes ---- */
  if (!document.getElementById('mc-styles')) {
    var mcStyle = document.createElement('style');
    mcStyle.id = 'mc-styles';
    mcStyle.textContent = [
      '@keyframes mc-shimmer {',
      '  0%, 100% { background-position: 0% 50%; }',
      '  50% { background-position: 100% 50%; }',
      '}',
      '@keyframes mc-pulse {',
      '  0%, 100% { opacity: 0.3; transform: scale(1); }',
      '  50% { opacity: 1; transform: scale(1.3); }',
      '}'
    ].join('\n');
    document.head.appendChild(mcStyle);
  }

  /* ------------------------------------------------------------------ */
  /*  Helper: extract numeric value from various result formats           */
  /* ------------------------------------------------------------------ */
  function extractValue(result) {
    if (result == null) return null;
    if (typeof result === 'number') return result;
    if (typeof result === 'string') return result;
    if (typeof result === 'boolean') return result ? 'Yes' : 'No';
    if (result.value != null) {
      if (typeof result.value === 'number') return result.value;
      if (typeof result.value === 'string') return result.value;
      if (typeof result.value === 'boolean') return result.value ? 'Yes' : 'No';
    }
    if (result.series != null && Array.isArray(result.series) && result.series.length) {
      var last = result.series[result.series.length - 1];
      if (typeof last === 'number') return last;
      if (typeof last === 'string') return last;
      if (last && last.value != null) {
        if (typeof last.value === 'number') return last.value;
        if (typeof last.value === 'string') return last.value;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Helper: derive label from dataSource config (mirrors data_list)    */
  /* ------------------------------------------------------------------ */
  function keyToLabel(key) {
    var last = key.split('.').pop() || key;
    return last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
      .replace(/^\w/, function (c) { return c.toUpperCase(); });
  }

  function getDsLabel(ds) {
    if (!ds) return '';
    if (ds.field) return keyToLabel(ds.field);
    if (ds.infoProperty) return keyToLabel(ds.infoProperty);
    if (ds.systemMetric) return keyToLabel(ds.systemMetric);
    if (ds.extensionMetric) return ds.extensionMetric;
    return '';
  }

  /* ------------------------------------------------------------------ */
  /*  Helper: stable dataSource key for change detection                 */
  /* ------------------------------------------------------------------ */
  function getStableDsKey(ds) {
    if (!ds) return '';
    if (Array.isArray(ds)) {
      return ds.map(function (d) {
        return [d.source || '', d.mode || d.type || '', d.id || d.sourceId || '', d.field || ''].join('|');
      }).join('||');
    }
    return [ds.source || '', ds.mode || ds.type || '', ds.id || ds.sourceId || '', ds.field || ''].join('|');
  }

  /* ------------------------------------------------------------------ */
  /*  Helper: find columns so grid aspect ≈ container aspect → even cells */
  /* ------------------------------------------------------------------ */
  function getLayout(count, containerW, containerH) {
    if (count <= 1) return { cols: 1 };
    if (containerW <= 0 || containerH <= 0) return { cols: count };
    var aspect = containerW / containerH;
    var minRows = count >= 3 ? 2 : 1;
    var bestCols = count;
    var bestDiff = Infinity;
    for (var c = 1; c <= count; c++) {
      var r = Math.ceil(count / c);
      if (r < minRows) continue;
      var gridAspect = c / r;
      var diff = Math.abs(gridAspect - aspect);
      if (diff < bestDiff || (diff === bestDiff && c > bestCols)) {
        bestDiff = diff;
        bestCols = c;
      }
    }
    return { cols: bestCols };
  }

  /* ------------------------------------------------------------------ */
  /*  Helper: value text size based on columns (wider cells = bigger)    */
  /* ------------------------------------------------------------------ */
  function getValueClass(cols) {
    if (cols <= 1) return 'text-4xl';
    if (cols === 2) return 'text-2xl';
    if (cols === 3) return 'text-xl';
    if (cols <= 5) return 'text-lg';
    return 'text-base';
  }

  /* ------------------------------------------------------------------ */
  /*  MetricCard — main component                                        */
  /* ------------------------------------------------------------------ */
  function MetricCard(props) {
    var config = props.config || {};
    var fetchData = props.fetchData;
    var dataSource = props.dataSource;

    /* ---- state ---- */
    var dataSt = React.useState([]);
    var values = dataSt[0], setValues = dataSt[1];
    var loadSt = React.useState(true);
    var loading = loadSt[0], setLoading = loadSt[1];
    var errSt = React.useState(null);
    var error = errSt[0], setError = errSt[1];

    var fetchDataRef = React.useRef(fetchData);
    fetchDataRef.current = fetchData;
    var configRef = React.useRef(config);
    configRef.current = config;
    var fetchIdRef = React.useRef(0);
    var lastDsKeyRef = React.useRef(null);

    /* container measurement */
    var containerRef = React.useRef(null);
    var sizeSt = React.useState({ w: 0, h: 0 });
    var containerSize = sizeSt[0], setContainerSize = sizeSt[1];

    /* ---- doFetch ---- */
    function doFetch() {
      var fn = fetchDataRef.current;
      var fid = ++fetchIdRef.current;
      if (!fn) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      fn({ timeRange: 24 }).then(function (result) {
        if (fid !== fetchIdRef.current) return;
        var results = Array.isArray(result) ? result : (result ? [result] : []);
        var vals = results.map(function (r) {
          return extractValue(r);
        });
        setValues(vals);
      }).catch(function () {
        if (fid !== fetchIdRef.current) return;
        setError('fetch');
      }).finally(function () {
        if (fid !== fetchIdRef.current) return;
        setLoading(false);
      });
    }

    /* ---- effects ---- */

    React.useEffect(function () {
      var triggerKey = getStableDsKey(dataSource);
      if (triggerKey === lastDsKeyRef.current) return;
      lastDsKeyRef.current = triggerKey;
      setValues([]);
      doFetch();
    }, [dataSource]);

    React.useEffect(function () {
      var dsKey = getStableDsKey(dataSource);
      if (!dsKey) return;
      var iv = setInterval(function () {
        lastDsKeyRef.current = null;
        doFetch();
      }, 30000);
      return function () { clearInterval(iv); };
    }, [dataSource]);

    React.useEffect(function () {
      var el = containerRef.current;
      if (!el) return;
      var ro = new ResizeObserver(function (entries) {
        var rect = entries[0].contentRect;
        setContainerSize({ w: rect.width, h: rect.height });
      });
      ro.observe(el);
      return function () { ro.disconnect(); };
    }, []);

    /* ---- Loading ---- */
    if (loading) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex items-center justify-center h-full w-full',
        style: glassContainer,
        children: jsx('div', { className: 'flex gap-1.5', children:
          [0, 1, 2].map(function (i) {
            return jsx('div', { style: { width: 5, height: 5, borderRadius: '50%', background: 'var(--muted-foreground)', opacity: 0.3, animation: 'mc-pulse 1s infinite ' + (i * 0.2) + 's' } }, i);
          })
        })
      });
    }

    /* ---- No data source ---- */
    if (!fetchData) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full text-muted-foreground',
        style: glassContainer,
        children: jsx('span', { className: 'text-xs', children: 'Bind a data source' })
      });
    }

    /* ---- Error ---- */
    if (error) {
      return jsxs('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full text-muted-foreground gap-2',
        style: glassContainer,
        children: [
          jsx('span', { key: 'm', className: 'text-xs', children: 'Failed to load data' }),
          jsx('button', { key: 'r', className: 'text-xs px-3 py-1.5 rounded-lg transition-all duration-200', style: { background: 'oklch(1 0 0 / 8%)', border: '1px solid var(--border)', backdropFilter: 'blur(4px)' }, onClick: doFetch, children: 'Retry' })
        ]
      });
    }

    /* ---- build metric slots ---- */
    var metrics = config.metrics || [];
    var dsList = Array.isArray(dataSource) ? dataSource : (dataSource ? [dataSource] : []);
    var count = dsList.length || metrics.length;

    if (count === 0) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full text-muted-foreground',
        style: glassContainer,
        children: jsx('span', { className: 'text-xs', children: 'Bind a data source' })
      });
    }

    var slots = [];
    for (var i = 0; i < count; i++) {
      var cfg = metrics[i] || {};
      var dp = cfg.decimalPlaces != null ? cfg.decimalPlaces : 1;
      var rawVal = values[i];
      if (rawVal == null) continue;
      var formattedVal = typeof rawVal === 'number' ? rawVal.toFixed(dp) : String(rawVal);
      slots.push({
        label: cfg.label || getDsLabel(dsList[i]) || ('Value ' + (i + 1)),
        unit: cfg.unit || '',
        value: formattedVal
      });
    }

    if (slots.length === 0) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full text-muted-foreground',
        style: glassContainer,
        children: jsx('span', { className: 'text-xs', children: 'No data' })
      });
    }

    var slotCount = slots.length;
    var layout = getLayout(slotCount, containerSize.w, containerSize.h);
    var valueClass = getValueClass(layout.cols);

    /* ---- render helper ---- */
    function renderCell(idx) {
      var slot = slots[idx];
      var displayValue = String(slot.value);

      return jsxs('div', {
        className: 'flex flex-col items-center justify-center min-w-0',
        style: {
          padding: slotCount === 1 ? '16px' : '10px 6px',
          background: 'oklch(1 0 0 / 3%)',
          borderRadius: '8px'
        },
        children: [
          jsx('div', {
            className: 'text-[10px] uppercase tracking-wider font-semibold truncate max-w-full',
            style: { color: 'var(--muted-foreground)', marginBottom: '6px' },
            children: slot.label
          }),
          jsxs('div', {
            className: 'flex items-baseline gap-1 justify-center min-w-0 max-w-full',
            children: [
              jsx('span', {
                className: 'font-bold font-mono tabular-nums truncate ' + valueClass,
                style: { color: 'var(--foreground)', letterSpacing: '-0.02em' },
                children: displayValue
              }),
              slot.unit ? jsx('span', {
                className: 'text-[10px] font-medium flex-shrink-0',
                style: { color: 'var(--muted-foreground)' },
                children: slot.unit
              }) : null
            ]
          })
        ]
      }, 'metric-' + idx);
    }

    /* ---- inner content ---- */
    var innerContent;
    if (slotCount === 1) {
      innerContent = jsx('div', { className: 'flex items-center justify-center h-full p-1', children: renderCell(0) });
    } else {
      var gridChildren = [];
      for (var j = 0; j < slotCount; j++) {
        gridChildren.push(renderCell(j));
      }
      innerContent = jsx('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(' + layout.cols + ', 1fr)', gap: '4px', padding: '4px' },
        className: 'h-full',
        children: gridChildren
      });
    }

    /* ---- final render ---- */
    return jsxs('div', {
      ref: containerRef,
      className: 'flex flex-col h-full w-full overflow-hidden',
      style: glassContainer,
      children: [
        jsx('div', { className: 'flex-1', children: innerContent })
      ]
    });
  }

  return { default: MetricCard, MetricCard: MetricCard };
})();
