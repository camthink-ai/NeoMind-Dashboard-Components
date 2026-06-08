var NeoMind_MetricCard = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  /* ------------------------------------------------------------------ */
  /*  Glass container style (same pattern as data_list)                   */
  /* ------------------------------------------------------------------ */
  var glassContainer = {
    background: 'linear-gradient(135deg, oklch(1 0 0 / 6%) 0%, oklch(1 0 0 / 2%) 100%)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 1px 3px oklch(0 0 0 / 12%), inset 0 1px 0 oklch(1 0 0 / 6%)'
  };

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
  /*  Helper: determine layout type based on metric count & aspect ratio */
  /* ------------------------------------------------------------------ */
  function getLayout(count, aspectRatio) {
    if (count <= 1) return { type: 'single', cols: 1 };
    if (aspectRatio >= 1.2) return { type: 'columns', cols: count };
    var cols;
    if (count <= 6) cols = 2;
    else cols = 4;
    return { type: 'grid', cols: cols };
  }

  /* ------------------------------------------------------------------ */
  /*  Helper: value text size class based on metric count                */
  /* ------------------------------------------------------------------ */
  function getValueClass(count) {
    if (count <= 1) return 'text-4xl';
    if (count === 2) return 'text-3xl';
    if (count === 3) return 'text-2xl';
    if (count <= 6) return 'text-xl';
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
          return (r && r.value != null) ? r.value : null;
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
      var formattedVal = null;
      if (rawVal != null) {
        formattedVal = typeof rawVal === 'number' ? rawVal.toFixed(dp) : rawVal;
      }
      slots.push({
        label: cfg.label || ('Value ' + (i + 1)),
        unit: cfg.unit || '',
        value: formattedVal
      });
    }

    var aspectRatio = containerSize.w && containerSize.h ? containerSize.w / containerSize.h : 2;
    var layout = getLayout(count, aspectRatio);
    var valueClass = getValueClass(count);

    /* ---- render helper ---- */
    function renderCell(idx) {
      var slot = slots[idx];
      var isFirstInRow = (idx % layout.cols === 0);
      var totalRows = Math.ceil(count / layout.cols);
      var currentRow = Math.floor(idx / layout.cols);
      var isLastRow = (currentRow === totalRows - 1);
      var displayValue = slot.value != null ? String(slot.value) : '';
      var valueColor = slot.value != null ? 'var(--foreground)' : 'var(--muted-foreground)';

      return jsxs('div', {
        className: 'flex flex-col items-center justify-center p-2 text-center' +
          (isFirstInRow ? '' : ' border-l border-glass-border') +
          (isLastRow ? '' : ' border-b border-glass-border'),
        children: [
          jsx('div', { className: 'text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1', children: slot.label }),
          jsxs('div', { className: 'flex items-baseline gap-1', children: [
            jsx('span', { className: 'font-bold font-mono tabular-nums ' + valueClass, style: { color: valueColor }, children: displayValue }),
            slot.unit ? jsx('span', { className: 'text-xs text-muted-foreground', children: slot.unit }) : null
          ]})
        ]
      }, 'metric-' + idx);
    }

    /* ---- inner content ---- */
    var innerContent;
    if (layout.type === 'single') {
      innerContent = jsx('div', { className: 'flex items-center justify-center h-full', children: renderCell(0) });
    } else {
      var gridChildren = [];
      for (var j = 0; j < count; j++) {
        gridChildren.push(renderCell(j));
      }
      innerContent = jsx('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(' + layout.cols + ', 1fr)' },
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
