var NeoMind_MetricCard = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  /* ------------------------------------------------------------------ */
  /*  EmptyState — shown when no data source is bound                    */
  /* ------------------------------------------------------------------ */
  function EmptyState() {
    return jsxs('div', {
      className: 'flex flex-col items-center justify-center h-full w-full text-muted-foreground',
      children: [
        jsxs('svg', {
          width: '36',
          height: '36',
          viewBox: '0 0 36 36',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: '1.5',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          children: [
            jsx('rect', { x: '4', y: '6', width: '28', height: '24', rx: '4' }),
            jsx('line', { x1: '10', y1: '14', x2: '20', y2: '14' }),
            jsx('line', { x1: '10', y1: '20', x2: '26', y2: '20' })
          ]
        }),
        jsx('span', { className: 'text-xs mt-2', children: 'Bind a data source' })
      ]
    });
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
  /*  MetricCell — renders a single metric slot                          */
  /* ------------------------------------------------------------------ */
  function MetricCell(props) {
    var label = props.label;
    var value = props.value;
    var unit = props.unit;
    var valueClass = props.valueClass;
    var showBorderLeft = props.showBorderLeft;
    var showBorderBottom = props.showBorderBottom;
    var loading = props.loading;

    var displayValue = loading ? '--' : (value != null ? String(value) : '--');
    var valueColor = (loading || value == null) ? 'text-muted-foreground' : 'text-foreground';

    var children = [
      jsx('div', {
        key: 'label',
        className: 'text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1',
        children: label
      }),
      jsxs('div', {
        key: 'value',
        className: 'flex items-baseline gap-1',
        children: [
          jsx('span', {
            className: 'font-bold font-mono tabular-nums ' + valueClass + ' ' + valueColor,
            children: displayValue
          }),
          unit ? jsx('span', { key: 'unit', className: 'text-xs text-muted-foreground', children: unit }) : null
        ]
      })
    ];

    return jsxs('div', {
      className: 'p-2' +
        (showBorderLeft ? ' border-l border-glass-border' : '') +
        (showBorderBottom ? ' border-b border-glass-border' : ''),
      children: children
    });
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
    var hasDataRef = React.useRef(false);

    var fetchDataRef = React.useRef(fetchData);
    fetchDataRef.current = fetchData;
    var configRef = React.useRef(config);
    configRef.current = config;
    var fetchIdRef = React.useRef(0);
    var lastDsKeyRef = React.useRef(null);

    /* container measurement */
    var sizeSt = React.useState({ w: 0, h: 0 });
    var containerSize = sizeSt[0], setContainerSize = sizeSt[1];
    var containerRef = React.useRef(null);

    /* ---- dataSource key (computed at top level, like data_list) ---- */
    var dsKey = getStableDsKey(dataSource);
    var isMulti = Array.isArray(dataSource);

    /* ---- doFetch ---- */
    function doFetch() {
      var fn = fetchDataRef.current;
      var fid = ++fetchIdRef.current;
      if (!fn) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      fn().then(function (result) {
        if (fid !== fetchIdRef.current) return;
        var results;
        if (isMulti && Array.isArray(result)) {
          results = result;
        } else if (result) {
          results = [result];
        } else {
          results = [];
        }
        var vals = results.map(function (r) {
          return (r && r.value != null) ? r.value : null;
        });
        setValues(vals);
        hasDataRef.current = true;
      }).catch(function () {
        if (fid !== fetchIdRef.current) return;
        setError('fetch');
      }).finally(function () {
        if (fid !== fetchIdRef.current) return;
        setLoading(false);
      });
    }

    /* ---- effects ---- */

    // Fetch on mount / dataSource change (dsKey as dependency, like data_list)
    React.useEffect(function () {
      if (!dsKey) return;
      if (dsKey === lastDsKeyRef.current) return;
      lastDsKeyRef.current = dsKey;
      setValues([]);
      hasDataRef.current = false;
      doFetch();
    }, [dsKey]);

    // Auto-refresh every 30 s (dsKey as dependency, like data_list)
    React.useEffect(function () {
      if (!dsKey) return;
      var iv = setInterval(function () {
        lastDsKeyRef.current = null;
        doFetch();
      }, 30000);
      return function () { clearInterval(iv); };
    }, [dsKey]);

    // ResizeObserver for container measurements
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

    /* ---- empty-state guard (after all hooks) ---- */
    if (!fetchData) {
      return jsx('div', {
        className: 'flex flex-col h-full w-full p-3',
        children: jsx('div', {
          className: 'bg-card border border-glass-border rounded-xl flex-1',
          style: { backdropFilter: 'blur(20px)', boxShadow: '0 4px 30px oklch(0.18 0.02 270 / 10%)' },
          children: jsx(EmptyState, {})
        })
      });
    }

    /* ---- build metric slots ---- */
    var metrics = config.metrics || [];
    var dsList = Array.isArray(dataSource) ? dataSource : (dataSource ? [dataSource] : []);
    var count = dsList.length || metrics.length;

    if (count === 0) {
      return jsx('div', {
        className: 'flex flex-col h-full w-full p-3',
        children: jsx('div', {
          className: 'bg-card border border-glass-border rounded-xl flex-1',
          style: { backdropFilter: 'blur(20px)', boxShadow: '0 4px 30px oklch(0.18 0.02 270 / 10%)' },
          children: jsx(EmptyState, {})
        })
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
      return jsx(MetricCell, {
        key: 'metric-' + idx,
        label: slot.label,
        value: slot.value,
        unit: slot.unit,
        valueClass: valueClass,
        showBorderLeft: !isFirstInRow,
        showBorderBottom: !isLastRow,
        loading: loading && !hasDataRef.current
      });
    }

    /* ---- build grid children ---- */
    var gridChildren = [];
    for (var j = 0; j < count; j++) {
      gridChildren.push(renderCell(j));
    }

    /* ---- inner content ---- */
    var innerContent;
    if (layout.type === 'single') {
      innerContent = jsx('div', { className: 'flex items-center justify-center h-full', children: renderCell(0) });
    } else {
      innerContent = jsx('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(' + layout.cols + ', 1fr)' },
        className: 'h-full',
        children: gridChildren
      });
    }

    /* ---- wrap with error retry bar ---- */
    var cardChildren = [
      jsx('div', { key: 'grid', className: 'flex-1', children: innerContent })
    ];
    if (error) {
      cardChildren.push(jsx('div', {
        key: 'retry',
        className: 'text-xs text-muted-foreground text-center py-1 cursor-pointer',
        onClick: function () { lastDsKeyRef.current = null; doFetch(); },
        children: 'Retry'
      }));
    }

    /* ---- final render ---- */
    return jsx('div', {
      ref: containerRef,
      className: 'flex flex-col h-full w-full p-3',
      children: jsxs('div', {
        className: 'bg-card border border-glass-border rounded-xl flex-1 flex flex-col overflow-hidden',
        style: { backdropFilter: 'blur(20px)', boxShadow: '0 4px 30px oklch(0.18 0.02 270 / 10%)' },
        children: cardChildren
      })
    });
  }

  return { default: MetricCard, MetricCard: MetricCard };
})();
