var Model3DViewer = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  // --- SVG Icons (inline, no emoji) ---
  var Icons = {
    metric: '<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="currentColor"/><path d="M10 22V14L14 18L18 10L22 16V22" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    device: '<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="currentColor"/><rect x="10" y="12" width="12" height="8" rx="1.5" stroke="#fff" stroke-width="1.8"/><line x1="16" y1="20" x2="16" y2="23" stroke="#fff" stroke-width="1.8"/><line x1="12" y1="23" x2="20" y2="23" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
    annotation: '<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="currentColor"/><path d="M12 10h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-3l-3 2.5V22h-2a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1z" stroke="#fff" stroke-width="1.8"/><line x1="14" y1="14" x2="18" y2="14" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><line x1="14" y1="17" x2="17" y2="17" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>',
    command: '<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="currentColor"/><path d="M13 11l5 5-5 5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
  };

  // Color tokens for pin types (semantic design tokens, Three.js hex fallbacks for 3D meshes)
  var PinColors = {
    metric: { three: 0x34d399, tw: 'text-success', twBg: 'bg-success' },
    device: { three: 0x60a5fa, tw: 'text-info', twBg: 'bg-info' },
    annotation: { three: 0xfbbf24, tw: 'text-warning', twBg: 'bg-warning' },
    command: { three: 0xc084fc, tw: 'text-accent-purple', twBg: 'bg-accent-purple-light' }
  };

  // --- Root Component (shell — will be expanded in later tasks) ---
  function Model3DViewer(props) {
    var config = props.config || {};
    var modelUrl = config.modelUrl || '';

    if (!modelUrl) {
      return jsx('div', {
        className: 'flex flex-col items-center justify-center h-full w-full bg-card border border-glass-border rounded-xl select-none',
        children: jsxs('div', {
          className: 'text-center space-y-3',
          children: [
            jsx('div', {
              className: 'w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center',
              style: { color: 'var(--color-muted-foreground)' },
              dangerouslySetInnerHTML: { __html: Icons.upload }
            }),
            jsx('p', { className: 'text-sm text-muted-foreground', children: 'Configure a model URL to get started' })
          ]
        })
      });
    }

    return jsx('div', {
      className: 'flex items-center justify-center h-full w-full bg-card border border-glass-border rounded-xl select-none',
      children: jsx('p', { className: 'text-sm text-muted-foreground', children: '3D Viewer loading...' })
    });
  }

  // --- Config Panel ---
  function ConfigPanel(props) {
    var config = props.config || {};
    var onChange = props.onChange;

    return jsxs('div', { className: 'space-y-3', children: [
      jsxs('div', { children: [
        jsx('label', { className: 'text-sm font-medium', children: 'Model File URL' }),
        jsx('input', {
          type: 'text',
          className: 'w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1',
          placeholder: 'https://example.com/model.glb',
          value: config.modelUrl || '',
          onChange: function (e) { onChange('modelUrl', e.target.value); }
        }),
        jsx('p', { className: 'text-xs text-muted-foreground mt-1', children: 'GLTF or GLB file URL' })
      ]}),
      jsxs('div', { children: [
        jsx('label', { className: 'text-sm font-medium', children: 'Scene Background' }),
        jsx('input', {
          type: 'text',
          className: 'w-full h-9 px-3 rounded-md border border-input bg-background text-sm mt-1',
          placeholder: '#111827',
          value: config.backgroundColor || '',
          onChange: function (e) { onChange('backgroundColor', e.target.value); }
        })
      ]}),
      jsxs('div', { className: 'flex items-center gap-2', children: [
        jsx('input', {
          type: 'checkbox',
          checked: config.autoRotate || false,
          onChange: function (e) { onChange('autoRotate', e.target.checked); }
        }),
        jsx('label', { className: 'text-sm', children: 'Auto Rotate' })
      ]})
    ]});
  }

  return {
    default: Model3DViewer,
    Model3DViewer: Model3DViewer,
    ConfigPanel: ConfigPanel
  };
})();
