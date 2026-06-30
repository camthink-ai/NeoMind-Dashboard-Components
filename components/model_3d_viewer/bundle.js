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
  var THREE_VERSION = '0.147.0';
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
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    var ambient = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambient);
    var dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    var fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-3, 2, -5);
    scene.add(fillLight);

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

  // color helper for pin types
  var pinColorVar = function (type) {
    return type === 'annotation' ? 'var(--color-warning)' : type === 'command' ? 'var(--color-accent-purple)' : 'var(--color-' + type + ')';
  };

  // --- PinPopup Component (compact dot + tiny label) ---
  var PinPopup = function (props) {
    var pin = props.pin;
    var onClick = props.onClick;
    var popupRef = props.popupRef;
    var isSmall = props.isSmall || false;
    var onPointerDown = props.onPointerDown;

    var dotStyle = { width: 8, height: 8, borderRadius: '50%', backgroundColor: pinColorVar(pin.type) };
    var wrapStyle = { position: 'absolute', pointerEvents: 'auto', cursor: 'pointer', transform: 'translate(-50%, -50%)', zIndex: 10, display: 'none' };

    if (isSmall) {
      return jsx('div', {
        ref: function (el) { if (popupRef) popupRef.current[pin.id] = el; },
        style: wrapStyle,
        onClick: function (e) { e.stopPropagation(); onClick(pin.id); },
        onPointerDown: onPointerDown ? function (e) { onPointerDown(pin.id, e); } : undefined,
        children: jsx('div', { style: dotStyle })
      });
    }

    return jsx('div', {
      ref: function (el) { if (popupRef) popupRef.current[pin.id] = el; },
      style: Object.assign({}, wrapStyle, { transform: 'translate(-50%, -140%)' }),
      onClick: function (e) { e.stopPropagation(); onClick(pin.id); },
      onPointerDown: onPointerDown ? function (e) { onPointerDown(pin.id, e); } : undefined,
      children: jsxs('div', {
        style: { display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 6, backgroundColor: 'oklch(0.18 0.02 270 / 90%)', backdropFilter: 'blur(6px)', border: '1px solid oklch(0.4 0.02 270 / 30%)', whiteSpace: 'nowrap' },
        children: [
          jsx('div', { style: dotStyle }),
          jsx('span', { style: { fontSize: 11, color: 'oklch(0.85 0.02 270)' }, children: pin.label || pin.type })
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

    var btnBase = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', cursor: 'pointer', color: 'oklch(0.6 0.02 270)', background: 'transparent' };
    var iconWrap = function (svg) { return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">' + svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '') + '</svg>'; };

    if (!editMode) {
      return jsxs('div', {
        style: { position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1, borderRadius: 6, padding: '2px 3px', zIndex: 40, backgroundColor: 'oklch(0.15 0.02 270 / 60%)', backdropFilter: 'blur(6px)' },
        children: [
          jsx('button', {
            style: Object.assign({}, btnBase),
            onClick: onToggleEdit,
            title: 'Edit pins',
            onMouseEnter: function (e) { e.currentTarget.style.background = 'oklch(0.3 0.02 270)'; },
            onMouseLeave: function (e) { e.currentTarget.style.background = 'transparent'; },
            dangerouslySetInnerHTML: { __html: iconWrap(Icons.edit) }
          }),
          jsx('button', {
            style: Object.assign({}, btnBase),
            onClick: onResetCamera,
            title: 'Reset view',
            onMouseEnter: function (e) { e.currentTarget.style.background = 'oklch(0.3 0.02 270)'; },
            onMouseLeave: function (e) { e.currentTarget.style.background = 'transparent'; },
            dangerouslySetInnerHTML: { __html: iconWrap(Icons.reset) }
          }),
          jsx('button', {
            style: Object.assign({}, btnBase),
            title: 'Fullscreen',
            onMouseEnter: function (e) { e.currentTarget.style.background = 'oklch(0.3 0.02 270)'; },
            onMouseLeave: function (e) { e.currentTarget.style.background = 'transparent'; },
            dangerouslySetInnerHTML: { __html: iconWrap(Icons.fullscreen) }
          })
        ]
      });
    }

    return jsxs('div', {
      style: { position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1, borderRadius: 6, padding: '2px 3px', zIndex: 40, backgroundColor: 'oklch(0.15 0.02 270 / 60%)', backdropFilter: 'blur(6px)', border: '1px solid oklch(0.55 0.2 310 / 30%)' },
      children: [
        pinTypes.map(function (t) {
          var isActive = activePinType === t;
          var activeBg = isActive ? 'oklch(0.3 0.02 270)' : 'transparent';
          var hue = t === 'metric' ? 200 : t === 'device' ? 155 : t === 'annotation' ? 85 : 310;
          return jsx('button', {
            style: Object.assign({}, btnBase, isActive ? { background: activeBg, color: 'oklch(0.85 0.08 ' + hue + ')' } : {}),
            onClick: function () { onSelectPinType(t); },
            title: typeLabels[t],
            onMouseEnter: function (e) { e.currentTarget.style.background = 'oklch(0.3 0.02 270)'; },
            onMouseLeave: function (e) { e.currentTarget.style.background = activeBg; },
            dangerouslySetInnerHTML: { __html: iconWrap(Icons[t]) }
          }, t);
        }),
        jsx('div', { style: { width: 1, height: 16, alignSelf: 'center', margin: '0 1px', backgroundColor: 'oklch(0.4 0.02 270)' } }),
        jsx('button', {
          style: Object.assign({}, btnBase, { width: 'auto', padding: '0 6px', fontSize: 10 }),
          onClick: onToggleEdit,
          onMouseEnter: function (e) { e.currentTarget.style.background = 'oklch(0.3 0.02 270)'; },
          onMouseLeave: function (e) { e.currentTarget.style.background = 'transparent'; },
          children: 'Done'
        })
      ]
    });
  };

  // --- DetailCard Component (compact 4:3 card) ---
  var DetailCard = function (props) {
    var pin = props.pin;
    var value = props.value;
    var onAction = props.onAction;
    var onClose = props.onClose;
    var detailRef = props.detailRef;
    var colorKey = pin.type === 'annotation' ? 'warning' : pin.type === 'command' ? 'accent-purple' : pin.type;

    var cardInner = { backgroundColor: 'oklch(0.18 0.02 270 / 92%)', backdropFilter: 'blur(8px)', borderRadius: 10, border: '1px solid oklch(0.4 0.02 270 / 30%)', overflow: 'hidden', position: 'relative', width: 160, aspectRatio: '4/3', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px 12px' };

    var content = null;
    if (pin.type === 'metric') {
      content = jsxs('div', { children: [
        jsx('span', { style: { fontSize: 28, fontWeight: 200, color: 'oklch(0.95 0.02 270)', lineHeight: 1 }, children: value != null ? String(value) : '--' }),
        jsx('span', { style: { fontSize: 11, color: 'oklch(0.6 0.02 270)', marginLeft: 4 }, children: pin.label })
      ]});
    } else if (pin.type === 'device') {
      var online = value && value.status === 'online';
      content = jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [
        jsx('div', { style: { width: 6, height: 6, borderRadius: '50%', backgroundColor: online ? 'var(--color-success)' : 'oklch(0.5 0.02 270)' } }),
        jsx('span', { style: { fontSize: 13, color: 'oklch(0.7 0.02 270)' }, children: online ? 'Online' : 'Offline' })
      ]});
    } else if (pin.type === 'annotation') {
      content = jsx('div', {
        style: { fontSize: 12, color: 'oklch(0.7 0.02 270)', lineHeight: 1.5 },
        children: pin.annotationText || 'No annotation'
      });
    } else if (pin.type === 'command') {
      content = jsx('div', { children:
        jsx('button', {
          style: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid oklch(0.7 0.15 310 / 25%)', backgroundColor: 'oklch(0.7 0.15 310 / 12%)', cursor: 'pointer', color: 'oklch(0.75 0.12 310)' },
          onClick: function (e) { e.stopPropagation(); onAction && onAction(pin); },
          dangerouslySetInnerHTML: { __html: Icons.play }
        })
      });
    }

    return jsx('div', {
      ref: function (el) { if (detailRef) detailRef.current[pin.id + '_detail'] = el; },
      style: { position: 'absolute', pointerEvents: 'auto', zIndex: 20, display: 'none' },
      children: jsxs('div', {
        style: cardInner,
        children: [
          jsx('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--color-' + colorKey + '), transparent)' } }),
          jsxs('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }, children: [
            jsx('span', { style: { fontSize: 10, color: 'oklch(0.55 0.02 270)', letterSpacing: '0.05em' }, children: pin.label }),
            jsx('div', { style: { width: 12, height: 12, opacity: 0.5, color: pinColorVar(pin.type) }, dangerouslySetInnerHTML: { __html: Icons[pin.type] } })
          ]}),
          jsx('div', { style: { position: 'relative', zIndex: 1 }, children: content }),
          jsx('button', {
            style: { position: 'absolute', top: 4, right: 4, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.5 0.02 270)', cursor: 'pointer', border: 'none', background: 'none', borderRadius: 4, zIndex: 2 },
            onClick: function (e) { e.stopPropagation(); onClose(); },
            dangerouslySetInnerHTML: { __html: Icons.close }
          })
        ]
      })
    });
  };

  // --- PinConfigPopover Component (compact inline-style form) ---
  var inputStyle = { width: '100%', height: 26, padding: '0 6px', borderRadius: 4, border: '1px solid oklch(0.35 0.02 270)', backgroundColor: 'oklch(0.12 0.02 270)', color: 'oklch(0.85 0.02 270)', fontSize: 11, outline: 'none', boxSizing: 'border-box' };

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
      fields = jsxs('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [
        jsx('input', { style: inputStyle, placeholder: 'Device ID', value: deviceId, onChange: function (e) { setDeviceId(e.target.value); } }),
        jsx('input', { style: inputStyle, placeholder: 'Metric key', value: metricKey, onChange: function (e) { setMetricKey(e.target.value); } })
      ]});
    } else if (pin.type === 'device') {
      fields = jsx('input', { style: inputStyle, placeholder: 'Device ID', value: deviceId, onChange: function (e) { setDeviceId(e.target.value); } });
    } else if (pin.type === 'annotation') {
      fields = jsx('textarea', { style: Object.assign({}, inputStyle, { height: 40, padding: '4px 6px', resize: 'none' }), placeholder: 'Annotation text...', value: text, onChange: function (e) { setText(e.target.value); } });
    } else if (pin.type === 'command') {
      fields = jsxs('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [
        jsx('input', { style: inputStyle, placeholder: 'Device ID', value: deviceId, onChange: function (e) { setDeviceId(e.target.value); } }),
        jsx('input', { style: inputStyle, placeholder: 'Command key', value: cmdKey, onChange: function (e) { setCmdKey(e.target.value); } })
      ]});
    }

    return jsx('div', {
      ref: function (el) { if (popoverRef) popoverRef.current[pin.id + '_config'] = el; },
      style: { position: 'absolute', pointerEvents: 'auto', zIndex: 30, display: 'none' },
      children: jsxs('div', {
        style: { backgroundColor: 'oklch(0.18 0.02 270 / 95%)', backdropFilter: 'blur(8px)', border: '1px solid oklch(0.4 0.02 270 / 30%)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, width: 180 },
        children: [
          jsx('span', { style: { fontSize: 10, fontWeight: 600, color: 'oklch(0.7 0.02 270)', textTransform: 'capitalize' }, children: pin.type + ' pin' }),
          jsx('input', { style: inputStyle, placeholder: 'Label', value: label, onChange: function (e) { setLabel(e.target.value); } }),
          fields,
          jsxs('div', { style: { display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 2 }, children: [
            jsx('button', {
              style: { padding: '2px 8px', fontSize: 10, borderRadius: 4, border: 'none', cursor: 'pointer', color: 'oklch(0.6 0.02 270)', background: 'oklch(0.25 0.02 270)' },
              onClick: onCancel,
              children: 'Cancel'
            }),
            jsx('button', {
              style: { padding: '2px 8px', fontSize: 10, borderRadius: 4, border: 'none', cursor: 'pointer', color: 'oklch(0.95 0.08 310)', backgroundColor: 'var(--color-accent-purple)' },
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
    var loadStateValue = loadState[0];
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

    // Long-press drag info ref
    var dragInfoRef = React.useRef({ active: false, pinId: null, timer: null, startX: 0, startY: 0 });

    // ResizeObserver ref (used by both modelUrl and drag-drop load paths)
    var observerRef = React.useRef(null);

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
            // Disconnect existing ResizeObserver (e.g. from a previous drop)
            if (observerRef.current) {
              observerRef.current.disconnect();
              observerRef.current = null;
            }
            // Dispose existing scene
            disposeScene(sceneHandleRef.current);
            sceneHandleRef.current = null;
            modelRef.current = null;

            // A new model is being loaded — pin coordinates are model-specific
            // and cannot be reused, so clear any stale pin meshes/state from a
            // previous model (mirrors the modelUrl load path).
            Object.keys(pinMeshesRef.current).forEach(function (id) {
              var mesh = pinMeshesRef.current[id];
              if (mesh) { mesh.geometry.dispose(); mesh.material.dispose(); }
            });
            pinMeshesRef.current = {};
            setPins([]);

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

            // ResizeObserver — keep canvas in sync with grid-cell size
            // (mirrors the modelUrl load path; without this, resizing the
            //  dashboard block never calls renderer.setSize)
            observerRef.current = new ResizeObserver(function (entries) {
              if (!sceneHandleRef.current) return;
              var w = entries[0].contentRect.width;
              var h = entries[0].contentRect.height;
              if (!w || !h) return;
              sceneHandleRef.current.camera.aspect = w / h;
              sceneHandleRef.current.camera.updateProjectionMatrix();
              sceneHandleRef.current.renderer.setSize(w, h);
              setContainerSize({ w: w, h: h });
            });
            observerRef.current.observe(container);
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
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
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
      setEditMode(!editMode);
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

    // Long-press drag handlers
    var handlePinPointerDown = function (pinId, event) {
      event.stopPropagation();
      event.preventDefault();
      dragInfoRef.current.startX = event.clientX;
      dragInfoRef.current.startY = event.clientY;
      dragInfoRef.current.pinId = pinId;
      dragInfoRef.current.timer = setTimeout(function () {
        dragInfoRef.current.active = true;
        if (sceneHandleRef.current) sceneHandleRef.current.controls.enabled = false;
      }, 300);
    };

    var handlePointerMove = function (event) {
      var di = dragInfoRef.current;
      if (di.timer && !di.active) {
        var dx = event.clientX - di.startX;
        var dy = event.clientY - di.startY;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          clearTimeout(di.timer);
          di.timer = null;
        }
        return;
      }
      if (!di.active) return;

      var THREE = window.THREE;
      var sceneHandle = sceneHandleRef.current;
      var model = modelRef.current;
      if (!sceneHandle || !model) return;

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
        var offset = normal.clone().multiplyScalar(0.01);
        var newPos = hit.point.clone().add(offset);

        var mesh = pinMeshesRef.current[di.pinId];
        if (mesh) mesh.position.copy(newPos);

        var pinId = di.pinId;
        setPins(function (prev) {
          return prev.map(function (p) {
            if (p.id !== pinId) return p;
            return Object.assign({}, p, {
              position: { x: newPos.x, y: newPos.y, z: newPos.z },
              normal: { x: normal.x, y: normal.y, z: normal.z }
            });
          });
        });
      }
    };

    var handlePointerUp = function () {
      var di = dragInfoRef.current;
      clearTimeout(di.timer);
      if (di.active) {
        if (sceneHandleRef.current) sceneHandleRef.current.controls.enabled = true;
        if (props.onConfigChange) {
          props.onConfigChange('pins', pinsRef.current);
        }
      }
      dragInfoRef.current = { active: false, pinId: null, timer: null, startX: 0, startY: 0 };
    };

    // Keep latest pointer handlers in a ref so the window listeners (set up
    // once) always call the current closure. Listening on window (not the
    // container) guarantees pointerup/pointermove are caught even when the
    // pointer leaves the component during a long-press pin drag — otherwise
    // controls.enabled would stay false and the scene would freeze.
    var dragHandlersRef = React.useRef({ move: null, up: null });
    dragHandlersRef.current.move = handlePointerMove;
    dragHandlersRef.current.up = handlePointerUp;
    React.useEffect(function () {
      var onMove = function (e) { if (dragHandlersRef.current.move) dragHandlersRef.current.move(e); };
      var onUp = function (e) { if (dragHandlersRef.current.up) dragHandlersRef.current.up(e); };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      return function () {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
    }, []);

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
              // Clamp to container bounds
              var sx = Math.max(8, Math.min(screen.x, containerW - 8));
              var sy = Math.max(8, Math.min(screen.y, containerH - 8));
              var popupEl = popupRefs.current[pin.id];
              if (popupEl) {
                popupEl.style.left = sx + 'px';
                popupEl.style.top = sy + 'px';
                popupEl.style.display = screen.behind ? 'none' : '';
              }
              // Detail card — positioned right of pin, clamped
              var detailEl = popupRefs.current[pin.id + '_detail'];
              if (pin.id === selectedPinIdRef.current && detailEl) {
                var dx = Math.min(sx + 12, containerW - 170);
                var dy = Math.max(4, sy - 60);
                detailEl.style.left = dx + 'px';
                detailEl.style.top = dy + 'px';
                detailEl.style.display = screen.behind ? 'none' : '';
              } else if (detailEl) {
                detailEl.style.display = 'none';
              }
              // Config popover — positioned right of pin, clamped
              if (pin.id === configuringPinIdRef.current) {
                var configEl = popupRefs.current[pin.id + '_config'];
                if (configEl) {
                  var cx = Math.min(sx + 12, containerW - 190);
                  var cy = Math.max(4, sy - 30);
                  configEl.style.left = cx + 'px';
                  configEl.style.top = cy + 'px';
                  configEl.style.display = screen.behind ? 'none' : '';
                }
              }
            }
          }
          animate();

          // ResizeObserver — store in observerRef so cleanup can disconnect it
          if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
          observerRef.current = new ResizeObserver(function (entries) {
            if (!sceneHandleRef.current) return;
            var w = entries[0].contentRect.width;
            var h = entries[0].contentRect.height;
            if (!w || !h) return;
            sceneHandleRef.current.camera.aspect = w / h;
            sceneHandleRef.current.camera.updateProjectionMatrix();
            sceneHandleRef.current.renderer.setSize(w, h);
            // Update responsive sizing state
            setContainerSize({ w: w, h: h });
          });
          observerRef.current.observe(container);
        });
      }).catch(function (err) {
        setErrorMsg(err.message || 'Failed to load model');
        setLoadState('error');
      });

      return function cleanup() {
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
        if (sceneHandleRef.current) {
          disposeScene(sceneHandleRef.current);
          sceneHandleRef.current = null;
        }
      };
    }, [config.modelUrl]);

    // React to background color changes without reloading model
    React.useEffect(function () {
      var handle = sceneHandleRef.current;
      if (!handle) return;
      var THREE = window.THREE;
      var color = config.backgroundColor || '#111827';
      handle.scene.background = new THREE.Color(color);
    }, [bgColor]);

    // React to autoRotate / editMode changes
    React.useEffect(function () {
      var handle = sceneHandleRef.current;
      if (!handle) return;
      handle.controls.autoRotate = autoRotate && !editMode;
      handle.controls.autoRotateSpeed = 2.0;
    }, [autoRotate, editMode]);

    return jsxs('div', {
      ref: containerRef,
      className: 'relative w-full h-full overflow-hidden rounded-xl',
      children: [
        jsx('style', { dangerouslySetInnerHTML: { __html: '@keyframes spin { to { transform: rotate(360deg) } }' } }),
        // Empty state — no model loaded yet via either path (URL or drag-drop)
        loadStateValue !== 'loaded' && !modelUrl && jsx('div', {
          className: 'absolute inset-0 flex flex-col items-center justify-center',
          children: jsxs('div', {
            className: 'text-center space-y-4 px-6',
            children: [
              jsx('div', {
                className: 'w-16 h-16 mx-auto rounded-2xl flex items-center justify-center',
                style: { backgroundColor: 'oklch(0.55 0.15 250 / 10%)', border: '1px dashed oklch(0.55 0.15 250 / 30%)' },
                dangerouslySetInnerHTML: { __html: Icons.upload }
              }),
              jsxs('div', { children: [
                jsx('p', { className: 'text-sm font-medium text-foreground', children: 'No 3D Model' }),
                jsx('p', { className: 'text-xs text-muted-foreground mt-1', children: 'Configure a GLTF/GLB URL or drag & drop a file' })
              ]})
            ]
          })
        }),
        // Edit mode indicator
        editMode && loadStateValue === 'loaded' ? jsx('div', {
          className: 'absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md text-xs',
          style: {
            zIndex: 40,
            backgroundColor: 'oklch(0.72 0.19 155 / 12%)',
            border: '1px solid oklch(0.72 0.19 155 / 40%)',
            color: 'var(--color-success)'
          },
          children: 'Click on the model to place a ' + activePinType + ' pin'
        }) : null,
        // Toolbar (compact buttons)
        loadStateValue === 'loaded' ? jsx(Toolbar, {
          editMode: editMode,
          onToggleEdit: toggleEdit,
          activePinType: activePinType,
          onSelectPinType: setActivePinType,
          onResetCamera: resetCamera,
          isSmall: isSmall
        }) : null,
        // Loading overlay
        loadStateValue === 'loading' && jsx('div', {
          style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'oklch(0.15 0.02 270 / 80%)', zIndex: 50 },
          children: jsxs('div', { style: { textAlign: 'center' }, children: [
            jsx('div', {
              style: { width: 40, height: 40, borderWidth: 3, borderStyle: 'solid', borderRadius: '50%', borderTopColor: 'var(--color-info)', borderRightColor: 'var(--color-info)', borderColor: 'oklch(0.3 0.02 270)', animation: 'spin 0.8s linear infinite', margin: '0 auto' }
            }),
            jsx('p', { style: { marginTop: 12, fontSize: 14, color: 'oklch(0.7 0.02 270)' }, children: 'Loading 3D Model...' })
          ]})
        }),
        // Error overlay — backdrop is click-through so it doesn't block the
        // dashboard's top-right edit/delete chrome; only the Retry card captures.
        loadStateValue === 'error' && jsx('div', {
          className: 'absolute inset-0 flex flex-col items-center justify-center',
          style: { backgroundColor: 'oklch(0.15 0.02 270 / 90%)', zIndex: 50, pointerEvents: 'none' },
          children: jsxs('div', { className: 'text-center space-y-2', style: { pointerEvents: 'auto' }, children: [
            jsx('p', { className: 'text-sm text-error', children: errorMsgValue || 'Failed to load model' }),
            jsx('button', {
              className: 'px-3 py-1 text-xs rounded-md',
              style: { backgroundColor: 'var(--color-info)', color: 'var(--color-primary-foreground)' },
              onClick: function () {
                setLoadState('idle');
                prevModelUrlRef.current = '';
              },
              children: 'Retry'
            })
          ]})
        }),
        // Pin overlay
        jsx('div', {
          className: 'absolute inset-0 pointer-events-none overflow-hidden',
          children: pins.map(function (pin) {
            return jsx(PinPopup, {
              key: pin.id,
              pin: pin,
              onClick: setSelectedPinId,
              popupRef: popupRefs,
              isSmall: isSmall,
              onPointerDown: handlePinPointerDown
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

    var exportPins = function () {
      var json = JSON.stringify(config.pins || [], null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '3d-viewer-pins.json';
      a.click();
      URL.revokeObjectURL(url);
    };

    var importPins = function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var imported = JSON.parse(ev.target.result);
          if (Array.isArray(imported)) onChange('pins', imported);
        } catch (err) { /* ignore */ }
      };
      reader.readAsText(file);
    };

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
      ]}),
      jsxs('div', { className: 'flex gap-2 pt-2 border-t border-glass-border', children: [
        jsx('button', {
          className: 'flex-1 h-8 text-xs border border-input rounded-md text-muted-foreground hover:bg-muted',
          onClick: exportPins,
          children: 'Export Pins'
        }),
        jsxs('label', {
          className: 'flex-1 h-8 text-xs border border-input rounded-md text-muted-foreground hover:bg-muted flex items-center justify-center cursor-pointer',
          children: [
            'Import Pins',
            jsx('input', { type: 'file', accept: '.json', className: 'hidden', onChange: importPins })
          ]
        })
      ]})
    ]});
  }

  return {
    default: Model3DViewer,
    Model3DViewer: Model3DViewer,
    ConfigPanel: ConfigPanel
  };
})();
