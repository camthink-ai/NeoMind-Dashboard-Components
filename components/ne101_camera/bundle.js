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

  // Sub-components
  function StatusDot(props) {
    var on = props.online;
    return jsxs('div', {
      className: 'flex items-center gap-1.5',
      children: [
        jsx('div', {
          className: 'h-1.5 w-1.5 rounded-full ' + (on ? 'bg-success' : 'bg-muted-foreground'),
          style: on ? { boxShadow: '0 0 4px oklch(0.72 0.19 155)' } : {}
        }),
        jsx('span', {
          className: 'text-[10px] font-medium ' + (on ? 'text-success' : 'text-muted-foreground'),
          children: on ? 'Online' : 'Offline'
        })
      ]
    });
  }

  function BatteryBar(props) {
    var level = props.level;
    var bm = batteryMeta(level);
    var pct = level != null ? Math.max(0, Math.min(100, level)) : 0;
    return jsxs('div', { className: 'space-y-0.5', children: [
      jsxs('div', { className: 'flex justify-between items-center', children: [
        jsx('span', { className: 'text-[10px] text-muted-foreground', children: 'Battery' }),
        jsx('span', { className: 'text-xs font-mono font-semibold tabular-nums ' + bm.text, children: (level != null ? level : '--') + '%' })
      ]}),
      jsx('div', { className: 'h-1.5 bg-muted-30 rounded-full overflow-hidden', children:
        jsx('div', { className: 'h-full rounded-full transition-all duration-500 ' + bm.bar, style: { width: pct + '%' } })
      })
    ]});
  }

  function MetricRow(props) {
    return jsxs('div', { className: 'flex items-center justify-between py-0.5', children: [
      jsx('span', { className: 'text-[10px] text-muted-foreground truncate mr-2', children: props.label }),
      jsxs('span', { className: 'text-xs font-mono tabular-nums text-foreground flex-shrink-0', children: [
        props.value,
        jsx('span', { className: 'text-[10px] text-muted-foreground ml-0.5', children: props.unit })
      ]})
    ]});
  }

  function CommandButton(props) {
    return jsx('button', {
      className: 'flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium ' +
        'bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50',
      onClick: props.onClick,
      disabled: props.sending,
      children: props.sending ? 'Sending...' : props.label
    });
  }

  function CaptureDisplay(props) {
    if (!props.src) {
      return jsxs('div', {
        className: 'flex-1 flex flex-col items-center justify-center rounded-lg bg-muted-30 min-h-0',
        children: [
          jsx('div', { className: 'w-7 h-7 rounded-md bg-muted flex items-center justify-center mb-2', children:
            jsx('span', { className: 'text-xs text-muted-foreground', children: 'CAM' })
          }),
          jsx('span', { className: 'text-[10px] text-muted-foreground', children: props.online ? 'Waiting for capture...' : 'Device offline' })
        ]
      });
    }
    return jsx('div', {
      className: 'flex-1 rounded-lg overflow-hidden bg-black min-h-0',
      children: jsx('img', { src: props.src, alt: 'Latest capture', className: 'w-full h-full object-contain', loading: 'lazy' })
    });
  }

  function NoDevice() {
    return jsxs('div', {
      className: 'flex flex-col items-center justify-center h-full w-full p-4 text-center',
      children: [
        jsx('div', { className: 'w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3', children:
          jsx('span', { className: 'text-sm font-bold text-muted-foreground', children: 'CAM' })
        }),
        jsx('p', { className: 'text-sm text-muted-foreground font-medium', children: 'NE101 Camera' }),
        jsx('p', { className: 'text-[10px] text-muted-foreground mt-1', children: 'Bind a device in config panel' })
      ]
    });
  }

  // Main Component
  function NE101CameraPanel(props) {
    var config = props.config || {};
    var showMetrics = config.showMetrics !== false;
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
    var batteryVal = vals['values.battery'] != null ? vals['values.battery'] : vals['battery'];
    var devName = vals['values.devName'] || vals['devName'] || device.name;
    var imageSrc = vals['values.imageUrl'] || vals['values.image'] || vals['imageUrl'] || vals['image'] || vals['values.photo'] || vals['photo'] || null;

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

    // Build children array
    var children = [];

    // Header
    children.push(
      jsxs('div', { key: 'hdr', className: 'flex items-center justify-between flex-shrink-0', children: [
        jsxs('div', { className: 'flex items-center gap-2 min-w-0', children: [
          jsx('div', { className: 'flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md bg-accent-cyan-light', children:
            jsx('span', { className: 'text-[10px] font-bold text-accent-cyan', children: 'CAM' })
          }),
          jsxs('div', { className: 'min-w-0', children: [
            jsx('p', { className: 'text-xs font-semibold text-foreground truncate', children: devName }),
            jsx('p', { className: 'text-[10px] text-muted-foreground', children: timeAgo(device.lastSeen) })
          ]})
        ]}),
        jsx(StatusDot, { online: online })
      ]})
    );

    // Capture image
    children.push(jsx(CaptureDisplay, { key: 'img', src: imageSrc, online: online }));

    // Metrics
    if (showMetrics) {
      var metricChildren = [jsx(BatteryBar, { key: 'bat', level: batteryVal })];
      if (displayMetrics.length > 0) {
        var rows = displayMetrics.map(function (m) {
          var v = vals[m.name];
          return jsx(MetricRow, { label: m.display_name || m.name, value: formatValue(v, m), unit: unitStr(m).trim() }, m.name);
        });
        metricChildren.push(jsx('div', { key: 'extra', className: 'border-t border-border pt-1', children: rows }));
      }
      children.push(jsxs('div', { key: 'met', className: 'flex-shrink-0 space-y-1.5', children: metricChildren }));
    }

    // Commands
    if (showCommands && commands.length > 0) {
      children.push(jsx('div', {
        key: 'cmd',
        className: 'flex gap-1.5 flex-shrink-0 flex-wrap',
        children: commands.map(function (cmd) {
          var isLoading = !!cmdLoading[cmd.name];
          return jsx(CommandButton, {
            label: cmd.display_name || cmd.name,
            sending: isLoading,
            onClick: function () {
              if (!sendCmd || isLoading) return;
              setCmdLoading(function (prev) { var u = {}; u[cmd.name] = true; return Object.assign({}, prev, u); });
              sendCmd(cmd.name).then(function () {
                setCmdLoading(function (prev) { var u = {}; u[cmd.name] = false; return Object.assign({}, prev, u); });
              }).catch(function () {
                setCmdLoading(function (prev) { var u = {}; u[cmd.name] = false; return Object.assign({}, prev, u); });
              });
            }
          }, cmd.name);
        })
      }));
    }

    // Footer
    children.push(
      jsxs('div', { key: 'ftr', className: 'flex items-center justify-between flex-shrink-0 pt-0.5', children: [
        jsx('span', { className: 'text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent-cyan-light text-accent-cyan', children: 'NE101' }),
        jsx('span', { className: 'text-[10px] text-muted-foreground', children: device.id })
      ]})
    );

    return jsxs('div', { className: 'flex flex-col h-full w-full p-2.5 gap-2', children: children });
  }

  return { default: NE101CameraPanel, NE101CameraPanel: NE101CameraPanel };
})();
