var NE101CameraPanel = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Format a metric value for display */
  function formatValue(val, metric) {
    if (val == null) return '--';
    var dt = (metric && metric.data_type) || '';
    if (dt === 'Integer') return typeof val === 'number' ? Math.round(val).toLocaleString() : String(val);
    if (dt === 'Float') return typeof val === 'number' ? val.toFixed(1) : String(val);
    return String(val);
  }

  /** Get unit string for a metric */
  function unitStr(metric) {
    return metric && metric.unit ? ' ' + metric.unit : '';
  }

  /** Battery color based on level */
  function batteryMeta(level) {
    if (level == null) return { bar: 'bg-muted', text: 'text-muted-foreground' };
    if (level > 60) return { bar: 'bg-success', text: 'text-success' };
    if (level > 20) return { bar: 'bg-warning', text: 'text-warning' };
    return { bar: 'bg-error', text: 'text-error' };
  }

  /** Time ago */
  function timeAgo(iso) {
    if (!iso) return '--';
    var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ---------------------------------------------------------------------------
  // Icons (inline SVG)
  // ---------------------------------------------------------------------------

  function CameraIcon(props) {
    return jsx('svg', {
      xmlns: 'http://www.w3.org/2000/svg', width: props.size || 24, height: props.size || 24,
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
      strokeLinecap: 'round', strokeLinejoin: 'round', className: props.className || '',
      children: jsxs('g', { children: [
        jsx('path', { d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z' }),
        jsx('circle', { cx: 12, cy: 13, r: 3 })
      ]})
    });
  }

  function ImageOffIcon(props) {
    return jsx('svg', {
      xmlns: 'http://www.w3.org/2000/svg', width: props.size || 24, height: props.size || 24,
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
      strokeLinecap: 'round', strokeLinejoin: 'round', className: props.className || '',
      children: jsxs('g', { children: [
        jsx('line', { x1: 2, y1: 2, x2: 22, y2: 22 }),
        jsx('path', { d: 'M10.41 10.41a2 2 0 1 1-2.83-2.83' }),
        jsx('line', { x1: 13.5, y1: 13.5, x2: 17, y2: 17' }),
        jsx('path', { d: 'M2 12.1A15.3 15.3 0 0 1 5.59 7.4' }),
        jsx('path', { d: 'M8.08 5.08A15.3 15.3 0 0 1 12 4c5.18 0 9.41 3.32 10 8.1' }),
        jsx('path', { d: 'M19.41 16.59A15.3 15.3 0 0 1 12 20c-1.1 0-2.17-.16-3.18-.46' }),
        jsx('path', { d: 'M2 16.1a15.3 15.3 0 0 0 1.59 1.31' })
      ]})
    });
  }

  // ---------------------------------------------------------------------------
  // Sub-components
  // ---------------------------------------------------------------------------

  /** Status dot */
  function StatusDot(props) {
    var on = props.online;
    return jsxs('div', {
      className: 'flex items-center gap-1.5',
      children: [
        jsx('div', {
          className: 'h-1.5 w-1.5 rounded-full ' + (on ? 'bg-success' : 'bg-muted-foreground'),
          style: on ? { boxShadow: '0 0 4px oklch(0.72 0.19 155)' } : {}
        }),
        jsx('span', { className: 'text-[10px] font-medium ' + (on ? 'text-success' : 'text-muted-foreground'), children: on ? 'Online' : 'Offline' })
      ]
    });
  }

  /** Battery bar — accepts raw level value */
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

  /** Metric row: label + value */
  function MetricRow(props) {
    return jsxs('div', { className: 'flex items-center justify-between py-0.5', children: [
      jsx('span', { className: 'text-[10px] text-muted-foreground truncate mr-2', children: props.label }),
      jsxs('span', { className: 'text-xs font-mono tabular-nums text-foreground flex-shrink-0', children: [
        props.value,
        jsx('span', { className: 'text-[10px] text-muted-foreground ml-0.5', children: props.unit })
      ]})
    ]});
  }

  /** Command button */
  function CommandButton(props) {
    var sending = props.sending;
    return jsx('button', {
      className: 'flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium ' +
        'bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50',
      onClick: props.onClick,
      disabled: sending,
      children: sending ? 'Sending...' : props.label
    });
  }

  /** Image area — the main capture display */
  function CaptureDisplay(props) {
    var src = props.src;
    var online = props.online;

    if (!src) {
      return jsxs('div', {
        className: 'flex-1 flex flex-col items-center justify-center rounded-lg bg-muted-30 min-h-0 overflow-hidden',
        children: [
          jsx(ImageOffIcon, { size: 28, className: 'text-muted-foreground mb-2' }),
          jsx('span', { className: 'text-[10px] text-muted-foreground', children: online ? 'Waiting for capture...' : 'Device offline' })
        ]
      });
    }

    return jsx('div', {
      className: 'flex-1 rounded-lg overflow-hidden bg-black min-h-0',
      children: jsx('img', {
        src: src,
        alt: 'Latest capture',
        className: 'w-full h-full object-contain',
        loading: 'lazy'
      })
    });
  }

  /** No device bound */
  function NoDevice() {
    return jsxs('div', {
      className: 'flex flex-col items-center justify-center h-full w-full p-4 text-center',
      children: [
        jsx(CameraIcon, { size: 32, className: 'text-muted-foreground mb-3' }),
        jsx('p', { className: 'text-sm text-muted-foreground font-medium', children: 'NE101 Camera' }),
        jsx('p', { className: 'text-[10px] text-muted-foreground mt-1', children: 'Bind a device in config panel' })
      ]
    });
  }

  // ---------------------------------------------------------------------------
  // Main Component
  // ---------------------------------------------------------------------------

  function NE101CameraPanel(props) {
    var config = props.config || {};
    var showMetrics = config.showMetrics !== false;
    var showCommands = config.showCommands !== false;

    var deviceCtx = props.deviceContext;
    var device = deviceCtx && deviceCtx.device;
    var deviceType = deviceCtx && deviceCtx.deviceType;
    var sendCmd = props.sendDeviceCommand;

    // Command sending state
    var cmdState = React.useState({});
    var cmdLoading = cmdState[0];
    var setCmdLoading = cmdState[1];

    // --- No device ---
    if (!device) return jsx(NoDevice, {});

    // --- Extract device data ---
    var vals = device.currentValues || {};
    var online = device.status === 'online';

    // Find special metrics
    var batteryVal = vals['values.battery'] != null ? vals['values.battery'] : vals['battery'];
    var devName = vals['values.devName'] || vals['devName'] || device.name;

    // Find image URL — look for common image metric names
    var imageSrc = vals['values.imageUrl'] || vals['values.image'] || vals['imageUrl'] || vals['image'] || vals['values.photo'] || vals['photo'] || null;

    // Get metrics definition (exclude battery which is shown separately, and internal fields)
    var metrics = (deviceType && deviceType.metrics) || [];
    var displayMetrics = [];
    for (var i = 0; i < metrics.length; i++) {
      var m = metrics[i];
      // Skip battery (shown as bar), image (shown as capture), timestamp-like
      var n = m.name.toLowerCase();
      if (n === 'ts' || n === 'timestamp' || n === 'time') continue;
      if (n === 'values.battery' || n === 'battery') continue;
      if (n.indexOf('image') >= 0 || n.indexOf('photo') >= 0 || n.indexOf('picture') >= 0) continue;
      if (n === 'values.devname' || n === 'devname') continue;
      displayMetrics.push(m);
    }

    // Get commands
    var commands = (deviceType && deviceType.commands) || [];

    // --- Render ---
    return jsxs('div', {
      className: 'flex flex-col h-full w-full p-2.5 gap-2',
      children: [
        // === Header ===
        jsxs('div', {
          className: 'flex items-center justify-between flex-shrink-0',
          children: [
            jsxs('div', { className: 'flex items-center gap-2 min-w-0', children: [
              jsx('div', {
                className: 'flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md bg-accent-cyan-light',
                children: jsx(CameraIcon, { size: 14, className: 'text-accent-cyan' })
              }),
              jsxs('div', { className: 'min-w-0', children: [
                jsx('p', { className: 'text-xs font-semibold text-foreground truncate', children: devName }),
                jsx('p', { className: 'text-[10px] text-muted-foreground', children: timeAgo(device.lastSeen) })
              ]})
            ]}),
            jsx(StatusDot, { online: online })
          ]
        }),

        // === Main capture image ===
        jsx(CaptureDisplay, { src: imageSrc, online: online }),

        // === Metrics panel ===
        showMetrics
          ? jsxs('div', { className: 'flex-shrink-0 space-y-1.5', children: [
              // Battery bar (always show for NE101)
              jsx(BatteryBar, { level: batteryVal }),
              // Other metrics from device type
              displayMetrics.length > 0
                ? jsx('div', { className: 'border-t border-border pt-1', children:
                    displayMetrics.map(function (m) {
                      var v = vals[m.name];
                      return jsx(MetricRow, {
                        label: m.display_name || m.name,
                        value: formatValue(v, m),
                        unit: unitStr(m).trim()
                      }, m.name);
                    })
                  })
                : null
            ]})
          : null,

        // === Command buttons ===
        showCommands && commands.length > 0
          ? jsx('div', {
              className: 'flex gap-1.5 flex-shrink-0 flex-wrap',
              children: commands.map(function (cmd) {
                var isLoading = !!cmdLoading[cmd.name];
                return jsx(CommandButton, {
                  label: cmd.display_name || cmd.name,
                  sending: isLoading,
                  onClick: function () {
                    if (!sendCmd || isLoading) return;
                    setCmdLoading(function (prev) { var n = {}; n[cmd.name] = true; return Object.assign({}, prev, n); });
                    sendCmd(cmd.name).then(function () {
                      setCmdLoading(function (prev) { var n = {}; n[cmd.name] = false; return Object.assign({}, prev, n); });
                    }).catch(function () {
                      setCmdLoading(function (prev) { var n = {}; n[cmd.name] = false; return Object.assign({}, prev, n); });
                    });
                  }
                }, cmd.name);
              })
            })
          : null,

        // === Footer ===
        jsxs('div', {
          className: 'flex items-center justify-between flex-shrink-0 pt-0.5',
          children: [
            jsx('span', { className: 'text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent-cyan-light text-accent-cyan', children: 'NE101' }),
            jsx('span', { className: 'text-[10px] text-muted-foreground', children: device.id })
          ]
        })
      ]
    });
  }

  return { default: NE101CameraPanel, NE101CameraPanel: NE101CameraPanel };
})();
