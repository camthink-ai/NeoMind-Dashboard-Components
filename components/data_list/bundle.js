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

  function adaptData(result, dataPath) {
    if (result == null) return { items: null, isEmpty: true, label: 'no_source' };
    if (dataPath) {
      var resolved = resolveByPath(result, dataPath);
      if (Array.isArray(resolved)) return { items: resolved, isEmpty: resolved.length === 0, label: 'path' };
      if (resolved != null && typeof resolved === 'object') return { items: [resolved], isEmpty: false, label: 'path_obj' };
      return { items: null, isEmpty: true, label: 'path_empty' };
    }
    if (Array.isArray(result)) return { items: result, isEmpty: result.length === 0, label: 'array' };

    if (result.value != null && Array.isArray(result.value))
      return { items: result.value, isEmpty: result.value.length === 0, label: 'value_array' };

    if (result.value != null && typeof result.value === 'object' && !Array.isArray(result.value)) {
      var vKeys = Object.keys(result.value);
      for (var vi = 0; vi < vKeys.length; vi++) {
        if (Array.isArray(result.value[vKeys[vi]]))
          return { items: result.value[vKeys[vi]], isEmpty: result.value[vKeys[vi]].length === 0, label: 'value_nested_array' };
      }
      return { items: [result.value], isEmpty: false, label: 'value_object' };
    }
    if (result.value != null && typeof result.value !== 'object')
      return { items: [{ value: result.value }], isEmpty: false, label: 'value_scalar' };

    if (result.series != null && Array.isArray(result.series)) {
      if (result.series.length === 0) return { items: [], isEmpty: true, label: 'series_empty' };
      if (result.series[0] != null && typeof result.series[0] === 'object') {
        var objItems = result.series.map(function (item) {
          return { timestamp: item.timestamp || item.time || item.ts, value: item.value };
        });
        return { items: objItems.reverse(), isEmpty: false, label: 'series_objects' };
      }
      var now = Date.now();
      var primItems = result.series.map(function (item, idx) {
        return { timestamp: now - (result.series.length - 1 - idx) * 60000, value: item };
      });
      return { items: primItems.reverse(), isEmpty: false, label: 'series_primitives' };
    }

    var topKeys = Object.keys(result);
    for (var k = 0; k < topKeys.length; k++) {
      if (Array.isArray(result[topKeys[k]]) && result[topKeys[k]].length > 0)
        return { items: result[topKeys[k]], isEmpty: false, label: 'top_array' };
    }
    if (topKeys.length > 0) return { items: [result], isEmpty: false, label: 'wrap' };
    return { items: null, isEmpty: true, label: 'empty' };
  }

  // ── Column inference ──

  function keyToLabel(key) {
    // Take last segment of dot-path: "values.battery" → "Battery"
    var last = key.split('.').pop() || key;
    return last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
      .replace(/^\w/, function (c) { return c.toUpperCase(); });
  }

  // Format a value for display; skip nested objects and truncate long strings
  function formatValue(v) {
    if (v == null) return null;
    if (typeof v === 'object') return null; // nested objects — skip
    var s = String(v);
    if (s.length > 120) return s.slice(0, 100) + '...';
    return s;
  }

  function inferColumnType(values) {
    var sample = values.slice(0, 50);
    var num = 0, bool = 0, ts = 0, strs = [];
    for (var i = 0; i < sample.length; i++) {
      var v = sample[i];
      if (v == null) continue;
      if (typeof v === 'boolean') { bool++; continue; }
      if (typeof v === 'number') { v > 1e12 ? ts++ : num++; continue; }
      if (typeof v === 'string') strs.push(v);
    }
    var total = num + bool + ts + strs.length;
    if (total === 0) return 'text';
    if (bool / total > 0.7) return 'status';
    if (ts / total > 0.7) return 'time';
    if (num / total > 0.7) return 'number';
    if (strs.length / total > 0.5) {
      var distinct = {};
      for (var j = 0; j < strs.length; j++) distinct[strs[j]] = true;
      if (Object.keys(distinct).length < 8) return 'tag';
    }
    return 'text';
  }

  var TAG_ACCENTS = [
    { light: 'oklch(0.72 0.19 310 / 15%)', text: 'oklch(0.72 0.19 310)' },
    { light: 'oklch(0.72 0.14 200 / 15%)', text: 'oklch(0.72 0.14 200)' },
    { light: 'oklch(0.72 0.19 155 / 15%)', text: 'oklch(0.72 0.19 155)' },
    { light: 'oklch(0.72 0.19 65 / 15%)', text: 'oklch(0.72 0.19 65)' }
  ];

  function inferColumns(data) {
    if (!data || !data.length) return [];
    var first = null;
    for (var f = 0; f < data.length; f++) {
      if (data[f] != null && typeof data[f] === 'object') { first = data[f]; break; }
    }
    if (!first) return [];
    var keys = Object.keys(first);
    var cols = [];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var vals = data.map(function (d) { return d != null && typeof d === 'object' ? d[key] : null; });
      // Skip columns where ALL values are non-displayable (nested objects)
      var displayable = 0;
      for (var vi = 0; vi < vals.length; vi++) {
        var fv = formatValue(vals[vi]);
        if (fv !== null) displayable++;
      }
      if (displayable === 0) continue;
      var type = inferColumnType(vals);
      cols.push({ key: key, label: keyToLabel(key), type: type, visible: true, order: i });
    }
    return cols;
  }

  function mergeColumns(inferred, configured) {
    if (!configured || !configured.length) return inferred;
    var map = {};
    for (var i = 0; i < configured.length; i++) map[configured[i].key] = configured[i];
    return inferred.map(function (col) {
      var c = map[col.key];
      if (!c) return col;
      return { key: col.key, label: c.label || col.label, type: col.type,
        visible: c.visible !== false, order: c.order != null ? c.order : col.order };
    }).sort(function (a, b) { return a.order - b.order; });
  }

  function getTagColorMap(data, col) {
    var seen = {}, order = [];
    for (var i = 0; i < data.length; i++) {
      var v = data[i][col.key];
      if (v != null && !seen[v]) { seen[v] = true; order.push(v); }
    }
    var map = {};
    for (var j = 0; j < order.length; j++) map[order[j]] = TAG_ACCENTS[j % TAG_ACCENTS.length];
    return map;
  }

  function formatTime(ts) {
    if (typeof ts !== 'number') return String(ts);
    var diff = Date.now() - ts;
    if (diff < 0) diff = 0;
    var sec = Math.floor(diff / 1000);
    if (sec < 60) return 'Just now';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + 'm ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h ago';
    var d = Math.floor(hr / 24);
    if (d < 30) return d + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  function getDsLabel(ds) {
    if (!ds) return '';
    if (ds.field) return keyToLabel(ds.field);
    if (ds.infoProperty) return keyToLabel(ds.infoProperty);
    if (ds.systemMetric) return keyToLabel(ds.systemMetric);
    if (ds.extensionMetric) return ds.extensionMetric;
    return '';
  }

  function getStableDsKey(ds) {
    if (!ds) return '';
    return [ds.source || '', ds.mode || ds.type || '', ds.id || ds.sourceId || '', ds.field || ''].join('|');
  }

  // ── Main Component ──

  function DataList(props) {
    var config = props.config || {};
    var fetchData = props.fetchData;
    var dataSource = props.dataSource;

    var dataSt = React.useState(null);
    var data = dataSt[0], setData = dataSt[1];
    var loadSt = React.useState(true);
    var loading = loadSt[0], setLoading = loadSt[1];
    var emptySt = React.useState('');
    var emptyLabel = emptySt[0], setEmptyLabel = emptySt[1];
    var errSt = React.useState(null);
    var error = errSt[0], setError = errSt[1];
    var colSt = React.useState([]);
    var columns = colSt[0], setColumns = colSt[1];
    var dispSt = React.useState(50);
    var displayCount = dispSt[0], setDisplayCount = dispSt[1];

    var containerRef = React.useRef(null);
    var tagMaps = React.useRef({});
    var fetchDataRef = React.useRef(fetchData);
    var configRef = React.useRef(config);
    var onConfigChangeRef = React.useRef(props.onConfigChange);
    var fetchIdRef = React.useRef(0);
    fetchDataRef.current = fetchData;
    configRef.current = config;
    onConfigChangeRef.current = props.onConfigChange;

    var dsKey = getStableDsKey(dataSource);
    var lastDsKeyRef = React.useRef(null);

    function persistColumns(inferred) {
      var cfg = configRef.current;
      if ((!cfg.columns || !cfg.columns.length) && inferred.length && onConfigChangeRef.current) {
        onConfigChangeRef.current(Object.assign({}, cfg, {
          columns: inferred.map(function (c) {
            return { key: c.key, label: c.label, visible: c.visible !== false, order: c.order };
          })
        }));
      }
    }

    function doFetch() {
      var fn = fetchDataRef.current;
      var cfg = configRef.current;
      var fid = ++fetchIdRef.current;
      if (!fn) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      fn().then(function (result) {
        if (fid !== fetchIdRef.current) return;
        console.log('[DataList] fetchData result:', dsKey, JSON.stringify(result).slice(0, 300));
        var adapted = adaptData(result, cfg.data_path || '');
        console.log('[DataList] adapted:', adapted.label, 'items:', adapted.items ? adapted.items.length : 'null');
        if (adapted.items === null) {
          setData(null);
          setEmptyLabel(adapted.label === 'no_source' ? 'no_source' : 'incompatible');
        } else if (adapted.isEmpty) {
          var cv = dataSource && dataSource.currentValue != null ? dataSource.currentValue : null;
          if (cv != null) {
            var cvItems = (typeof cv === 'object' && cv !== null && !Array.isArray(cv)) ? [cv] : [{ value: cv }];
            setData(cvItems);
            setEmptyLabel('');
            var cvInf = inferColumns(cvItems);
            setColumns(mergeColumns(cvInf, cfg.columns));
            persistColumns(cvInf);
          } else {
            setData([]);
            setEmptyLabel(adapted.label);
          }
        } else {
          setData(adapted.items);
          setEmptyLabel('');
          var inferred = inferColumns(adapted.items);
          setColumns(mergeColumns(inferred, cfg.columns));
          persistColumns(inferred);
          var maps = {};
          for (var i = 0; i < inferred.length; i++) {
            if (inferred[i].type === 'tag') maps[inferred[i].key] = getTagColorMap(adapted.items, inferred[i]);
          }
          tagMaps.current = maps;
        }
      }).catch(function () {
        if (fid === fetchIdRef.current) setError('fetch');
      }).finally(function () {
        if (fid === fetchIdRef.current) setLoading(false);
      });
    }

    React.useEffect(function () {
      if (dsKey === lastDsKeyRef.current) return;
      lastDsKeyRef.current = dsKey;
      doFetch();
    }, [dsKey]);

    function handleScroll(e) {
      var el = e.target;
      if (!data || displayCount >= data.length) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 40)
        setDisplayCount(Math.min(displayCount + 50, data.length));
    }

    var wSt = React.useState(9999);
    var cw = wSt[0], setCw = wSt[1];
    React.useEffect(function () {
      if (!containerRef.current) return;
      var el = containerRef.current;
      var obs = new ResizeObserver(function (e) { if (e[0]) setCw(e[0].contentRect.width); });
      obs.observe(el);
      return function () { obs.disconnect(); };
    }, [data]);

    var compact = config.row_height === 'compact';
    var visibleCols = columns.filter(function (c) { return c.visible; });
    var isSmall = cw < 320;

    var metricLabel = getDsLabel(dataSource);

    // ── Empty / Loading / Error ──

    if (loading) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex items-center justify-center h-full w-full bg-card border border-border rounded-lg',
        children: jsx('div', { className: 'flex gap-1', children:
          [0, 1, 2].map(function (i) {
            return jsx('div', { style: { width: 4, height: 4, borderRadius: '50%', background: 'var(--muted-foreground)', opacity: 0.3, animation: 'dl-pulse 1s infinite ' + (i * 0.2) + 's' } }, i);
          })
        })
      });
    }

    if (!fetchData) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full bg-card border border-border rounded-lg text-muted-foreground',
        children: jsx('span', { className: 'text-xs', children: 'No data source configured' })
      });
    }

    if (error) {
      return jsxs('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full bg-card border border-border rounded-lg text-muted-foreground gap-2',
        children: [
          jsx('span', { key: 'm', className: 'text-xs', children: 'Failed to load data' }),
          jsx('button', { key: 'r', className: 'text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-muted transition-colors', onClick: doFetch, children: 'Retry' })
        ]
      });
    }

    if (!data || !data.length) {
      var msg = 'No data';
      if (emptyLabel === 'no_source') msg = 'No data source configured';
      else if (emptyLabel === 'series_empty') msg = 'Waiting for data';
      else if (emptyLabel === 'incompatible') msg = 'Data format incompatible';
      var emptyCh = [jsx('span', { key: 'm', className: 'text-xs', children: msg })];
      if (metricLabel) emptyCh.push(jsx('span', { key: 'l', className: 'text-[10px] opacity-50', children: metricLabel }));
      return jsxs('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full bg-card border border-border rounded-lg text-muted-foreground gap-1',
        children: emptyCh
      });
    }

    // ── Single-item card ──

    if (data.length === 1 && typeof data[0] === 'object' && data[0] !== null) {
      var item = data[0];
      var keys = Object.keys(item).filter(function (k) {
        var v = item[k];
        return v != null && typeof v !== 'object';
      });
      var titleK = null;
      for (var t = 0; t < keys.length; t++) {
        if (typeof item[keys[t]] === 'string' && item[keys[t]].length) { titleK = keys[t]; break; }
      }
      var title = titleK ? String(item[titleK]) : (metricLabel || 'Value');
      var rest = keys.filter(function (k) { return k !== titleK; });
      var kvRows = rest.map(function (k, i) {
        var v = item[k];
        var fmt = v;
        if (typeof v === 'number' && v > 1e12) fmt = formatTime(v);
        else if (typeof v === 'boolean') fmt = v ? 'Yes' : 'No';
        else if (typeof v === 'string' && v.length > 120) fmt = v.slice(0, 100) + '...';
        return jsxs('div', {
          className: 'flex items-center justify-between py-1.5' + (i > 0 ? ' border-t border-border' : ''),
          children: [
            jsx('span', { className: 'text-[10px] text-muted-foreground', children: keyToLabel(k) }),
            jsx('span', { className: 'text-xs font-medium tabular-nums', children: String(fmt) })
          ]
        }, k);
      });

      return jsx('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full bg-card border border-border rounded-lg p-3',
        children: jsxs('div', { className: 'flex flex-col items-center gap-2.5 w-full max-w-[240px]', children: [
          jsxs('div', { className: 'flex items-center gap-2.5', children: [
            jsx('div', { className: 'flex items-center justify-center w-8 h-8 rounded-lg bg-accent-purple/20', children:
              jsx('span', { className: 'text-sm font-bold text-accent-purple', children: title.charAt(0).toUpperCase() })
            }),
            jsx('span', { className: 'text-sm font-semibold truncate max-w-[160px]', children: title })
          ]}),
          rest.length ? jsx('div', { className: 'w-full', children: kvRows }) : null
        ]})
      });
    }

    // ── Multi-item list ──

    var rows = data.slice(0, displayCount);

    // Cell renderer
    function renderCell(val, col) {
      if (val == null) return jsx('span', { className: 'text-muted-foreground/40', children: '\u2014' });
      // Nested objects — not displayable as text
      if (typeof val === 'object') return jsx('span', { className: 'text-muted-foreground/40', children: '\u2014' });

      if (col.type === 'number') {
        var colVar = 'foreground';
        if (typeof val === 'number' && val >= 0 && val <= 100) {
          if (val < 20) colVar = 'destructive';
          else if (val < 40) colVar = 'warning';
        }
        var isPct = typeof val === 'number' && val >= 0 && val <= 100;
        return jsxs('span', { className: 'flex items-center gap-1.5 font-mono tabular-nums text-foreground', children: [
          isPct ? jsx('span', { className: 'inline-block w-6 h-1 rounded-full bg-muted overflow-hidden', children:
            jsx('span', { className: 'block h-full rounded-full', style: { width: val + '%', background: 'var(--' + colVar + ')' } })
          }) : null,
          jsx('span', { style: { color: isPct ? 'var(--' + colVar + ')' : undefined }, children: String(val) })
        ]});
      }

      if (col.type === 'time') {
        return jsx('span', { className: 'text-muted-foreground', children: formatTime(val) });
      }

      if (col.type === 'status') {
        var on = val === true || val === 'true' || val === 'online' || val === 'on' || val === 1;
        return jsxs('span', { className: 'inline-flex items-center gap-1.5', children: [
          jsx('span', { className: 'w-1.5 h-1.5 rounded-full flex-shrink-0 ' + (on ? 'bg-emerald-500' : 'bg-muted-foreground'),
            style: on ? { boxShadow: '0 0 6px oklch(0.72 0.19 155 / 60%)' } : {} }),
          jsx('span', { className: 'text-[11px] ' + (on ? 'text-emerald-500' : 'text-muted-foreground'), children: String(val) })
        ]});
      }

      if (col.type === 'tag') {
        var cm = tagMaps.current[col.key] || {};
        var accent = cm[val] || TAG_ACCENTS[0];
        return jsx('span', {
          className: 'inline-block px-1.5 py-px rounded text-[10px] font-semibold',
          style: { background: accent.light, color: accent.text },
          children: String(val)
        });
      }

      // text
      return jsx('span', { className: 'text-foreground', children: String(val) });
    }

    // Full/narrow table
    if (!isSmall) {
      return jsxs('div', {
        ref: containerRef,
        className: 'flex flex-col h-full w-full bg-card border border-border rounded-lg overflow-hidden',
        children: [
          // Header
          jsx('div', {
            className: 'flex-shrink-0 flex border-b border-border bg-muted/50',
            style: { padding: compact ? '5px 10px' : '6px 12px' },
            children: visibleCols.map(function (col) {
              var align = 'text-left';
              return jsx('span', {
                className: 'flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ' + align,
                children: col.label
              }, col.key);
            })
          }),
          // Body
          jsx('div', {
            className: 'flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent',
            onScroll: handleScroll,
            children: rows.map(function (row, idx) {
              return jsx('div', {
                className: 'dl-row flex items-center border-b border-border last:border-b-0 transition-colors',
                style: { padding: compact ? '6px 10px' : '8px 12px' },
                children: visibleCols.map(function (col) {
                  var align = 'justify-start';
                  return jsx('span', {
                    className: 'flex-1 flex items-center text-xs ' + align,
                    children: renderCell(row[col.key], col)
                  }, col.key);
                })
              }, row.id || idx);
            })
          })
        ]
      });
    }

    // Small/stacked layout
    return jsxs('div', {
      ref: containerRef,
      className: 'flex flex-col h-full w-full bg-card border border-border rounded-lg overflow-hidden',
      children: [
        jsx('div', {
          className: 'flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent',
          children: rows.map(function (row, idx) {
            var nameCol = visibleCols[0];
            var name = nameCol ? String(row[nameCol.key] || '') : '';
            var parts = [];
            for (var i = 1; i < visibleCols.length && i < 3; i++) {
              var c = visibleCols[i];
              var v = row[c.key];
              if (v != null) parts.push(c.type === 'time' ? formatTime(v) : String(v));
            }
            var statusCol = null;
            for (var j = 0; j < visibleCols.length; j++) {
              if (visibleCols[j].type === 'status') { statusCol = visibleCols[j]; break; }
            }
            var sv = statusCol ? row[statusCol.key] : null;
            var on = sv === true || sv === 'true' || sv === 'online' || sv === 1;
            var topCh = [jsx('span', { key: 'n', className: 'text-[11px] font-medium truncate', children: name })];
            if (sv != null) topCh.push(jsx('span', { key: 'd', className: 'w-1.5 h-1.5 rounded-full flex-shrink-0 ' + (on ? 'bg-emerald-500' : 'bg-muted-foreground') }));
            return jsxs('div', {
              className: 'dl-row flex items-center gap-2 border-b border-border last:border-b-0 px-2.5 py-1.5 transition-colors',
              children: [
                jsx('div', { className: 'w-5 h-5 rounded flex-shrink-0 flex items-center justify-center', style: { background: 'oklch(0.72 0.19 310 / 15%)' }, children:
                  jsx('span', { className: 'text-[9px] font-bold', style: { color: 'oklch(0.72 0.19 310)' }, children: '\u25CF' })
                }),
                jsxs('div', { className: 'flex-1 min-w-0', children: [
                  jsxs('div', { className: 'flex items-center justify-between gap-1', children: topCh }),
                  parts.length ? jsx('div', { className: 'text-[9px] text-muted-foreground mt-px', children: parts.join(' \u00B7 ') }) : null
                ]})
              ]
            }, row.id || idx);
          })
        })
      ]
    });
  }

  // ── ConfigPanel ──

  function ConfigPanel(props) {
    var config = props.config || {};
    var onChange = props.onChange || function () {};
    var columns = config.columns || [];
    var hSt = React.useState(config.row_height || 'default');
    var rh = hSt[0], setRh = hSt[1];

    function set(key, val) { onChange(key, val); }

    function toggleCol(idx) {
      var c = columns.slice();
      c[idx] = Object.assign({}, c[idx], { visible: !c[idx].visible });
      set('columns', c);
    }

    function renameCol(idx, label) {
      var c = columns.slice();
      c[idx] = Object.assign({}, c[idx], { label: label });
      set('columns', c);
    }

    var ch = [
      jsxs('div', { key: 'h', className: 'flex flex-col gap-1.5', children: [
        jsx('span', { className: 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground', children: 'Row Height' }),
        jsxs('div', { className: 'flex gap-1.5', children: [
          jsx('button', {
            className: 'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ' + (rh === 'default' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted'),
            onClick: function () { setRh('default'); set('row_height', 'default'); },
            children: 'Default'
          }),
          jsx('button', {
            className: 'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ' + (rh === 'compact' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted'),
            onClick: function () { setRh('compact'); set('row_height', 'compact'); },
            children: 'Compact'
          })
        ]})
      ]})
    ];

    if (columns.length) {
      ch.push(jsxs('div', { key: 'c', className: 'flex flex-col gap-1.5', children: [
        jsx('span', { className: 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground', children: 'Columns' }),
        jsx('div', { className: 'flex flex-col gap-1', children:
          columns.map(function (col, i) {
            return jsxs('div', {
              className: 'flex items-center gap-2',
              children: [
                jsx('input', { type: 'checkbox', checked: col.visible !== false, onChange: function () { toggleCol(i); }, className: 'accent-foreground w-3.5 h-3.5' }),
                jsx('input', { type: 'text', value: col.label || '', onChange: function (e) { renameCol(i, e.target.value); },
                  className: 'text-[11px] bg-transparent border-b border-border text-foreground px-1 py-0.5 flex-1 focus:outline-none focus:border-foreground transition-colors' })
              ]
            }, col.key);
          })
        })
      ]}));
    } else {
      ch.push(jsx('span', { key: 'nc', className: 'text-[10px] text-muted-foreground', children: 'Columns will appear after data loads' }));
    }

    return jsxs('div', { className: 'flex flex-col gap-3 p-3', children: ch });
  }

  // ── Styles ──
  if (!document.getElementById('dl-styles')) {
    var s = document.createElement('style');
    s.id = 'dl-styles';
    s.textContent = [
      '@keyframes dl-pulse {',
      '  0%, 100% { opacity: 0.3; transform: scale(1); }',
      '  50% { opacity: 1; transform: scale(1.3); }',
      '}',
      '.dl-row:hover { background: var(--muted) !important; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  return { default: DataList, DataList: DataList, ConfigPanel: ConfigPanel };
})();
