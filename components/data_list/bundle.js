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
      if (resolved != null && typeof resolved === 'object') return [resolved];
      return null;
    }
    // Result itself is an array
    if (Array.isArray(result)) return result;

    // { value: [...] } — array of objects/rows
    if (result.value != null && Array.isArray(result.value)) return result.value;

    // { value: { key1: [...], key2: ..., ... } } — find first array inside value
    if (result.value != null && typeof result.value === 'object' && !Array.isArray(result.value)) {
      var keys = Object.keys(result.value);
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(result.value[keys[i]])) return result.value[keys[i]];
      }
      // value is a plain object — wrap as single row
      return [result.value];
    }

    // { series: [...] } — timeseries data
    if (result.series != null && Array.isArray(result.series)) {
      // Empty series — no data
      if (result.series.length === 0) return [];
      // Series items are objects with timestamp/value
      if (result.series[0] != null && typeof result.series[0] === 'object') {
        return result.series.map(function (item, idx) {
          return typeof item === 'object' && item !== null
            ? { timestamp: item.timestamp, value: item.value }
            : { index: idx, value: item };
        });
      }
      // Series items are primitives (numbers/strings) — wrap each as a row
      return result.series.map(function (item, idx) {
        return { index: idx + 1, value: item };
      });
    }

    // { value: <primitive> } — single scalar value, wrap as one row
    if (result.value != null && typeof result.value !== 'object') {
      return [{ value: result.value }];
    }

    // Deep search: find first array in any top-level field
    var topKeys = Object.keys(result);
    for (var k = 0; k < topKeys.length; k++) {
      if (Array.isArray(result[topKeys[k]]) && result[topKeys[k]].length > 0) return result[topKeys[k]];
    }
    // Fallback: wrap result as single row
    if (typeof result === 'object' && topKeys.length > 0) {
      return [result];
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
    // Find first non-null item to get keys (skip null entries)
    var first = null;
    for (var f = 0; f < data.length; f++) {
      if (data[f] != null && typeof data[f] === 'object') { first = data[f]; break; }
    }
    if (!first) return [];
    var keys = Object.keys(first);
    var columns = [];
    var firstTextIdx = -1;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var values = data.map(function (item) { return item != null && typeof item === 'object' ? item[key] : null; });
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
    var dataSource = props.dataSource;

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
    var fetchDataRef = React.useRef(fetchData);
    var configRef = React.useRef(config);
    var mountedRef = React.useRef(false);
    var fetchIdRef = React.useRef(0);
    fetchDataRef.current = fetchData;
    configRef.current = config;

    function doFetch() {
      var fn = fetchDataRef.current;
      var cfg = configRef.current;
      var thisFetchId = ++fetchIdRef.current;
      if (!fn) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      fn()
        .then(function (result) {
          if (thisFetchId !== fetchIdRef.current) return;
          console.log('[DataList] fetchData →', JSON.stringify(result));
          if (result == null) { setData(null); setLoading(false); return; }
          var arr = extractArray(result, cfg.data_path || '');
          console.log('[DataList] extractArray →', arr ? ('[' + arr.length + ']') : 'null', arr && arr[0] ? JSON.stringify(arr[0]) : '');
          if (arr === null) { setData(null); setError('format'); }
          else if (arr.length === 0) { setData([]); }
          else {
            setData(arr);
            var inferred = inferColumns(arr);
            setColumns(mergeColumns(inferred, cfg.columns));
            var maps = {};
            for (var i = 0; i < inferred.length; i++) {
              if (inferred[i].type === 'tag') maps[inferred[i].key] = getTagColorMap(arr, inferred[i]);
            }
            tagColorMaps.current = maps;
          }
        })
        .catch(function (e) { if (thisFetchId === fetchIdRef.current) setError('fetch'); })
        .finally(function () { if (thisFetchId === fetchIdRef.current) setLoading(false); });
    }

    // Track dataSource identity to re-fetch when user changes the binding
    var dsKey = dataSource ? JSON.stringify(dataSource) : '';
    var lastDsKeyRef = React.useRef(dsKey);

    React.useEffect(function () {
      // Re-fetch when dataSource changes, or on first mount
      if (dsKey === lastDsKeyRef.current && mountedRef.current) return;
      lastDsKeyRef.current = dsKey;
      mountedRef.current = true;
      doFetch();
    }, [dsKey]);

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

    // ── Single item: card layout ──
    if (data.length === 1 && typeof data[0] === 'object' && data[0] !== null) {
      var singleItem = data[0];
      var singleKeys = Object.keys(singleItem);
      var singleAccent = ACCENT_COLORS[0];
      // Find the "name" or first text field for the title
      var titleKey = null;
      for (var ti = 0; ti < singleKeys.length; ti++) {
        var tv = singleItem[singleKeys[ti]];
        if (typeof tv === 'string' && tv.length > 0) { titleKey = singleKeys[ti]; break; }
      }
      var titleValue = titleKey ? String(singleItem[titleKey]) : '';
      var kvPairs = singleKeys.filter(function (k) { return k !== titleKey && singleItem[k] != null; });
      var kvChildren = [];
      for (var ki = 0; ki < kvPairs.length; ki++) {
        var kk = kvPairs[ki];
        var kv = singleItem[kk];
        var kvFormatted = kv;
        if (typeof kv === 'number' && kv > 1e12) kvFormatted = formatRelativeTime(kv);
        kvChildren.push(jsxs('div', {
          key: kk,
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: ki > 0 ? '1px solid var(--border-glass-border, var(--border))' : 'none' },
          children: [
            jsx('span', { key: 'k', style: { fontSize: '11px', color: 'var(--text-muted-foreground)', flexShrink: 0 }, children: keyToLabel(kk) }),
            jsx('span', { key: 'v', style: { fontSize: '12px', color: 'var(--text-foreground)', fontWeight: 500, textAlign: 'right', marginLeft: '12px' }, children: String(kvFormatted) })
          ]
        }));
      }
      var cardChildren = [];
      if (titleValue) {
        cardChildren.push(jsxs('div', {
          key: 'title',
          style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' },
          children: [
            jsx('span', {
              key: 'icon',
              style: { width: '32px', height: '32px', borderRadius: '8px', background: singleAccent.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
              children: jsx('span', { style: { color: 'var(--text-primary-foreground)', fontSize: '14px' }, children: '\u25CF' })
            }),
            jsx('span', { key: 'txt', style: { fontSize: '14px', fontWeight: 600, color: 'var(--text-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: titleValue })
          ]
        }));
      }
      if (kvPairs.length > 0) {
        cardChildren.push(jsx('div', { key: 'kv', style: { flex: 1, overflow: 'auto' }, children: kvChildren }));
      }
      if (cardChildren.length === 0) {
        // Only had null values, show the raw data
        cardChildren.push(jsx('div', { key: 'raw', style: { fontSize: '12px', color: 'var(--text-muted-foreground)', padding: '8px 0' }, children: JSON.stringify(singleItem) }));
      }
      return jsxs('div', {
        ref: containerRef,
        className: 'flex flex-col h-full w-full bg-card border border-glass-border rounded-lg overflow-hidden',
        style: { padding: '14px' },
        children: cardChildren
      });
    }

    var rows = data.slice(0, displayCount);

    // Column header
    function renderHeader() {
      if (mode === 'stacked') return null;
      return jsx('div', {
        key: 'header',
        className: 'flex-shrink-0',
        style: { display: 'flex', gap: '12px', padding: compact ? '6px 12px' : '8px 14px', borderBottom: '1px solid var(--border-glass-border, var(--border))' },
        children: displayCols.map(function (col) {
          return jsx('span', {
            key: col.key,
            style: {
              flex: col.flex, fontSize: '10px', color: 'var(--text-muted-foreground)',
              textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500,
              textAlign: col.type === 'number' || col.type === 'time' ? 'right' : 'left'
            },
            children: col.label
          });
        })
      });
    }

    function renderCell(item, col, rowIdx) {
      var val = item[col.key];
      if (val == null) return '';

      if (col.type === 'number') {
        var colorVar = 'var(--text-foreground)';
        if (typeof val === 'number' && val >= 0 && val <= 100) {
          if (val < 20) colorVar = 'var(--text-error)';
          else if (val < 40) colorVar = 'var(--text-warning)';
        }
        var barWidth = (typeof val === 'number' && val >= 0 && val <= 100) ? val : -1;
        var numChildren = [];
        if (barWidth >= 0) {
          numChildren.push(jsx('span', {
            key: 'bar',
            style: { width: '32px', height: '4px', borderRadius: '2px', background: 'var(--bg-muted-30, var(--bg-muted))', overflow: 'hidden', display: 'inline-block' },
            children: jsx('span', { style: { display: 'block', height: '100%', width: barWidth + '%', background: colorVar, borderRadius: '2px' } })
          }));
        }
        numChildren.push(jsx('span', { key: 'val', style: { color: colorVar }, children: val }));
        return jsxs('span', {
          style: { display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%', fontVariantNumeric: 'tabular-nums' },
          children: numChildren
        });
      }

      if (col.type === 'time') {
        return jsx('span', { children: formatRelativeTime(val) });
      }

      if (col.type === 'status') {
        var isTrue = val === true || val === 'true' || val === 'online' || val === 'on' || val === 1;
        var dotColor = isTrue ? 'var(--text-success)' : 'var(--text-muted-foreground)';
        var glow = isTrue ? '0 0 6px oklch(0.72 0.19 155)' : 'none';
        return jsxs('span', {
          style: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
          children: [
            jsx('span', { key: 'dot', style: { width: '6px', height: '6px', borderRadius: '50%', background: dotColor, boxShadow: glow } }),
            jsx('span', { key: 'lbl', style: { fontSize: '11px', color: dotColor }, children: String(val) })
          ]
        });
      }

      if (col.type === 'tag') {
        var colorMap = tagColorMaps.current[col.key] || {};
        var accent = colorMap[val] || ACCENT_COLORS[0];
        return jsx('span', {
          className: accent.bg + ' ' + accent.text,
          style: { fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 },
          children: String(val)
        });
      }

      // text — first text column (flex:2) gets gradient icon
      if (col.flex === 2) {
        var iconAccent = ACCENT_COLORS[rowIdx % ACCENT_COLORS.length];
        return jsxs('span', {
          style: { display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' },
          children: [
            jsx('span', {
              key: 'icon',
              style: {
                width: compact ? '24px' : '28px', height: compact ? '24px' : '28px',
                borderRadius: '6px', background: iconAccent.grad,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              },
              children: jsx('span', { style: { color: 'var(--text-primary-foreground)', fontSize: compact ? '11px' : '13px' }, children: '\u25CF' })
            }),
            jsx('span', {
              key: 'txt',
              style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--text-foreground)' },
              children: String(val)
            })
          ]
        });
      }

      return jsx('span', { children: String(val) });
    }

    function renderRow(item, idx) {
      var bgColor = idx % 2 === 1 ? 'var(--bg-muted-30, var(--bg-muted))' : 'transparent';
      var padV = compact ? '8px' : '10px';
      var padH = compact ? '12px' : '14px';
      return jsx('div', {
        key: item.id || idx,
        className: 'data-list-row',
        style: {
          display: 'flex', gap: '12px', alignItems: 'center',
          padding: padV + ' ' + padH,
          borderTop: idx > 0 ? '1px solid var(--border-glass-border, var(--border))' : 'none',
          background: bgColor, transition: 'background 0.15s'
        },
        children: displayCols.map(function (col) {
          return jsx('span', {
            key: col.key,
            style: { flex: col.flex, textAlign: col.type === 'number' || col.type === 'time' ? 'right' : 'left', fontSize: '12px', color: 'var(--text-muted-foreground)' },
            children: renderCell(item, col, idx)
          });
        })
      });
    }

    function renderStackedRow(item, idx) {
      var bgColor = idx % 2 === 1 ? 'var(--bg-muted-30, var(--bg-muted))' : 'transparent';
      var firstCol = visibleCols[0] || displayCols[0];
      var name = firstCol ? String(item[firstCol.key] || '') : '';
      var iconAccent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
      var parts = [];
      for (var i = 1; i < visibleCols.length && i < 3; i++) {
        var c = visibleCols[i];
        var v = item[c.key];
        if (v != null) { parts.push(c.type === 'time' ? formatRelativeTime(v) : String(v)); }
      }
      var subtitle = parts.join(' \u00B7 ');
      var statusCol = null;
      for (var j = 0; j < visibleCols.length; j++) {
        if (visibleCols[j].type === 'status') { statusCol = visibleCols[j]; break; }
      }
      var statusVal = statusCol ? item[statusCol.key] : null;
      var isOnline = statusVal === true || statusVal === 'true' || statusVal === 'online' || statusVal === 1;
      var dotColor = isOnline ? 'var(--text-success)' : statusVal != null ? 'var(--text-muted-foreground)' : null;
      var topChildren = [
        jsx('span', { key: 'name', style: { color: 'var(--text-foreground)', fontWeight: 500, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: name })
      ];
      if (dotColor) {
        topChildren.push(jsx('span', { key: 'dot', style: { width: '5px', height: '5px', borderRadius: '50%', background: dotColor, flexShrink: 0 } }));
      }
      var contentChildren = [
        jsxs('div', {
          key: 'top',
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' },
          children: topChildren
        }),
        jsx('div', { key: 'sub', style: { color: 'var(--text-muted-foreground)', fontSize: '9px', marginTop: '1px' }, children: subtitle })
      ];
      return jsxs('div', {
        key: item.id || idx,
        style: {
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 10px',
          borderTop: idx > 0 ? '1px solid var(--border-glass-border, var(--border))' : 'none',
          background: bgColor
        },
        children: [
          jsx('span', {
            key: 'icon',
            style: { width: '22px', height: '22px', borderRadius: '5px', background: iconAccent.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
            children: jsx('span', { style: { color: 'var(--text-primary-foreground)', fontSize: '10px' }, children: '\u25CF' })
          }),
          jsxs('span', { key: 'content', style: { flex: 1, minWidth: 0 }, children: contentChildren })
        ]
      });
    }

    var rowRenderer = mode === 'stacked' ? renderStackedRow : renderRow;

    var bodyChildren = rows.map(function (item, idx) { return rowRenderer(item, idx); });
    if (displayCount < data.length) {
      bodyChildren.push(jsxs('div', {
        key: 'loader',
        style: { display: 'flex', justifyContent: 'center', padding: '8px', gap: '4px' },
        children: [
          jsx('div', { key: 'd1', style: { width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted-foreground)', opacity: 0.3, animation: 'data-list-pulse 1s infinite' } }),
          jsx('div', { key: 'd2', style: { width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted-foreground)', opacity: 0.3, animation: 'data-list-pulse 1s infinite 0.2s' } }),
          jsx('div', { key: 'd3', style: { width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted-foreground)', opacity: 0.3, animation: 'data-list-pulse 1s infinite 0.4s' } })
        ]
      }));
    }

    return jsxs('div', {
      ref: containerRef,
      className: 'flex flex-col h-full w-full bg-card border border-glass-border rounded-lg overflow-hidden',
      children: [
        renderHeader(),
        jsx('div', { key: 'body', className: 'flex-1 overflow-y-auto', onScroll: handleScroll, children: bodyChildren })
      ]
    });
  }

  // ── ConfigPanel (Task 4) ──
  function ConfigPanel(props) {
    var config = props.config || {};
    var onConfigChange = props.onConfigChange || function () {};
    var columns = config.columns || [];

    var heightState = React.useState(config.row_height || 'default');
    var rowHeight = heightState[0], setRowHeight = heightState[1];

    function updateConfig(newConfig) {
      onConfigChange(Object.assign({}, config, newConfig));
    }

    function toggleColumnVisibility(idx) {
      var cols = columns.slice();
      cols[idx] = Object.assign({}, cols[idx], { visible: !cols[idx].visible });
      updateConfig({ columns: cols });
    }

    function updateColumnLabel(idx, newLabel) {
      var cols = columns.slice();
      cols[idx] = Object.assign({}, cols[idx], { label: newLabel });
      updateConfig({ columns: cols });
    }

    var children = [
      jsxs('div', { key: 'height', className: 'flex flex-col gap-1', children: [
        jsx('span', { className: 'text-xs font-semibold text-muted-foreground uppercase tracking-wide', children: 'Row Height' }),
        jsxs('div', { className: 'flex gap-2', children: [
          jsx('button', {
            className: 'px-3 py-1 rounded text-xs font-medium transition-colors ' + (rowHeight === 'default' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted-30'),
            onClick: function () { setRowHeight('default'); updateConfig({ row_height: 'default' }); },
            children: 'Default'
          }),
          jsx('button', {
            className: 'px-3 py-1 rounded text-xs font-medium transition-colors ' + (rowHeight === 'compact' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted-30'),
            onClick: function () { setRowHeight('compact'); updateConfig({ row_height: 'compact' }); },
            children: 'Compact'
          })
        ]})
      ]})
    ];

    if (columns.length > 0) {
      var colItems = columns.map(function (col, idx) {
        return jsxs('div', {
          key: col.key,
          className: 'flex items-center gap-2 py-1',
          children: [
            jsx('input', {
              key: 'cb',
              type: 'checkbox',
              checked: col.visible !== false,
              onChange: function () { toggleColumnVisibility(idx); },
              className: 'accent-foreground'
            }),
            jsx('input', {
              key: 'lbl',
              type: 'text',
              value: col.label || '',
              onChange: function (e) { updateColumnLabel(idx, e.target.value); },
              className: 'text-xs bg-transparent border-b border-glass-border text-foreground px-1 py-0.5 focus:outline-none focus:border-foreground',
              style: { flex: 1 }
            })
          ]
        });
      });
      children.push(jsxs('div', { key: 'cols', className: 'flex flex-col gap-1', children: [
        jsx('span', { className: 'text-xs font-semibold text-muted-foreground uppercase tracking-wide', children: 'Columns' }),
        colItems
      ]}));
    } else {
      children.push(jsx('div', { key: 'no-cols', className: 'text-xs text-muted-foreground', children: 'Columns will appear after data is loaded' }));
    }

    return jsxs('div', { className: 'flex flex-col gap-3 p-3', children: children });
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
