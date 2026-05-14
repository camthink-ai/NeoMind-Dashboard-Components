var NE101CameraPanel = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  // Helpers
  function batteryMeta(level) {
    if (level == null) return { bar: 'bg-muted', text: 'text-muted-foreground' };
    if (level > 60) return { bar: 'bg-success', text: 'text-success' };
    if (level > 20) return { bar: 'bg-warning', text: 'text-warning' };
    return { bar: 'bg-error', text: 'text-error' };
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

  // No device placeholder
  function NoDevice() {
    return jsxs('div', {
      className: 'flex flex-col items-center justify-center h-full w-full p-4 text-center',
      children: [
        jsx('div', { key: 'icon', className: 'w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3', children:
          jsx('span', { className: 'text-sm font-bold text-muted-foreground', children: 'CAM' })
        }),
        jsx('p', { key: 'title', className: 'text-sm text-muted-foreground font-medium', children: 'NE101 Camera' }),
        jsx('p', { key: 'hint', className: 'text-[10px] text-muted-foreground mt-1', children: 'Bind a device in config panel' })
      ]
    });
  }

  // Main Component — image-centric layout
  function NE101CameraPanel(props) {
    var config = props.config || {};
    var showCommands = config.showCommands !== false;

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

    // Color scheme: white on image, dark on placeholder
    var tc = hasImage ? 'text-white' : 'text-foreground';
    var tcSub = hasImage ? 'text-white/60' : 'text-muted-foreground';
    var tcVal = hasImage ? 'text-white/80' : 'text-foreground';
    var tcLabel = hasImage ? 'text-white/50' : 'text-muted-foreground';
    var bgChip = hasImage ? 'bg-white/20' : 'bg-muted';
    var bgChipHover = hasImage ? 'bg-white/30' : 'bg-accent';
    var bgBadge = hasImage ? 'bg-black/40 backdrop-blur-sm' : 'bg-muted-30';
    var bgMetric = hasImage ? 'bg-white/10' : 'bg-muted-30';

    // Build overlay badges for top-right
    var topRightBadges = [];
    topRightBadges.push(
      jsx('div', {
        className: 'flex items-center gap-1 px-1.5 py-0.5 rounded-md ' + bgBadge,
        children: [
          jsx('div', {
            className: 'h-1.5 w-1.5 rounded-full ' + (online ? 'bg-success' : 'bg-muted-foreground'),
            style: online ? { boxShadow: '0 0 4px oklch(0.72 0.19 155)' } : {}
          }),
          jsx('span', {
            className: 'text-[9px] font-medium ' + (online ? 'text-success' : 'text-muted-foreground'),
            children: online ? 'Online' : 'Offline'
          })
        ]
      }, 'status')
    );
    topRightBadges.push(
      jsxs('div', {
        className: 'flex items-center gap-1 px-1.5 py-0.5 rounded-md ' + bgBadge,
        children: [
          jsx('div', { className: 'w-6 h-2.5 rounded-sm bg-muted-30 overflow-hidden', children:
            jsx('div', { className: 'h-full rounded-sm ' + bm.bar, style: { width: batteryPct + '%' } })
          }),
          jsx('span', { className: 'text-[9px] font-mono font-semibold tabular-nums ' + (hasImage ? 'text-white' : bm.text), children: (batteryVal != null ? batteryVal : '--') + '%' })
        ]
      }, 'bat')
    );

    // Build bottom overlay: name + last seen + metrics + commands
    var bottomChildren = [];

    bottomChildren.push(
      jsxs('div', { className: 'flex items-center justify-between', children: [
        jsxs('div', { className: 'flex items-center gap-1.5 min-w-0', children: [
          jsx('span', { className: 'text-[9px] font-medium px-1 py-0.5 rounded ' + bgChip + ' ' + tc, children: 'NE101' }),
          jsx('span', { className: 'text-[10px] font-semibold ' + tc + ' truncate', children: devName })
        ]}),
        jsx('span', { className: 'text-[9px] ' + tcSub + ' flex-shrink-0', children: timeAgo(device.lastSeen) })
      ]}, 'info')
    );

    if (displayMetrics.length > 0) {
      var metricBadges = displayMetrics.slice(0, 4).map(function (m) {
        var v = getVal(vals, m.name);
        var displayVal = formatValue(v, m);
        var u = unitStr(m).trim();
        return jsxs('span', {
          className: 'text-[9px] font-mono tabular-nums ' + tcVal + ' ' + bgMetric + ' px-1.5 py-0.5 rounded',
          children: [
            jsx('span', { className: tcLabel + ' mr-0.5', children: (m.display_name || m.name).substring(0, 6) }),
            displayVal + (u ? ' ' + u : '')
          ]
        }, m.name);
      });
      bottomChildren.push(
        jsx('div', { className: 'flex gap-1 flex-wrap', children: metricBadges }, 'metrics')
      );
    }

    if (showCommands && commands.length > 0) {
      var cmdButtons = commands.slice(0, 4).map(function (cmd) {
        var isLoading = !!cmdLoading[cmd.name];
        return jsx('button', {
          className: 'text-[9px] font-medium px-2 py-1 rounded ' + bgChip + ' ' + tc + ' hover:' + bgChipHover + ' transition-colors disabled:opacity-50',
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
        }, cmd.name);
      });
      bottomChildren.push(
        jsx('div', { className: 'flex gap-1 flex-wrap', children: cmdButtons }, 'cmds')
      );
    }

    return jsxs('div', {
      className: 'relative h-full w-full overflow-hidden bg-black',
      children: [
        // Full-bleed image or placeholder
        hasImage
          ? jsx('img', {
              src: imageSrc,
              alt: 'Latest capture',
              className: 'w-full h-full object-cover',
              loading: 'lazy',
              style: { imageRendering: 'auto' }
            }, 'media')
          : jsxs('div', {
              className: 'w-full h-full flex flex-col items-center justify-center bg-muted-30',
              children: [
                jsx('div', { className: 'w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center mb-2', children:
                  jsx('span', { className: 'text-xs font-bold text-muted-foreground', children: 'CAM' })
                }),
                jsx('span', { className: 'text-[10px] text-muted-foreground', children: online ? 'Waiting for capture...' : 'Device offline' })
              ]
            }, 'media'),

        // Top-right badges (status + battery) — always overlay
        jsxs('div', {
          className: 'absolute top-2 right-2 flex gap-1',
          children: topRightBadges
        }, 'overlay-top'),

        // Bottom overlay bar — gradient fade (dark on image, light on placeholder)
        jsx('div', {
          className: 'absolute bottom-0 left-0 right-0',
          style: hasImage
            ? { background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)' }
            : { background: 'linear-gradient(to top, rgba(0,0,0,0.05) 0%, transparent 100%)' },
          children: jsx('div', {
            className: 'px-2.5 pb-2 pt-8 space-y-1',
            children: bottomChildren.map(function (child) {
              // When no image, use dark text instead of white
              if (!hasImage && child && child.props && child.props.children) {
                return child;
              }
              return child;
            })
          })
        }, 'overlay-bottom')
      ]
    });
  }

  return { default: NE101CameraPanel, NE101CameraPanel: NE101CameraPanel };
})();
