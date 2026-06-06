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

  // --- Three.js dynamic loader (IIFE/UMD from jsDelivr, NOT ESM) ---
  var THREE_VERSION = '0.169.0';
  var THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@' + THREE_VERSION;

  var loadScript = function (url) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + url + '"]');
      if (existing) { resolve(); return; }
      var script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Failed to load: ' + url)); };
      document.head.appendChild(script);
    });
  };

  var loadThreeJS = function () {
    return loadScript(THREE_CDN + '/build/three.min.js').then(function () {
      return Promise.all([
        loadScript(THREE_CDN + '/examples/js/controls/OrbitControls.js'),
        loadScript(THREE_CDN + '/examples/js/loaders/GLTFLoader.js')
      ]);
    });
  };

  // --- Scene creation ---
  var createScene = function (container, bgColor) {
    var THREE = window.THREE;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor || '#111827');

    var w = container.offsetWidth;
    var h = container.offsetHeight;
    var camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(3, 2, 3);

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    var raycaster = new THREE.Raycaster();

    return {
      scene: scene,
      camera: camera,
      renderer: renderer,
      controls: controls,
      raycaster: raycaster,
      container: container
    };
  };

  // --- Model loading ---
  var loadModel = function (sceneHandle, urlOrFile) {
    var THREE = window.THREE;
    var loader = new THREE.GLTFLoader();

    var loadPromise;
    if (typeof urlOrFile === 'string') {
      loadPromise = new Promise(function (resolve, reject) {
        loader.load(urlOrFile, resolve, undefined, reject);
      });
    } else {
      loadPromise = new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) {
          loader.parse(e.target.result, '', resolve, reject);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(urlOrFile);
      });
    }

    return loadPromise.then(function (gltf) {
      var model = gltf.scene;
      sceneHandle.scene.add(model);

      var box = new THREE.Box3().setFromObject(model);
      var center = box.getCenter(new THREE.Vector3());
      var size = box.getSize(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z);
      var distance = maxDim * 2;

      sceneHandle.camera.position.set(
        center.x + distance * 0.7,
        center.y + distance * 0.5,
        center.z + distance * 0.7
      );
      sceneHandle.controls.target.copy(center);
      sceneHandle.controls.update();

      return model;
    });
  };

  // --- Scene cleanup ---
  var disposeScene = function (sceneHandle) {
    if (!sceneHandle) return;
    if (sceneHandle.frameId) cancelAnimationFrame(sceneHandle.frameId);
    sceneHandle.scene.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(function (m) { m.dispose(); });
        } else {
          obj.material.dispose();
        }
      }
    });
    sceneHandle.renderer.dispose();
    if (sceneHandle.renderer.domElement.parentNode) {
      sceneHandle.renderer.domElement.parentNode.removeChild(sceneHandle.renderer.domElement);
    }
  };

  // --- 3D Pin creation ---
  var createPin3D = function (position, normal, type) {
    var THREE = window.THREE;
    var offset = normal.clone().multiplyScalar(0.01);
    var pinPos = position.clone().add(offset);

    var geometry = new THREE.SphereGeometry(0.03, 16, 16);
    var colorHex = PinColors[type] ? PinColors[type].three : PinColors.metric.three;
    var material = new THREE.MeshBasicMaterial({ color: colorHex });
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pinPos);
    mesh.userData.pinType = type;

    return mesh;
  };

  // --- Raycasting click handler ---
  var createClickHandler = function (sceneHandle, model, callback) {
    var THREE = window.THREE;
    return function (event) {
      var rect = sceneHandle.renderer.domElement.getBoundingClientRect();
      var mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      sceneHandle.raycaster.setFromCamera(mouse, sceneHandle.camera);
      var intersects = sceneHandle.raycaster.intersectObject(model, true);
      if (intersects.length > 0) {
        var hit = intersects[0];
        var normal = hit.face.normal.clone();
        normal.transformDirection(hit.object.matrixWorld);
        callback(hit.point, normal);
      }
    };
  };

  // --- 3D to 2D screen projection ---
  var projectToScreen = function (position3D, camera, width, height) {
    var projected = position3D.clone().project(camera);
    return {
      x: (projected.x + 1) / 2 * width,
      y: (-projected.y + 1) / 2 * height,
      behind: projected.z > 1
    };
  };

  // --- PinPopup Component ---
  var PinPopup = function (props) {
    var pin = props.pin;
    var onClick = props.onClick;
    var popupRef = props.popupRef;
    var isSmall = props.isSmall || false;
    var pc = PinColors[pin.type] || PinColors.metric;

    // When small, show only dot (no label)
    if (isSmall) {
      return jsx('div', {
        ref: function (el) { if (popupRef) popupRef.current[pin.id] = el; },
        className: 'absolute pointer-events-auto cursor-pointer',
        style: { transform: 'translate(-50%, -50%)', zIndex: 10, display: 'none' },
        onClick: function (e) { e.stopPropagation(); onClick(pin.id); },
        children: jsx('div', {
          className: 'w-2 h-2 rounded-full flex-shrink-0',
          style: { backgroundColor: 'var(--color-' + (pin.type === 'annotation' ? 'warning' : pin.type === 'command' ? 'accent-purple' : pin.type) + ')' }
        })
      });
    }

    return jsx('div', {
      ref: function (el) { if (popupRef) popupRef.current[pin.id] = el; },
      className: 'absolute pointer-events-auto cursor-pointer',
      style: { transform: 'translate(-50%, -130%)', zIndex: 10, display: 'none' },
      onClick: function (e) { e.stopPropagation(); onClick(pin.id); },
      children: jsxs('div', {
        className: 'flex items-center gap-1.5 px-2 py-1 rounded-md bg-card border border-glass-border shadow-lg',
        children: [
          jsx('div', {
            className: 'w-2 h-2 rounded-full flex-shrink-0',
            style: { backgroundColor: 'var(--color-' + (pin.type === 'annotation' ? 'warning' : pin.type === 'command' ? 'accent-purple' : pin.type) + ')' }
          }),
          jsx('span', { className: 'text-xs text-foreground whitespace-nowrap', children: pin.label || pin.type })
        ]
      })
    });
  };

  // --- Toolbar Component ---
  var Toolbar = function (props) {
    var editMode = props.editMode;
    var onToggleEdit = props.onToggleEdit;
    var activePinType = props.activePinType;
    var onSelectPinType = props.onSelectPinType;
    var onResetCamera = props.onResetCamera;
    var isSmall = props.isSmall || false;

    var pinTypes = ['metric', 'device', 'annotation', 'command'];
    var typeLabels = { metric: 'Metric', device: 'Device', annotation: 'Note', command: 'Cmd' };

    if (!editMode) {
      return jsxs('div', {
        className: 'absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-card border border-glass-border rounded-lg px-2.5 py-1.5',
        style: { zIndex: 40 },
        children: [
          jsx('button', {
            className: 'p-1.5 rounded-md hover:bg-muted text-muted-foreground',
            onClick: onToggleEdit,
            title: 'Edit pins',
            dangerouslySetInnerHTML: { __html: Icons.edit }
          }),
          jsx('button', {
            className: 'p-1.5 rounded-md hover:bg-muted text-muted-foreground',
            onClick: onResetCamera,
            title: 'Reset view',
            dangerouslySetInnerHTML: { __html: Icons.reset }
          }),
          jsx('button', {
            className: 'p-1.5 rounded-md hover:bg-muted text-muted-foreground',
            title: 'Fullscreen',
            dangerouslySetInnerHTML: { __html: Icons.fullscreen }
          })
        ]
      });
    }

    return jsxs('div', {
      className: 'absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 bg-card border border-accent-purple rounded-lg px-2 py-1.5',
      style: { zIndex: 40 },
      children: [
        pinTypes.map(function (t) {
          var isActive = activePinType === t;
          var pc = PinColors[t];
          return jsx('button', {
            className: 'flex items-center gap-1 px-2 py-1 rounded-md text-xs ' + (isActive ? pc.tw + ' bg-muted' : 'text-muted-foreground'),
            onClick: function () { onSelectPinType(t); },
            children: [
              jsx('span', { className: 'w-3 h-3 ' + pc.tw, dangerouslySetInnerHTML: { __html: Icons[t] } }),
              jsx('span', { children: typeLabels[t] })
            ]
          }, t);
        }),
        jsx('div', { className: 'w-px bg-glass-border mx-1' }),
        jsx('button', {
          className: 'px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted',
          onClick: onToggleEdit,
          children: 'Done'
        })
      ]
    });
  };

  // --- DetailCard Component ---
  var DetailCard = function (props) {
    var pin = props.pin;
    var value = props.value;
    var onAction = props.onAction;
    var onClose = props.onClose;
    var detailRef = props.detailRef;
    var pc = PinColors[pin.type] || PinColors.metric;

    var colorKey = pin.type === 'annotation' ? 'warning' : pin.type === 'command' ? 'accent-purple' : pin.type;

    var content = null;
    if (pin.type === 'metric') {
      content = jsxs('div', { children: [
        jsx('span', { className: 'text-4xl font-extralight text-foreground leading-none', children: value != null ? String(value) : '--' }),
        jsx('span', { className: 'text-base text-muted-foreground font-light ml-1', children: pin.label })
      ]});
    } else if (pin.type === 'device') {
      var online = value && value.status === 'online';
      content = jsxs('div', { className: 'flex items-center gap-2.5', children: [
        jsx('div', {
          className: 'w-2 h-2 rounded-full',
          style: { backgroundColor: online ? 'var(--color-success)' : 'var(--color-muted-foreground)' }
        }),
        jsx('span', { className: 'text-lg text-muted-foreground font-light', children: online ? 'Online' : 'Offline' })
      ]});
    } else if (pin.type === 'annotation') {
      content = jsx('div', {
        className: 'text-sm text-muted-foreground font-light leading-relaxed',
        children: pin.annotationText || 'No annotation'
      });
    } else if (pin.type === 'command') {
      content = jsx('div', { children:
        jsx('button', {
          className: 'w-9 h-9 rounded-full flex items-center justify-center',
          style: { backgroundColor: 'oklch(0.7 0.15 310 / 12%)', border: '1px solid oklch(0.7 0.15 310 / 25%)' },
          onClick: function (e) { e.stopPropagation(); onAction && onAction(pin); },
          dangerouslySetInnerHTML: { __html: Icons.play }
        })
      });
    }

    return jsx('div', {
      ref: function (el) { if (detailRef) detailRef.current[pin.id + '_detail'] = el; },
      className: 'absolute pointer-events-auto',
      style: { zIndex: 20, display: 'none' },
      children: jsxs('div', {
        className: 'rounded-2xl border border-glass-border shadow-xl overflow-hidden relative',
        style: {
          aspectRatio: '4/3', backgroundColor: 'var(--color-card)',
          padding: '20px 24px', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', minWidth: '200px'
        },
        children: [
          jsx('div', {
            style: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--color-' + colorKey + '), transparent)' }
          }),
          jsxs('div', { className: 'flex justify-between items-start', style: { position: 'relative', zIndex: 1 }, children: [
            jsx('span', { className: 'text-xs text-muted-foreground tracking-wide', children: pin.label }),
            jsx('div', { className: pc.tw, style: { width: 14, height: 14, opacity: 0.5 }, dangerouslySetInnerHTML: { __html: Icons[pin.type] } })
          ]}),
          jsx('div', { style: { position: 'relative', zIndex: 1 }, children: content }),
          jsx('button', {
            className: 'absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded',
            style: { zIndex: 2 },
            onClick: function (e) { e.stopPropagation(); onClose(); },
            dangerouslySetInnerHTML: { __html: Icons.close }
          })
        ]
      })
    });
  };

  // --- PinConfigPopover Component ---
  var PinConfigPopover = function (props) {
    var pin = props.pin;
    var onSave = props.onSave;
    var onCancel = props.onCancel;
    var popoverRef = props.popoverRef;

    var labelState = React.useState(pin.label || '');
    var label = labelState[0];
    var setLabel = labelState[1];

    var deviceIdState = React.useState(
      (pin.type === 'metric' && pin.metricRef) ? (pin.metricRef.deviceId || '') :
      (pin.type === 'device' && pin.deviceRef) ? (pin.deviceRef.deviceId || '') :
      (pin.type === 'command' && pin.commandRef) ? (pin.commandRef.deviceId || '') : ''
    );
    var deviceId = deviceIdState[0];
    var setDeviceId = deviceIdState[1];

    var metricKeyState = React.useState(
      (pin.type === 'metric' && pin.metricRef) ? (pin.metricRef.metricKey || '') : ''
    );
    var metricKey = metricKeyState[0];
    var setMetricKey = metricKeyState[1];

    var textState = React.useState(pin.annotationText || '');
    var text = textState[0];
    var setText = textState[1];

    var cmdKeyState = React.useState(
      (pin.type === 'command' && pin.commandRef) ? (pin.commandRef.commandKey || '') : ''
    );
    var cmdKey = cmdKeyState[0];
    var setCmdKey = cmdKeyState[1];

    var handleSave = function () {
      var updated = Object.assign({}, pin, { label: label });
      if (pin.type === 'metric') {
        updated.metricRef = { deviceType: '', metricKey: metricKey, deviceId: deviceId };
      } else if (pin.type === 'device') {
        updated.deviceRef = { deviceType: '', deviceId: deviceId };
      } else if (pin.type === 'annotation') {
        updated.annotationText = text;
      } else if (pin.type === 'command') {
        updated.commandRef = { deviceType: '', commandKey: cmdKey, deviceId: deviceId };
      }
      onSave(updated);
    };

    var fields = null;
    if (pin.type === 'metric') {
      fields = jsxs('div', { className: 'space-y-2', children: [
        jsx('input', { className: 'w-full h-8 px-2 rounded-md border border-input bg-background text-sm', placeholder: 'Device ID', value: deviceId, onChange: function (e) { setDeviceId(e.target.value); } }),
        jsx('input', { className: 'w-full h-8 px-2 rounded-md border border-input bg-background text-sm', placeholder: 'Metric key (e.g. values.temperature)', value: metricKey, onChange: function (e) { setMetricKey(e.target.value); } })
      ]});
    } else if (pin.type === 'device') {
      fields = jsx('input', { className: 'w-full h-8 px-2 rounded-md border border-input bg-background text-sm', placeholder: 'Device ID', value: deviceId, onChange: function (e) { setDeviceId(e.target.value); } });
    } else if (pin.type === 'annotation') {
      fields = jsx('textarea', { className: 'w-full h-16 px-2 py-1 rounded-md border border-input bg-background text-sm resize-none', placeholder: 'Annotation text...', value: text, onChange: function (e) { setText(e.target.value); } });
    } else if (pin.type === 'command') {
      fields = jsxs('div', { className: 'space-y-2', children: [
        jsx('input', { className: 'w-full h-8 px-2 rounded-md border border-input bg-background text-sm', placeholder: 'Device ID', value: deviceId, onChange: function (e) { setDeviceId(e.target.value); } }),
        jsx('input', { className: 'w-full h-8 px-2 rounded-md border border-input bg-background text-sm', placeholder: 'Command key', value: cmdKey, onChange: function (e) { setCmdKey(e.target.value); } })
      ]});
    }

    return jsx('div', {
      ref: function (el) { if (popoverRef) popoverRef.current[pin.id + '_config'] = el; },
      className: 'absolute pointer-events-auto',
      style: { zIndex: 30, display: 'none' },
      children: jsxs('div', {
        className: 'bg-card border border-glass-border rounded-xl shadow-xl p-3 space-y-2',
        style: { minWidth: '220px' },
        children: [
          jsx('p', { className: 'text-xs font-medium text-foreground', children: 'Configure ' + pin.type + ' pin' }),
          jsx('input', {
            className: 'w-full h-8 px-2 rounded-md border border-input bg-background text-sm',
            placeholder: 'Label',
            value: label,
            onChange: function (e) { setLabel(e.target.value); }
          }),
          fields,
          jsxs('div', { className: 'flex gap-2 justify-end pt-1', children: [
            jsx('button', {
              className: 'px-3 py-1 text-xs text-muted-foreground hover:bg-muted rounded-md',
              onClick: onCancel,
              children: 'Cancel'
            }),
            jsx('button', {
              className: 'px-3 py-1 text-xs text-primary-foreground rounded-md',
              style: { backgroundColor: 'var(--color-accent-purple)' },
              onClick: handleSave,
              children: 'Save'
            })
          ]})
        ]
      })
    });
  };

  // --- NeoMind API helpers ---
  var fetchPinData = function (pin) {
    var neomind = window.neomind;
    if (!neomind) return Promise.resolve(null);

    var deviceId = null;
    if (pin.type === 'metric' && pin.metricRef) {
      deviceId = pin.metricRef.deviceId;
    } else if (pin.type === 'device' && pin.deviceRef) {
      deviceId = pin.deviceRef.deviceId;
    }

    if (!deviceId) return Promise.resolve(null);

    return neomind.fetchDeviceValues(deviceId).then(function (v) {
      if (!v) return null;
      if (pin.type === 'metric' && pin.metricRef) {
        return v[pin.metricRef.metricKey];
      }
      return v;
    }).catch(function () { return null; });
  };

  var executeCommand = function (pin) {
    var neomind = window.neomind;
    if (!neomind || pin.type !== 'command' || !pin.commandRef) return;

    if (pin.commandRef.extensionId) {
      neomind.callExtension(
        pin.commandRef.extensionId,
        pin.commandRef.commandKey,
        pin.commandRef.params || {}
      );
    }
  };

  // --- Root Component (full Three.js lifecycle) ---
  function Model3DViewer(props) {
    var config = props.config || {};
    var modelUrl = config.modelUrl || '';

    var containerRef = React.useRef(null);
    var sceneHandleRef = React.useRef(null);
    var modelRef = React.useRef(null);

    var loadState = React.useState('idle');
    var setLoadState = loadState[1];
    var errorMsg = React.useState('');
    var setErrorMsg = errorMsg[1];
    var errorMsgValue = errorMsg[0];

    var bgColor = config.backgroundColor || '#111827';
    var autoRotate = config.autoRotate || false;

    // Responsive sizing state
    var sizeState = React.useState({ w: 0, h: 0 });
    var containerSize = sizeState[0];
    var setContainerSize = sizeState[1];
    var isSmall = containerSize.w > 0 && (containerSize.w < 300 || containerSize.h < 300);

    // Pin state
    var pinsState = React.useState(config.pins || []);
    var pins = pinsState[0];
    var setPins = pinsState[1];

    var editState = React.useState(false);
    var editMode = editState[0];
    var setEditMode = editState[1];

    var pinTypeState = React.useState('metric');
    var activePinType = pinTypeState[0];
    var setActivePinType = pinTypeState[1];

    var selectedPinState = React.useState(null);
    var selectedPinId = selectedPinState[0];
    var setSelectedPinId = selectedPinState[1];

    var configPinState = React.useState(null);
    var configuringPinId = configPinState[0];
    var setConfiguringPinId = configPinState[1];

    var pinValuesState = React.useState({});
    var pinValues = pinValuesState[0];
    var setPinValues = pinValuesState[1];

    // Refs for per-frame updates (mirrors of state, used in rAF loop)
    var popupRefs = React.useRef({});
    var pinMeshesRef = React.useRef({});
    var pinsRef = React.useRef(pins);
    var selectedPinIdRef = React.useRef(selectedPinId);
    var configuringPinIdRef = React.useRef(configuringPinId);

    // Refs synchronization
    React.useEffect(function () { pinsRef.current = pins; }, [pins]);
    React.useEffect(function () { selectedPinIdRef.current = selectedPinId; }, [selectedPinId]);
    React.useEffect(function () { configuringPinIdRef.current = configuringPinId; }, [configuringPinId]);

    // Drag-drop file upload
    React.useEffect(function () {
      var container = containerRef.current;
      if (!container) return;

      var handleDragOver = function (e) {
        e.preventDefault();
        e.stopPropagation();
      };

      var handleDrop = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var files = e.dataTransfer && e.dataTransfer.files;
        if (!files || files.length === 0) return;
        var file = files[0];
        var ext = file.name.toLowerCase();
        if (ext.endsWith('.glb') || ext.endsWith('.gltf')) {
          setLoadState('loading');
          loadThreeJS().then(function () {
            // Dispose existing scene
            disposeScene(sceneHandleRef.current);
            sceneHandleRef.current = null;
            modelRef.current = null;

            var sceneHandle = createScene(container, config.backgroundColor || '#111827');
            sceneHandleRef.current = sceneHandle;

            return loadModel(sceneHandle, file);
          }).then(function (model) {
            modelRef.current = model;
            setLoadState('loaded');
            // Start render loop
            function animate() {
              if (!sceneHandleRef.current) return;
              sceneHandleRef.current.frameId = requestAnimationFrame(animate);
              sceneHandleRef.current.controls.update();
              if (config.autoRotate) {
                sceneHandleRef.current.controls.autoRotate = true;
              }
              sceneHandleRef.current.renderer.render(sceneHandleRef.current.scene, sceneHandleRef.current.camera);

              // Per-frame pin DOM position updates
              var containerW = sceneHandleRef.current.container.offsetWidth;
              var containerH = sceneHandleRef.current.container.offsetHeight;
              var currentPins = pinsRef.current;
              for (var i = 0; i < currentPins.length; i++) {
                var pin = currentPins[i];
                var pinMesh = pinMeshesRef.current[pin.id];
                if (!pinMesh) continue;
                var screen = projectToScreen(pinMesh.position, sceneHandleRef.current.camera, containerW, containerH);
                var popupEl = popupRefs.current[pin.id];
                if (popupEl) {
                  popupEl.style.left = screen.x + 'px';
                  popupEl.style.top = screen.y + 'px';
                  popupEl.style.display = screen.behind ? 'none' : '';
                }
              }
            }
            animate();
          }).catch(function (err) {
            setErrorMsg(err.message || 'Failed to load model');
            setLoadState('error');
          });
        }
      };

      container.addEventListener('dragover', handleDragOver);
      container.addEventListener('drop', handleDrop);
      return function () {
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('drop', handleDrop);
      };
    }, []);

    // Periodic data refresh for metric and device pins
    React.useEffect(function () {
      var dataPins = pins.filter(function (p) {
        return p.type === 'metric' || p.type === 'device';
      });
      if (dataPins.length === 0) return;

      var interval = setInterval(function () {
        var promises = dataPins.map(function (pin) {
          return fetchPinData(pin).then(function (val) {
            return { id: pin.id, value: val };
          }).catch(function () {
            return { id: pin.id, value: null };
          });
        });

        Promise.all(promises).then(function (results) {
          var updated = {};
          results.forEach(function (r) { updated[r.id] = r.value; });
          setPinValues(function (prev) { return Object.assign({}, prev, updated); });
        });
      }, 5000);

      return function () { clearInterval(interval); };
    }, [pins]);

    // Handlers
    var toggleEdit = function () {
      var next = !editMode;
      setEditMode(next);
      if (!next && props.onConfigChange) {
        props.onConfigChange('pins', pins);
      }
    };

    var resetCamera = function () {
      var sceneHandle = sceneHandleRef.current;
      var model = modelRef.current;
      if (!sceneHandle || !model) return;
      var THREE = window.THREE;
      var box = new THREE.Box3().setFromObject(model);
      var center = box.getCenter(new THREE.Vector3());
      var size = box.getSize(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z);
      var distance = maxDim * 2;
      sceneHandle.camera.position.set(
        center.x + distance * 0.7,
        center.y + distance * 0.5,
        center.z + distance * 0.7
      );
      sceneHandle.controls.target.copy(center);
      sceneHandle.controls.update();
    };

    var handlePinConfigSave = function (updatedPin) {
      setPins(function (prev) {
        return prev.map(function (p) { return p.id === updatedPin.id ? updatedPin : p; });
      });
      setConfiguringPinId(null);
    };

    var handlePinConfigCancel = function () {
      setPins(function (prev) {
        var toRemove = prev.find(function (p) { return p.id === configuringPinId; });
        if (toRemove) {
          var mesh = pinMeshesRef.current[toRemove.id];
          if (mesh && sceneHandleRef.current) {
            sceneHandleRef.current.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
          }
          delete pinMeshesRef.current[toRemove.id];
        }
        return prev.filter(function (p) { return p.id !== configuringPinId; });
      });
      setConfiguringPinId(null);
    };

    // Refs for edit mode and active pin type (used in click handler)
    var editModeRef = React.useRef(editMode);
    React.useEffect(function () { editModeRef.current = editMode; }, [editMode]);
    var activePinTypeRef = React.useRef(activePinType);
    React.useEffect(function () { activePinTypeRef.current = activePinType; }, [activePinType]);

    // Click handler for pin placement
    React.useEffect(function () {
      var sceneHandle = sceneHandleRef.current;
      var model = modelRef.current;
      if (!sceneHandle || !model) return;

      var handleClick = function (event) {
        if (!editModeRef.current) return;

        var THREE = window.THREE;
        var rect = sceneHandle.renderer.domElement.getBoundingClientRect();
        var mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        sceneHandle.raycaster.setFromCamera(mouse, sceneHandle.camera);
        var intersects = sceneHandle.raycaster.intersectObject(model, true);
        if (intersects.length === 0) return;

        var hit = intersects[0];
        var normal = hit.face.normal.clone();
        normal.transformDirection(hit.object.matrixWorld);

        var id = 'pin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        var type = activePinTypeRef.current || 'metric';
        var pin3d = createPin3D(hit.point, normal, type);
        sceneHandle.scene.add(pin3d);
        pinMeshesRef.current[id] = pin3d;

        var newPin = {
          id: id,
          position: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
          normal: { x: normal.x, y: normal.y, z: normal.z },
          type: type,
          label: type.charAt(0).toUpperCase() + type.slice(1)
        };
        setPins(function (prev) { return prev.concat([newPin]); });
        setConfiguringPinId(id);
      };

      sceneHandle.renderer.domElement.addEventListener('click', handleClick);

      return function cleanup() {
        sceneHandle.renderer.domElement.removeEventListener('click', handleClick);
      };
    }, [modelRef.current]);

    // Model URL change handler (replaces old Three.js init)
    var prevModelUrlRef = React.useRef('');
    React.useEffect(function () {
      var url = config.modelUrl || '';
      if (url === prevModelUrlRef.current) return;
      prevModelUrlRef.current = url;

      if (!url) {
        // Clear scene
        disposeScene(sceneHandleRef.current);
        sceneHandleRef.current = null;
        modelRef.current = null;
        setLoadState('idle');
        // Clear pins
        Object.keys(pinMeshesRef.current).forEach(function (id) {
          var mesh = pinMeshesRef.current[id];
          if (mesh) { mesh.geometry.dispose(); mesh.material.dispose(); }
        });
        pinMeshesRef.current = {};
        setPins([]);
        return;
      }

      // Model URL changed — clear old pins if any exist
      if (pins.length > 0) {
        Object.keys(pinMeshesRef.current).forEach(function (id) {
          var mesh = pinMeshesRef.current[id];
          if (mesh && sceneHandleRef.current) { sceneHandleRef.current.scene.remove(mesh); }
          if (mesh) { mesh.geometry.dispose(); mesh.material.dispose(); }
        });
        pinMeshesRef.current = {};
        setPins([]);
      }

      setLoadState('loading');
      setErrorMsg('');

      loadThreeJS().then(function () {
        var container = containerRef.current;
        if (!container) return;

        // Dispose old scene if exists
        disposeScene(sceneHandleRef.current);

        var sceneHandle = createScene(container, config.backgroundColor || '#111827');
        sceneHandleRef.current = sceneHandle;

        if (autoRotate) {
          sceneHandle.controls.autoRotate = true;
          sceneHandle.controls.autoRotateSpeed = 2.0;
        }

        return loadModel(sceneHandle, url).then(function (model) {
          modelRef.current = model;
          setLoadState('loaded');

          // Restore pins from config
          var existingPins = config.pins || [];
          var THREE = window.THREE;
          existingPins.forEach(function (pin) {
            var pos = new THREE.Vector3(pin.position.x, pin.position.y, pin.position.z);
            var norm = new THREE.Vector3(pin.normal.x, pin.normal.y, pin.normal.z);
            var pin3d = createPin3D(pos, norm, pin.type);
            sceneHandleRef.current.scene.add(pin3d);
            pinMeshesRef.current[pin.id] = pin3d;
          });
          setPins(existingPins);

          // Start render loop
          function animate() {
            if (!sceneHandleRef.current) return;
            sceneHandleRef.current.frameId = requestAnimationFrame(animate);
            sceneHandleRef.current.controls.update();
            sceneHandleRef.current.renderer.render(sceneHandleRef.current.scene, sceneHandleRef.current.camera);
            // Pin DOM updates
            var containerW = sceneHandleRef.current.container.offsetWidth;
            var containerH = sceneHandleRef.current.container.offsetHeight;
            var currentPins = pinsRef.current;
            for (var i = 0; i < currentPins.length; i++) {
              var pin = currentPins[i];
              var pinMesh = pinMeshesRef.current[pin.id];
              if (!pinMesh) continue;
              var screen = projectToScreen(pinMesh.position, sceneHandleRef.current.camera, containerW, containerH);
              var popupEl = popupRefs.current[pin.id];
              if (popupEl) {
                popupEl.style.left = screen.x + 'px';
                popupEl.style.top = screen.y + 'px';
                popupEl.style.display = screen.behind ? 'none' : '';
              }
              // Update detail card position
              if (pin.id === selectedPinIdRef.current) {
                var detailEl = popupRefs.current[pin.id + '_detail'];
                if (detailEl) {
                  detailEl.style.left = (screen.x + 20) + 'px';
                  detailEl.style.top = (screen.y - 40) + 'px';
                  detailEl.style.display = screen.behind ? 'none' : '';
                }
              } else {
                var detailEl = popupRefs.current[pin.id + '_detail'];
                if (detailEl) detailEl.style.display = 'none';
              }
              // Update config popover position
              if (pin.id === configuringPinIdRef.current) {
                var configEl = popupRefs.current[pin.id + '_config'];
                if (configEl) {
                  configEl.style.left = (screen.x + 20) + 'px';
                  configEl.style.top = (screen.y - 20) + 'px';
                  configEl.style.display = screen.behind ? 'none' : '';
                }
              }
            }
          }
          animate();

          // ResizeObserver
          var observer = new ResizeObserver(function (entries) {
            if (!sceneHandleRef.current) return;
            var w = entries[0].contentRect.width;
            var h = entries[0].contentRect.height;
            sceneHandleRef.current.camera.aspect = w / h;
            sceneHandleRef.current.camera.updateProjectionMatrix();
            sceneHandleRef.current.renderer.setSize(w, h);
            // Update responsive sizing state
            setContainerSize({ w: w, h: h });
          });
          observer.observe(container);

          return { observer: observer, model: model };
        });
      }).catch(function (err) {
        setErrorMsg(err.message || 'Failed to load model');
        setLoadState('error');
      });

      return function cleanup() {
        if (sceneHandleRef.current) {
          disposeScene(sceneHandleRef.current);
          sceneHandleRef.current = null;
        }
      };
    }, [config.modelUrl, bgColor, autoRotate]);

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

    return jsxs('div', {
      ref: containerRef,
      className: 'relative w-full h-full overflow-hidden rounded-xl',
      children: [
        // Spinner keyframes animation
        jsx('style', { dangerouslySetInnerHTML: { __html: '@keyframes spin { to { transform: rotate(360deg) } }' } }),
        editMode ? jsx('div', {
          className: 'absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md text-xs',
          style: {
            zIndex: 40,
            backgroundColor: 'oklch(0.72 0.19 155 / 12%)',
            border: '1px solid oklch(0.72 0.19 155 / 40%)',
            color: 'var(--color-success)'
          },
          children: 'Click on the model to place a ' + activePinType + ' pin'
        }) : null,
        jsx(Toolbar, {
          editMode: editMode,
          onToggleEdit: toggleEdit,
          activePinType: activePinType,
          onSelectPinType: setActivePinType,
          onResetCamera: resetCamera,
          isSmall: isSmall
        }),
        loadState === 'loading' && jsx('div', {
          className: 'absolute inset-0 flex flex-col items-center justify-center rounded-xl',
          style: { backgroundColor: 'oklch(0.15 0.02 270 / 80%)', zIndex: 50 },
          children: jsxs('div', { className: 'text-center', children: [
            jsx('div', {
              className: 'w-8 h-8 border-2 rounded-full mx-auto',
              style: { borderTopColor: 'var(--color-info)', borderColor: 'var(--color-muted-foreground)', animation: 'spin 1s linear infinite' }
            }),
            jsx('p', { className: 'text-xs text-muted-foreground mt-2', children: 'Loading model...' })
          ]})
        }),
        loadState === 'error' && jsx('div', {
          className: 'absolute inset-0 flex flex-col items-center justify-center bg-card/90 z-10',
          children: jsxs('div', { className: 'text-center space-y-3', children: [
            jsx('p', { className: 'text-sm text-destructive', children: errorMsgValue || 'Failed to load model' }),
            jsx('button', {
              className: 'px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90',
              onClick: function () { window.location.reload(); },
              children: 'Retry'
            })
          ]})
        }),
        jsx('div', {
          className: 'absolute inset-0 pointer-events-none overflow-hidden',
          children: pins.map(function (pin) {
            return jsx(PinPopup, {
              key: pin.id,
              pin: pin,
              onClick: setSelectedPinId,
              popupRef: popupRefs,
              isSmall: isSmall
            });
          }).concat(
            selectedPinId && pins.find(function (p) { return p.id === selectedPinId; })
              ? [jsx(DetailCard, {
                  pin: pins.find(function (p) { return p.id === selectedPinId; }),
                  value: pinValues[selectedPinId],
                  onAction: executeCommand,
                  onClose: function () { setSelectedPinId(null); },
                  detailRef: popupRefs
                })]
              : []
          ).concat(
            configuringPinId && pins.find(function (p) { return p.id === configuringPinId; })
              ? [jsx(PinConfigPopover, {
                  pin: pins.find(function (p) { return p.id === configuringPinId; }),
                  onSave: handlePinConfigSave,
                  onCancel: handlePinConfigCancel,
                  popoverRef: popupRefs
                })]
              : []
          )
        })
      ]
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
