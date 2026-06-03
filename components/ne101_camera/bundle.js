var NE101CameraPanel = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  // Helpers
  function batteryMeta(level) {
    if (level == null) return { bar: 'rgba(128,128,128,0.3)' };
    if (level > 60) return { bar: 'rgba(34,197,94,0.8)' };
    if (level > 20) return { bar: 'rgba(234,179,8,0.8)' };
    return { bar: 'rgba(239,68,68,0.8)' };
  }

  function formatValue(val, metric) {
    if (val == null) return '--';
    var dt = (metric && metric.data_type) || '';
    if (dt === 'Integer') return typeof val === 'number' ? Math.round(val).toLocaleString() : String(val);
    if (dt === 'Float') return typeof val === 'number' ? val.toFixed(1) : String(val);
    return String(val);
  }

  function unitStr(metric) {
    return metric && metric.unit ? ' ' + metric.unit : '';
  }

  function timeAgo(iso) {
    if (!iso) return '--';
    var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getVal(obj, key) {
    if (!obj) return undefined;
    if (obj[key] !== undefined) return obj[key];
    var parts = key.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function getFirst(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = getVal(obj, keys[i]);
      if (v != null && v !== '') return v;
    }
    return null;
  }

  // Inline style constants — no dependency on Tailwind color classes
  var white = { color: '#fff' };
  var white80 = { color: 'rgba(255,255,255,0.85)' };
  var white60 = { color: 'rgba(255,255,255,0.6)' };
  var white50 = { color: 'rgba(255,255,255,0.5)' };
  var textShadow = { textShadow: '0 1px 3px rgba(0,0,0,0.8)' };

  // Location pin SVG icon
  function PinIcon() {
    return jsx('svg', {
      width: '12', height: '12', viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round',
      style: { flexShrink: '0' },
      children: jsx('path', { d: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z' })
    });
  }

  // No device placeholder
  function NoDevice() {
    return jsxs('div', {
      className: 'flex flex-col items-center justify-center h-full w-full p-4 text-center border border-border rounded-lg',
      children: [
        jsx('div', { key: 'icon', className: 'w-10 h-10 rounded-lg flex items-center justify-center mb-3', style: { background: 'rgba(255,255,255,0.1)' }, children:
          jsx('span', { style: Object.assign({}, white, { fontSize: '14px', fontWeight: '700' }), children: 'CAM' })
        }),
        jsx('p', { key: 'title', style: Object.assign({}, white, { fontSize: '14px', fontWeight: '500' }), children: 'NE101 Camera' }),
        jsx('p', { key: 'hint', style: Object.assign({}, white60, { fontSize: '10px', marginTop: '4px' }), children: 'Bind a device in config panel' })
      ]
    });
  }

  // Main Component — image-centric layout
  function NE101CameraPanel(props) {
    var config = props.config || {};
    var showCommands = config.showCommands !== false;
    // Read location title from multiple possible sources
    var location = config.location || config.title || config.displayTitle || props.title || '';

    var deviceCtx = props.deviceContext;
    var device = deviceCtx && deviceCtx.device;
    var deviceType = deviceCtx && deviceCtx.deviceType;
    var sendCmd = props.sendDeviceCommand;

    var cmdState = React.useState({});
    var cmdLoading = cmdState[0];
    var setCmdLoading = cmdState[1];

    if (!device) return jsx(NoDevice, {});

    var vals = device.currentValues || {};
    var online = device.status === 'online';
    var batteryVal = getFirst(vals, ['values.battery', 'battery']);
    var devName = device.name || getFirst(vals, ['values.devName', 'devName']) || 'NE101 Camera';
    var imageSrc = getFirst(vals, ['values.imageUrl', 'values.image', 'values.photo', 'imageUrl', 'image', 'photo', 'values.picture', 'picture']);

    var metrics = (deviceType && deviceType.metrics) || [];
    var displayMetrics = [];
    for (var i = 0; i < metrics.length; i++) {
      var m = metrics[i];
      var n = (m.name || '').toLowerCase();
      if (n === 'ts' || n === 'timestamp' || n === 'time') continue;
      if (n === 'values.battery' || n === 'battery') continue;
      if (n.indexOf('image') >= 0 || n.indexOf('photo') >= 0 || n.indexOf('picture') >= 0) continue;
      if (n === 'values.devname' || n === 'devname') continue;
      displayMetrics.push(m);
    }

    var commands = (deviceType && deviceType.commands) || [];
    var bm = batteryMeta(batteryVal);
    var batteryPct = batteryVal != null ? Math.max(0, Math.min(100, batteryVal)) : 0;
    var hasImage = !!imageSrc;

    // Badge/chip background styles
    var bgChipStyle = { background: 'rgba(255,255,255,0.2)' };
    var bgBadgeStyle = { background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' };
    var bgMetricStyle = { background: 'rgba(255,255,255,0.1)' };

    // Build overlay badges for top-right
    var topRightBadges = [];
    topRightBadges.push(
      jsxs('div', {
        key: 'status',
        className: 'flex items-center gap-1 px-1.5 py-0.5 rounded-md',
        style: Object.assign({}, bgBadgeStyle, textShadow),
        children: [
          jsx('div', {
            key: 'dot',
            className: 'h-1.5 w-1.5 rounded-full',
            style: { background: online ? 'rgba(34,197,94,1)' : 'rgba(128,128,128,0.6)', boxShadow: online ? '0 0 4px rgba(34,197,94,0.6)' : 'none' }
          }),
          jsx('span', {
            key: 'label',
            style: Object.assign({}, white, { fontSize: '9px', fontWeight: '500' }),
            children: online ? 'Online' : 'Offline'
          })
        ]
      })
    );
    topRightBadges.push(
      jsxs('div', {
        key: 'bat',
        className: 'flex items-center gap-1 px-1.5 py-0.5 rounded-md',
        style: Object.assign({}, bgBadgeStyle, textShadow),
        children: [
          jsx('div', { key: 'bar', className: 'w-6 h-2.5 rounded-sm overflow-hidden', style: { background: 'rgba(128,128,128,0.3)' }, children:
            jsx('div', { style: { height: '100%', borderRadius: '2px', background: bm.bar, width: batteryPct + '%' } })
          }),
          jsx('span', { key: 'pct', style: Object.assign({}, white, { fontSize: '9px', fontFamily: 'monospace', fontWeight: '600' }), children: (batteryVal != null ? batteryVal : '--') + '%' })
        ]
      })
    );

    // Build bottom overlay: name + last seen + metrics + commands
    var bottomChildren = [];

    bottomChildren.push(
      jsxs('div', { key: 'info', className: 'flex items-center justify-between', children: [
        jsxs('div', { className: 'flex items-center gap-1.5 min-w-0', children: [
          jsx('span', { style: Object.assign({}, white, bgChipStyle, { fontSize: '9px', fontWeight: '500', padding: '2px 4px', borderRadius: '4px' }), children: 'NE101' }),
          jsx('span', { className: 'truncate', style: Object.assign({}, white, textShadow, { fontSize: '10px', fontWeight: '600' }), children: devName })
        ]}),
        jsx('span', { className: 'flex-shrink-0', style: Object.assign({}, white60, textShadow, { fontSize: '9px' }), children: timeAgo(device.lastSeen) })
      ]})
    );

    if (displayMetrics.length > 0) {
      var metricBadges = displayMetrics.slice(0, 4).map(function (m) {
        var v = getVal(vals, m.name);
        var displayVal = formatValue(v, m);
        var u = unitStr(m).trim();
        return jsxs('span', {
          key: m.name,
          className: 'px-1.5 py-0.5 rounded',
          style: Object.assign({}, white80, bgMetricStyle, textShadow, { fontSize: '9px', fontFamily: 'monospace' }),
          children: [
            jsx('span', { style: Object.assign({}, white50, { marginRight: '2px' }), children: (m.display_name || m.name).substring(0, 6) }),
            displayVal + (u ? ' ' + u : '')
          ]
        });
      });
      bottomChildren.push(
        jsx('div', { key: 'metrics', className: 'flex gap-1 flex-wrap', children: metricBadges })
      );
    }

    if (showCommands && commands.length > 0) {
      var cmdButtons = commands.slice(0, 4).map(function (cmd) {
        var isLoading = !!cmdLoading[cmd.name];
        return jsx('button', {
          key: cmd.name,
          style: Object.assign({}, white, bgChipStyle, textShadow, { fontSize: '9px', fontWeight: '500', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1 }),
          onClick: function () {
            if (!sendCmd || isLoading) return;
            setCmdLoading(function (prev) { var u = {}; u[cmd.name] = true; return Object.assign({}, prev, u); });
            sendCmd(cmd.name).then(function () {
              setCmdLoading(function (prev) { var u = {}; u[cmd.name] = false; return Object.assign({}, prev, u); });
            }).catch(function () {
              setCmdLoading(function (prev) { var u = {}; u[cmd.name] = false; return Object.assign({}, prev, u); });
            });
          },
          disabled: isLoading,
          children: isLoading ? '...' : (cmd.display_name || cmd.name)
        });
      });
      bottomChildren.push(
        jsx('div', { key: 'cmds', className: 'flex gap-1 flex-wrap', children: cmdButtons })
      );
    }

    return jsxs('div', {
      className: 'relative h-full w-full overflow-hidden border border-border rounded-lg',
      style: { background: '#000' },
      children: [
        // Full-bleed image or placeholder
        hasImage
          ? jsxs('div', {
              key: 'media',
              className: 'relative w-full h-full',
              children: [
                jsx('img', {
                  src: imageSrc,
                  alt: 'Latest capture',
                  className: 'w-full h-full object-cover',
                  loading: 'lazy',
                  style: { imageRendering: 'auto' }
                }),
                jsx('div', {
                  key: 'scrim',
                  className: 'absolute inset-0',
                  style: { background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.45) 100%)' }
                })
              ]
            })
          : jsxs('div', {
              key: 'media',
              className: 'w-full h-full flex flex-col items-center justify-center',
              style: { background: 'rgba(128,128,128,0.15)' },
              children: [
                jsx('div', { key: 'icon', className: 'w-10 h-10 rounded-lg flex items-center justify-center mb-2', style: { background: 'rgba(255,255,255,0.1)' }, children:
                  jsx('span', { style: Object.assign({}, white, { fontSize: '12px', fontWeight: '700' }), children: 'CAM' })
                }),
                jsx('span', { key: 'hint', style: Object.assign({}, white60, { fontSize: '10px' }), children: online ? 'Waiting for capture...' : 'Device offline' })
              ]
            }),

        // Top-right badges (status + battery) — always overlay
        jsxs('div', {
          key: 'overlay-top',
          className: 'absolute flex gap-1',
          style: { top: '8px', right: '8px' },
          children: topRightBadges
        }),

        // Top-left location title
        location ? jsxs('div', {
          key: 'location',
          className: 'absolute flex items-center gap-1.5',
          style: Object.assign({}, bgBadgeStyle, textShadow, { top: '8px', left: '8px', padding: '3px 8px', borderRadius: '6px', maxWidth: '65%' }),
          children: [
            jsx('span', { style: Object.assign({}, white60, { display: 'flex', alignItems: 'center' }), children: jsx(PinIcon, {}) }),
            jsx('span', { className: 'truncate', style: Object.assign({}, white, { fontSize: '11px', fontWeight: '600', letterSpacing: '0.2px' }), children: location })
          ]
        }) : null,

        // Bottom overlay bar — gradient fade
        jsx('div', {
          key: 'overlay-bottom',
          className: 'absolute bottom-0 left-0 right-0',
          style: { background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 70%, transparent 100%)' },
          children: jsx('div', {
            className: 'space-y-1',
            style: { padding: '32px 10px 8px 10px' },
            children: bottomChildren
          })
        })
      ]
    });
  }

  return { default: NE101CameraPanel, NE101CameraPanel: NE101CameraPanel };
})();
