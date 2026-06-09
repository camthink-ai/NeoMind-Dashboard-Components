var NeoMind_TextDisplay = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  // ── Glass container style ──
  var glassContainer = {
    background: 'linear-gradient(135deg, oklch(1 0 0 / 6%) 0%, oklch(0.75 0.06 270 / 5%) 40%, oklch(1 0 0 / 3%) 60%, oklch(0.75 0.06 200 / 4%) 100%)',
    backgroundSize: '300% 300%',
    animation: 'td-shimmer 12s ease infinite',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 1px 3px oklch(0 0 0 / 12%), inset 0 1px 0 oklch(1 0 0 / 6%)'
  };

  // ── Style injection (idempotent) ──
  if (!document.getElementById('td-styles')) {
    var tdStyle = document.createElement('style');
    tdStyle.id = 'td-styles';
    tdStyle.textContent = [
      '@keyframes td-shimmer {',
      '  0%, 100% { background-position: 0% 50%; }',
      '  50% { background-position: 100% 50%; }',
      '}',
      '@keyframes td-pulse {',
      '  0%, 100% { opacity: 0.3; transform: scale(1); }',
      '  50% { opacity: 1; transform: scale(1.3); }',
      '}',
      '.td-scroll::-webkit-scrollbar { width: 4px; }',
      '.td-scroll::-webkit-scrollbar-track { background: transparent; }',
      '.td-scroll::-webkit-scrollbar-thumb { background: oklch(1 0 0 / 10%); border-radius: 4px; }',
      '.td-scroll::-webkit-scrollbar-thumb:hover { background: oklch(1 0 0 / 20%); }'
    ].join('\n');
    document.head.appendChild(tdStyle);
  }

  // ── Data Formatting Engine ──

  var VALUE_STYLES = {
    string:  { color: 'var(--accent-cyan)',        bg: 'oklch(0.75 0.12 200 / 10%)' },
    number:  { color: 'var(--warning)',             bg: 'oklch(0.8 0.12 85 / 10%)' },
    status:  { color: 'var(--success)',             bg: 'oklch(0.72 0.14 155 / 10%)' },
    boolean: { color: 'var(--muted-foreground)',    bg: 'oklch(0.7 0 0 / 8%)' }
  };

  var STATUS_VALUES = {
    'online': 1, 'active': 1, 'success': 1, 'running': 1,
    'healthy': 1, 'ok': 1, 'true': 1, 'on': 1, 'yes': 1, 'enabled': 1
  };

  function classifyValue(v) {
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') {
      var lower = v.toLowerCase();
      if (STATUS_VALUES[lower]) return 'status';
      return 'string';
    }
    return 'string';
  }

  function formatValue(v) {
    if (v == null) return { text: '--', type: 'string' };
    if (typeof v === 'boolean') return { text: v ? 'Yes' : 'No', type: 'boolean' };
    if (typeof v === 'number') {
      if (v > 0 && v < 1 && v !== Math.floor(v)) {
        return { text: (v * 100).toFixed(1) + '%', type: 'number' };
      }
      return { text: String(v), type: 'number' };
    }
    return { text: String(v), type: classifyValue(v) };
  }

  function flattenObject(obj, prefix, depth) {
    if (depth > 10) return [];
    var lines = [];
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var fullKey = prefix ? prefix + '.' + k : k;
      var v = obj[k];
      if (v == null) continue;
      if (typeof v === 'object' && !Array.isArray(v)) {
        var nested = flattenObject(v, fullKey, depth + 1);
        for (var ni = 0; ni < nested.length; ni++) lines.push(nested[ni]);
      } else if (Array.isArray(v)) {
        var arrLines = formatArray(v, fullKey);
        for (var ai = 0; ai < arrLines.length; ai++) lines.push(arrLines[ai]);
      } else {
        var fmt = formatValue(v);
        lines.push({ key: fullKey, value: fmt.text, valueType: fmt.type });
      }
    }
    return lines;
  }

  function formatArray(arr, prefix, depth) {
    if (depth > 10) return [];
    var lines = [];
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i];
      if (item == null) continue;
      if (typeof item === 'object' && !Array.isArray(item)) {
        var keys = Object.keys(item);
        for (var j = 0; j < keys.length; j++) {
          var v = item[keys[j]];
          if (v == null) continue;
          if (typeof v === 'object' && !Array.isArray(v)) {
            var nested = flattenObject(v, prefix || keys[j], (depth || 0) + 1);
            for (var ni = 0; ni < nested.length; ni++) lines.push(nested[ni]);
          } else if (Array.isArray(v)) {
            var arrNested = formatArray(v, prefix || keys[j], (depth || 0) + 1);
            for (var ai = 0; ai < arrNested.length; ai++) lines.push(arrNested[ai]);
          } else {
            var fmt = formatValue(v);
            lines.push({ key: prefix || keys[j], value: fmt.text, valueType: fmt.type });
          }
        }
      } else if (Array.isArray(item)) {
        var nested = formatArray(item, prefix, (depth || 0) + 1);
        for (var k = 0; k < nested.length; k++) lines.push(nested[k]);
      } else {
        var fmt = formatValue(item);
        lines.push({ key: '', value: fmt.text, valueType: fmt.type });
      }
    }
    return lines;
  }

  function formatData(data) {
    if (data == null) return [];
    if (typeof data === 'string') {
      try {
        var parsed = JSON.parse(data);
        return formatData(parsed);
      } catch (e) {}
      return [{ key: '', value: data, valueType: 'string' }];
    }
    if (typeof data === 'number' || typeof data === 'boolean') {
      var fmt = formatValue(data);
      return [{ key: '', value: fmt.text, valueType: fmt.type }];
    }
    if (Array.isArray(data)) return formatArray(data, '');
    if (typeof data === 'object') return flattenObject(data, '', 0);
    return [{ key: '', value: String(data), valueType: 'string' }];
  }

  // ── Helpers ──

  function getStableDsKey(ds) {
    if (!ds) return '';
    if (Array.isArray(ds)) return ds.map(function (d) {
      return [d.source || '', d.mode || d.type || '', d.id || d.sourceId || '', d.field || ''].join('|');
    }).join('||');
    return [ds.source || '', ds.mode || ds.type || '', ds.id || ds.sourceId || '', ds.field || ''].join('|');
  }

  function keyToLabel(key) {
    var last = key.split('.').pop() || key;
    return last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
      .replace(/^\w/, function (c) { return c.toUpperCase(); });
  }

  var FONT_SIZES = { small: 'text-[11px]', medium: 'text-xs', large: 'text-sm' };

  // ── Main Component ──

  function TextDisplay(props) {
    var config = props.config || {};
    var fetchData = props.fetchData;
    var dataSource = props.dataSource;

    var dataSt = React.useState(null);
    var data = dataSt[0], setData = dataSt[1];
    var loadSt = React.useState(true);
    var loading = loadSt[0], setLoading = loadSt[1];
    var errSt = React.useState(null);
    var error = errSt[0], setError = errSt[1];

    var fetchDataRef = React.useRef(fetchData);
    fetchDataRef.current = fetchData;
    var fetchIdRef = React.useRef(0);
    var lastDsKeyRef = React.useRef(null);
    var containerRef = React.useRef(null);

    var dsKey = getStableDsKey(dataSource);

    function doFetch() {
      var fn = fetchDataRef.current;
      var fid = ++fetchIdRef.current;
      if (!fn) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      fn({ timeRange: 24 }).then(function (result) {
        if (fid !== fetchIdRef.current) return;
        if (result == null) { setData(null); return; }
        if (Array.isArray(result)) {
          var merged = [];
          for (var i = 0; i < result.length; i++) {
            var r = result[i];
            var val = r && r.value != null ? r.value : r;
            if (val != null) {
              if (merged.length > 0) {
                merged.push({ key: '', value: '', valueType: 'separator' });
              }
              var lines = formatData(val);
              for (var j = 0; j < lines.length; j++) merged.push(lines[j]);
            }
          }
          setData(merged.length ? merged : null);
        } else {
          var val = result.value != null ? result.value : result;
          var lines = formatData(val);
          setData(lines.length ? lines : null);
        }
      }).catch(function () {
        if (fid !== fetchIdRef.current) return;
        setError('fetch');
      }).finally(function () {
        if (fid !== fetchIdRef.current) return;
        setLoading(false);
      });
    }

    React.useEffect(function () {
      var triggerKey = dsKey;
      if (triggerKey === lastDsKeyRef.current) return;
      lastDsKeyRef.current = triggerKey;
      doFetch();
    }, [dsKey]);

    React.useEffect(function () {
      if (!dsKey) return;
      var iv = setInterval(function () {
        lastDsKeyRef.current = null;
        doFetch();
      }, 30000);
      return function () { clearInterval(iv); };
    }, [dsKey]);

    // ── Loading ──
    if (loading) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex items-center justify-center h-full w-full',
        style: glassContainer,
        children: jsx('div', { className: 'flex gap-1.5', children:
          [0, 1, 2].map(function (i) {
            return jsx('div', { style: { width: 5, height: 5, borderRadius: '50%', background: 'var(--muted-foreground)', opacity: 0.3, animation: 'td-pulse 1s infinite ' + (i * 0.2) + 's' } }, i);
          })
        })
      });
    }

    // ── No data source ──
    if (!fetchData) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full text-muted-foreground',
        style: glassContainer,
        children: jsx('span', { className: 'text-xs', children: 'Bind a data source' })
      });
    }

    // ── Error ──
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

    var formattedLines = data || [];

    // ── No data ──
    if (!formattedLines.length) {
      return jsx('div', {
        ref: containerRef,
        className: 'flex flex-col items-center justify-center h-full w-full text-muted-foreground',
        style: glassContainer,
        children: jsx('span', { className: 'text-xs', children: 'No data' })
      });
    }

    // ── Build rendered lines ──
    var title = config.title || 'Text Display';
    var maxHeight = config.maxHeight || 300;
    var fontSizeClass = FONT_SIZES[config.fontSize] || FONT_SIZES.medium;
    var highlightNums = config.highlightNumbers !== false;

    var lineElements = formattedLines.map(function (line, idx) {
      // Separator between sources
      if (line.valueType === 'separator') {
        return jsx('div', {
          style: { borderTop: '1px solid var(--border)', margin: '6px 0' }
        }, 'sep_' + idx);
      }

      var shouldHighlight = highlightNums || line.valueType === 'status';
      var style = shouldHighlight ? (VALUE_STYLES[line.valueType] || VALUE_STYLES.string) : null;
      var keyLabel = line.key ? keyToLabel(line.key) : '';

      // Truncate long values
      var displayValue = line.value;
      var truncate = displayValue.length > 80;
      if (truncate) displayValue = displayValue.slice(0, 77) + '...';

      var valueEl;
      if (shouldHighlight && style) {
        valueEl = jsx('span', {
          className: 'px-1.5 py-0.5 rounded font-medium',
          style: { color: style.color, background: style.bg },
          title: truncate ? line.value : undefined,
          children: displayValue
        });
      } else {
        valueEl = jsx('span', {
          className: 'font-medium',
          title: truncate ? line.value : undefined,
          children: displayValue
        });
      }

      if (keyLabel) {
        return jsxs('div', {
          className: 'flex items-baseline gap-2',
          children: [
            jsx('span', { key: 'label', className: 'text-muted-foreground flex-shrink-0', children: keyLabel }),
            jsx('span', { key: 'value', children: valueEl })
          ]
        }, line.key + '_' + idx);
      }
      return jsx('div', {
        className: 'flex items-baseline',
        children: valueEl
      }, 'line_' + idx);
    });

    // ── Final render ──
    return jsxs('div', {
      ref: containerRef,
      className: 'flex flex-col h-full w-full overflow-hidden',
      style: glassContainer,
      children: [
        jsx('div', {
          key: 'header',
          className: 'flex-shrink-0 px-3 py-2 text-sm font-semibold text-accent-purple',
          style: { borderBottom: '1px solid var(--border)' },
          children: title
        }),
        jsx('div', {
          key: 'content',
          className: 'flex-1 overflow-y-auto td-scroll font-mono ' + fontSizeClass,
          style: { maxHeight: maxHeight + 'px', padding: '12px 16px', lineHeight: '1.8' },
          children: lineElements
        })
      ]
    });
  }

  // ── ConfigPanel ──
  function ConfigPanel(props) {
    var config = props.config || {};
    var onChange = props.onChange || function () {};

    var titleSt = React.useState(config.title || 'Text Display');
    var title = titleSt[0], setTitle = titleSt[1];
    var mhSt = React.useState(config.maxHeight || 300);
    var maxH = mhSt[0], setMaxH = mhSt[1];
    var fsSt = React.useState(config.fontSize || 'medium');
    var fs = fsSt[0], setFs = fsSt[1];
    var hlSt = React.useState(config.highlightNumbers !== false);
    var hl = hlSt[0], setHl = hlSt[1];

    var fsOptions = [
      { v: 'small', l: 'Small' },
      { v: 'medium', l: 'Medium' },
      { v: 'large', l: 'Large' }
    ];

    return jsxs('div', { className: 'flex flex-col gap-3 p-3', children: [
      jsxs('div', { key: 't', className: 'flex flex-col gap-1.5', children: [
        jsx('span', { className: 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground', children: 'Title' }),
        jsx('input', {
          type: 'text', value: title,
          onChange: function (e) { setTitle(e.target.value); onChange('title', e.target.value); },
          className: 'text-[11px] bg-transparent border-b border-border text-foreground px-1 py-0.5 focus:outline-none focus:border-foreground transition-colors'
        })
      ]}),
      jsxs('div', { key: 'mh', className: 'flex flex-col gap-1.5', children: [
        jsx('span', { className: 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground', children: 'Max Height (px)' }),
        jsx('input', {
          type: 'number', value: maxH,
          onChange: function (e) { var v = parseInt(e.target.value) || 300; setMaxH(v); onChange('maxHeight', v); },
          className: 'text-[11px] bg-transparent border-b border-border text-foreground px-1 py-0.5 focus:outline-none focus:border-foreground transition-colors'
        })
      ]}),
      jsxs('div', { key: 'fs', className: 'flex flex-col gap-1.5', children: [
        jsx('span', { className: 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground', children: 'Font Size' }),
        jsxs('div', { className: 'flex gap-1', children:
          fsOptions.map(function (opt) {
            return jsx('button', {
              className: 'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ' + (fs === opt.v ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted'),
              onClick: function () { setFs(opt.v); onChange('fontSize', opt.v); },
              children: opt.l
            }, opt.v);
          })
        })
      ]}),
      jsxs('div', { key: 'hl', className: 'flex items-center gap-2', children: [
        jsx('input', {
          type: 'checkbox', checked: hl,
          onChange: function () { var nv = !hl; setHl(nv); onChange('highlightNumbers', nv); },
          className: 'accent-foreground w-3.5 h-3.5'
        }),
        jsx('span', { className: 'text-[11px] text-muted-foreground', children: 'Highlight Numbers' })
      ]})
    ]});
  }

  return { default: TextDisplay, TextDisplay: TextDisplay, ConfigPanel: ConfigPanel };
})();
