var NeoMind_DataList = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  // ── Data helpers ──

  function resolveByPath(obj, path) {
    if (!path) return obj;
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function extractArray(result, dataPath) {
    if (!result) return null;
    if (dataPath) {
      var resolved = resolveByPath(result, dataPath);
      if (Array.isArray(resolved)) return resolved;
      return null;
    }
    if (result.value != null && Array.isArray(result.value)) return result.value;
    if (result.value != null && typeof result.value === 'object' && !Array.isArray(result.value)) {
      var keys = Object.keys(result.value);
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(result.value[keys[i]])) return result.value[keys[i]];
      }
    }
    if (Array.isArray(result.series)) {
      return result.series.map(function (item) {
        return { timestamp: item.timestamp, value: item.value };
      });
    }
    return null;
  }

  function keyToLabel(key) {
    var s = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function inferColumnType(values) {
    var sample = values.slice(0, 50);
    var numCount = 0, boolCount = 0, tsCount = 0, strValues = [];
    for (var i = 0; i < sample.length; i++) {
      var v = sample[i];
      if (v == null) continue;
      if (typeof v === 'boolean') { boolCount++; continue; }
      if (typeof v === 'number') {
        if (v > 1e12) tsCount++;
        else numCount++;
        continue;
      }
      if (typeof v === 'string') strValues.push(v);
    }
    var total = numCount + boolCount + tsCount + strValues.length;
    if (total === 0) return 'text';
    if (boolCount / total > 0.7) return 'status';
    if (tsCount / total > 0.7) return 'time';
    if (numCount / total > 0.7) return 'number';
    if (strValues.length / total > 0.5) {
      var distinct = {};
      for (var j = 0; j < strValues.length; j++) distinct[strValues[j]] = true;
      if (Object.keys(distinct).length < 8) return 'tag';
    }
    return 'text';
  }

  function inferColumns(data) {
    if (!data || data.length === 0) return [];
    var first = data[0];
    var keys = Object.keys(first);
    var columns = [];
    var firstTextIdx = -1;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var values = data.map(function (item) { return item[key]; });
      var type = inferColumnType(values);
      var flex = 1;
      if (firstTextIdx === -1 && (type === 'text' || type === 'tag')) {
        flex = 2;
        firstTextIdx = i;
      }
      columns.push({ key: key, label: keyToLabel(key), type: type, flex: flex, visible: true, order: i });
    }
    return columns;
  }

  function mergeColumns(inferred, configured) {
    if (!configured || configured.length === 0) return inferred;
    var configMap = {};
    for (var i = 0; i < configured.length; i++) {
      configMap[configured[i].key] = configured[i];
    }
    return inferred.map(function (col) {
      var cfg = configMap[col.key];
      if (!cfg) return col;
      return {
        key: col.key, label: cfg.label || col.label, type: col.type, flex: col.flex,
        visible: cfg.visible !== false, order: cfg.order != null ? cfg.order : col.order
      };
    }).sort(function (a, b) { return a.order - b.order; });
  }

  // ── Accent colors (CSS variables only) ──

  var ACCENT_COLORS = [
    { bg: 'bg-accent-purple-light', text: 'text-accent-purple', grad: 'linear-gradient(135deg, var(--accent-purple), color-mix(in oklch, var(--accent-purple) 70%, white))' },
    { bg: 'bg-accent-cyan-light', text: 'text-accent-cyan', grad: 'linear-gradient(135deg, var(--accent-cyan), color-mix(in oklch, var(--accent-cyan) 70%, white))' },
    { bg: 'bg-accent-emerald-light', text: 'text-accent-emerald', grad: 'linear-gradient(135deg, var(--accent-emerald), color-mix(in oklch, var(--accent-emerald) 70%, white))' },
    { bg: 'bg-accent-orange-light', text: 'text-accent-orange', grad: 'linear-gradient(135deg, var(--accent-orange), color-mix(in oklch, var(--accent-orange) 70%, white))' }
  ];

  function getTagColorMap(data, column) {
    var seen = {}, order = [];
    for (var i = 0; i < data.length; i++) {
      var v = data[i][column.key];
      if (v != null && !seen[v]) { seen[v] = true; order.push(v); }
    }
    var map = {};
    for (var j = 0; j < order.length; j++) map[order[j]] = ACCENT_COLORS[j % ACCENT_COLORS.length];
    return map;
  }

  function formatRelativeTime(ts) {
    if (typeof ts !== 'number') return String(ts);
    var diff = Date.now() - ts;
    if (diff < 0) diff = 0;
    var sec = Math.floor(diff / 1000);
    if (sec < 60) return 'Just now';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + ' min ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h ago';
    var d = Math.floor(hr / 24);
    if (d < 30) return d + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  // ── Main Component ──

  function DataList(props) {
    var config = props.config || {};
    var fetchData = props.fetchData;

    var dataState = React.useState(null);
    var data = dataState[0], setData = dataState[1];

    var loadingState = React.useState(true);
    var loading = loadingState[0], setLoading = loadingState[1];

    var errorState = React.useState(null);
    var error = errorState[0], setError = errorState[1];

    var colsState = React.useState([]);
    var columns = colsState[0], setColumns = colsState[1];

    var displayCountState = React.useState(50);
    var displayCount = displayCountState[0], setDisplayCount = displayCountState[1];

    var containerRef = React.useRef(null);
    var tagColorMaps = React.useRef({});

    function doFetch() {
      if (!fetchData) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      fetchData()
        .then(function (result) {
          var arr = extractArray(result, config.data_path || '');
          if (arr === null) { setData(null); setError('format'); }
          else {
            setData(arr);
            var inferred = inferColumns(arr);
            setColumns(mergeColumns(inferred, config.columns));
            var maps = {};
            for (var i = 0; i < inferred.length; i++) {
              if (inferred[i].type === 'tag') maps[inferred[i].key] = getTagColorMap(arr, inferred[i]);
            }
            tagColorMaps.current = maps;
          }
        })
        .catch(function () { setError('fetch'); })
        .finally(function () { setLoading(false); });
    }

    React.useEffect(function () { doFetch(); }, [fetchData, config.data_path]);

    function handleScroll(e) {
      var el = e.target;
      if (!data || displayCount >= data.length) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
        setDisplayCount(Math.min(displayCount + 50, data.length));
      }
    }

    var widthState = React.useState(9999);
    var containerWidth = widthState[0], setContainerWidth = widthState[1];

    React.useEffect(function () {
      if (!containerRef.current) return;
      var el = containerRef.current;
      var observer = new ResizeObserver(function (entries) {
        if (entries[0]) setContainerWidth(entries[0].contentRect.width);
      });
      observer.observe(el);
      return function () { observer.disconnect(); };
    }, [data]);

    var compact = config.row_height === 'compact';
    var visibleCols = columns.filter(function (c) { return c.visible; });
    var mode = 'full';
    if (containerWidth < 300) mode = 'stacked';
    else if (containerWidth < 400) mode = 'narrow';
    var displayCols = visibleCols;
    if (mode === 'narrow') {
      var keepCount = Math.max(2, Math.floor(containerWidth / 100));
      displayCols = visibleCols.slice(0, keepCount);
    }

    // ── States (all attach containerRef) ──

    if (loading) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex items-center justify-center h-full w-full bg-card border border-glass-border rounded-lg',
        children: jsxs('div', { style: { display: 'flex', gap: '4px' }, children: [
          jsx('div', { style: { width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-muted-foreground)', opacity: 0.3, animation: 'data-list-pulse 1s infinite' } }),
          jsx('div', { style: { width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-muted-foreground)', opacity: 0.3, animation: 'data-list-pulse 1s infinite 0.2s' } }),
          jsx('div', { style: { width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-muted-foreground)', opacity: 0.3, animation: 'data-list-pulse 1s infinite 0.4s' } })
        ]})
      });
    }

    if (!fetchData) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full bg-card border border-glass-border rounded-lg text-muted-foreground',
        children: jsx('span', { className: 'text-sm', children: 'No data source configured' })
      });
    }

    if (error === 'format') {
      return jsx('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full bg-card border border-glass-border rounded-lg text-muted-foreground',
        children: jsx('span', { className: 'text-sm', children: 'Data format incompatible' })
      });
    }

    if (error === 'fetch') {
      return jsxs('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full bg-card border border-glass-border rounded-lg text-muted-foreground gap-2',
        children: [
          jsx('span', { key: 'msg', className: 'text-sm', children: 'Failed to load data' }),
          jsx('button', { key: 'retry', className: 'text-xs px-3 py-1 rounded bg-muted-30 text-foreground hover:bg-muted transition-colors', onClick: doFetch, children: 'Retry' })
        ]
      });
    }

    if (!data || data.length === 0) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full bg-card border border-glass-border rounded-lg text-muted-foreground',
        children: jsx('span', { className: 'text-sm', children: 'No data' })
      });
    }

    var rows = data.slice(0, displayCount);

    // ── RENDER (placeholder — Task 3 replaces this) ──
    return jsx('div', {
      ref: containerRef,
      className: 'flex flex-col h-full w-full bg-card border border-glass-border rounded-lg overflow-hidden',
      children: jsxs('div', { className: 'flex-1 overflow-y-auto p-3', children: [
        jsx('div', { className: 'text-sm text-muted-foreground', children: 'Data loaded: ' + rows.length + ' rows, ' + displayCols.length + ' columns (' + mode + ')' })
      ]})
    });
  }

  // ── ConfigPanel (placeholder — Task 4) ──
  function ConfigPanel(props) {
    return jsx('div', { className: 'text-xs text-muted-foreground p-3', children: 'ConfigPanel placeholder' });
  }

  // ── Inject styles ──
  if (!document.getElementById('data-list-styles')) {
    var styleEl = document.createElement('style');
    styleEl.id = 'data-list-styles';
    styleEl.textContent = [
      '@keyframes data-list-pulse {',
      '  0%, 100% { opacity: 0.3; transform: scale(1); }',
      '  50% { opacity: 1; transform: scale(1.3); }',
      '}',
      '.data-list-row:hover { background: var(--bg-muted) !important; border-left: 2px solid var(--accent-purple); }',
      '.data-list-row { border-left: 2px solid transparent; }'
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  return { default: DataList, DataList: DataList, ConfigPanel: ConfigPanel };
})();
