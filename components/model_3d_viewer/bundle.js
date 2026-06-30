var Model3DViewer = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  // --- SVG Icons (inline, no emoji) ---
  // One consistent lucide-style set: 24x24 viewBox, stroke=currentColor,
  // strokeWidth 2, round caps/joins. Colored via `text-*` token classes.
  var iconInner = {
    metric: '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
    device: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    annotation: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    command: '<polyline points="9 18 15 12 9 6"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'
  };

  var Icon = function (name, className, size) {
    var s = size || 14;
    return jsx('svg', {
      viewBox: '0 0 24 24',
      width: s,
      height: s,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: className || '',
      dangerouslySetInnerHTML: { __html: iconInner[name] || '' }
    });
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

  // Memoize one in-flight <script> per URL so concurrent callers (e.g. two
  // 3D Viewer blocks mounting at once, or a remount) share the same load and
  // never resolve against a stale / failed / mid-load tag. Previously the
  // dedupe check resolved instantly on any existing tag, which let examples
  // execute before three.min.js had defined THREE (dynamic <script> tags are
  // async and run on download order, not insertion order) — leaving
  // THREE.OrbitControls undefined and crashing `new THREE.OrbitControls(...)`.
  // On error we clear the cached promise so a later call can retry.
  var scriptPromises = {};
  var loadScript = function (url) {
    if (scriptPromises[url]) return scriptPromises[url];
    scriptPromises[url] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = url;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        if (script.parentNode) script.parentNode.removeChild(script);
        scriptPromises[url] = null;
        reject(new Error('Failed to load: ' + url));
      };
      document.head.appendChild(script);
    });
    return scriptPromises[url];
  };

  var loadThreeJS = function () {
    return loadScript(THREE_CDN + '/build/three.min.js').then(function () {
      return Promise.all([
        loadScript(THREE_CDN + '/examples/js/controls/OrbitControls.js'),
        loadScript(THREE_CDN + '/examples/js/loaders/GLTFLoader.js')
      ]);
    }).then(function () {
      var THREE = window.THREE;
      if (!THREE || !THREE.OrbitControls || !THREE.GLTFLoader) {
        throw new Error('Three.js failed to initialize (controls/loader missing)');
      }
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

    var colorVar = pinColorVar(pin.type);
    var dotStyle = { width: 8, height: 8, borderRadius: '50%', backgroundColor: colorVar, boxShadow: '0 0 0 2px var(--color-background, #fff)' };
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
        className: 'flex items-center gap-1.5 px-2 py-1 rounded-md bg-popover border border-border shadow-md whitespace-nowrap',
        children: [
          jsx('div', { style: dotStyle }),
          jsx('span', { className: 'text-[11px] leading-none text-foreground', children: pin.label || pin.type })
        ]
      })
    });
  };

  // --- Toolbar Component ---
  // Positioning is inline (not Tailwind absolute/bottom/left/translate/z
  // utilities) because the dashboard's curated Tailwind build doesn't emit
  // those classes — relying on `bottom-1.5` etc. caused the whole bar to
  // collapse to its in-flow position at the top of the component.
  var Toolbar = function (props) {
    var editMode = props.editMode;
    var onToggleEdit = props.onToggleEdit;
    var activePinType = props.activePinType;
    var onSelectPinType = props.onSelectPinType;
    var onResetCamera = props.onResetCamera;
    var isSmall = props.isSmall || false;

    var pinTypes = ['metric', 'device', 'annotation', 'command'];
    var typeLabels = { metric: 'Metric', device: 'Device', annotation: 'Note', command: 'Cmd' };
    var typeColorClass = { metric: 'text-success', device: 'text-info', annotation: 'text-warning', command: 'text-accent-purple' };

    // Inline positioning — bottom-center floating bar.
    var posStyle = { position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 40, display: 'flex', alignItems: 'center', gap: 2, padding: '2px 4px', borderRadius: 8 };
    var surfaceClass = 'bg-popover border border-border shadow-md';

    var btnClass = function (active, colorClass) {
      return 'flex items-center justify-center w-6 h-6 rounded-md border-none cursor-pointer transition-colors ' +
        (active
          ? 'bg-muted-30 ' + (colorClass || 'text-foreground')
          : 'bg-transparent text-muted-foreground hover:bg-muted-30 hover:text-foreground');
    };

    if (!editMode) {
      return jsxs('div', {
        style: posStyle,
        className: surfaceClass,
        children: [
          jsx('button', { className: btnClass(false), onClick: onToggleEdit, title: 'Edit pins', children: Icon('edit', '', 14) }),
          jsx('button', { className: btnClass(false), onClick: onResetCamera, title: 'Reset view', children: Icon('reset', '', 14) })
        ]
      });
    }

    return jsxs('div', {
      style: Object.assign({}, posStyle, { borderColor: 'var(--color-accent-purple)' }),
      className: surfaceClass,
      children: [
        pinTypes.map(function (t) {
          var isActive = activePinType === t;
          return jsx('button', {
            className: btnClass(isActive, typeColorClass[t]),
            onClick: function () { onSelectPinType(t); },
            title: typeLabels[t],
            children: Icon(t, '', 14)
          }, t);
        }),
        jsx('div', { style: { width: 1, height: 16, margin: '0 2px', backgroundColor: 'var(--color-border)' } }),
        jsx('button', {
          className: 'flex items-center h-6 px-2 rounded-md border-none cursor-pointer text-[11px] font-medium bg-transparent text-muted-foreground hover:bg-muted-30 hover:text-foreground transition-colors',
          onClick: onToggleEdit,
          children: 'Done'
        })
      ]
    });
  };

  // --- DetailCard Component (compact 4:3 card) ---
  // Inline positioning throughout; header now holds dot+label on the left and
  // close+delete on the right (previously the absolute close button overlapped
  // the header row, which read as "messy"). Delete was missing entirely.
  var DetailCard = function (props) {
    var pin = props.pin;
    var value = props.value;
    var onAction = props.onAction;
    var onClose = props.onClose;
    var onDelete = props.onDelete;
    var detailRef = props.detailRef;
    var colorVar = pinColorVar(pin.type);

    var cardStyle = { position: 'relative', width: 176, aspectRatio: '4 / 3', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, overflow: 'hidden' };

    var iconBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-muted-foreground)' };
    var iconBtnClass = 'hover:bg-muted-30 hover:text-foreground transition-colors';

    var content = null;
    if (pin.type === 'metric') {
      content = jsxs('div', { style: { display: 'flex', flexDirection: 'column' }, children: [
        jsx('span', { className: 'text-2xl font-extralight text-foreground leading-none', children: value != null ? String(value) : '--' }),
        jsx('span', { className: 'text-[10px] text-muted-foreground mt-1', children: pin.label })
      ]});
    } else if (pin.type === 'device') {
      var online = value && value.status === 'online';
      content = jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [
        jsx('div', { style: { width: 8, height: 8, borderRadius: '50%', backgroundColor: online ? 'var(--color-success)' : 'var(--color-muted-foreground)' } }),
        jsx('span', { className: 'text-[13px] text-foreground', children: online ? 'Online' : 'Offline' })
      ]});
    } else if (pin.type === 'annotation') {
      content = jsx('div', {
        className: 'text-xs text-foreground leading-relaxed',
        style: { maxHeight: 48, overflow: 'hidden' },
        children: pin.annotationText || 'No annotation'
      });
    } else if (pin.type === 'command') {
      content = jsx('button', {
        className: 'flex items-center justify-center w-8 h-8 rounded-full border cursor-pointer transition-colors hover:bg-muted-30',
        style: { borderColor: colorVar, color: colorVar },
        onClick: function (e) { e.stopPropagation(); onAction && onAction(pin); },
        children: Icon('play', '', 16)
      });
    }

    return jsx('div', {
      ref: function (el) { if (detailRef) detailRef.current[pin.id + '_detail'] = el; },
      style: { position: 'absolute', pointerEvents: 'auto', zIndex: 20, display: 'none' },
      children: jsxs('div', {
        style: cardStyle,
        className: 'bg-popover border border-border shadow-lg',
        children: [
          jsx('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, ' + colorVar + ', transparent)' } }),
          // Header: dot + label  |  delete + close
          jsxs('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1, gap: 8 }, children: [
            jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }, children: [
              jsx('div', { style: { width: 7, height: 7, borderRadius: '50%', backgroundColor: colorVar, flexShrink: 0 } }),
              jsx('span', { style: { fontSize: 11, fontWeight: 600, color: 'var(--color-foreground)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: pin.label || pin.type })
            ]}),
            jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }, children: [
              onDelete ? jsx('button', {
                style: iconBtnStyle, className: iconBtnClass + ' hover:text-error',
                title: 'Delete pin',
                onClick: function (e) { e.stopPropagation(); onDelete(pin.id); },
                children: Icon('trash', '', 13)
              }) : null,
              jsx('button', {
                style: iconBtnStyle, className: iconBtnClass,
                title: 'Close',
                onClick: function (e) { e.stopPropagation(); onClose(); },
                children: Icon('close', '', 13)
              })
            ]})
          ]}),
          // Body
          jsx('div', { style: { position: 'relative', zIndex: 1, flex: 1, display: 'flex', alignItems: 'center' }, children: content })
        ]
      })
    });
  };

  // --- PinConfigSidebar Component (right-docked edit panel) ---
  // Replaces the old floating popover. Docked to the right edge so the form
  // has room for dropdowns; no longer tracked/projected by the render loop.
  //
  // Dropdowns:
  //  - Device ID: <select> populated from window.neomind.listDevices() (real
  //    platform devices); falls back to a text input + datalist of recently-used
  //    IDs when the host doesn't expose listDevices.
  //  - Metric key: auto-populated <select> from fetchDeviceValues(deviceId);
  //    falls back to a text input when the device has no values yet.
  //  - Command key: text only (no command-list API exists).
  var inputStyle = { width: '100%', height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-muted)', color: 'var(--color-foreground)', fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  var selectStyle = Object.assign({}, inputStyle, { appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: 24, backgroundImage: 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%23888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>\')', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' });
  var fieldLabelStyle = { fontSize: 11, fontWeight: 500, color: 'var(--color-muted-foreground)', marginBottom: 4 };

  var FieldRow = function (labelText, control, hint) {
    return jsxs('label', { style: { display: 'flex', flexDirection: 'column' }, children: [
      jsx('span', { style: fieldLabelStyle, children: labelText }),
      control,
      hint ? jsx('span', { style: { fontSize: 10, color: 'var(--color-muted-foreground)', marginTop: 3 }, children: hint }) : null
    ]});
  };

  // Flatten a nested values object back into dotted metric keys
  // (fetchDeviceValues returns a nested structure; pin refs store dotted keys).
  var flattenKeys = function (prefix, obj, out) {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      var full = prefix ? prefix + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flattenKeys(full, v, out);
      else out.push(full);
    });
  };

  var PinConfigSidebar = function (props) {
    var pin = props.pin;
    var onSave = props.onSave;
    var onCancel = props.onCancel;
    var onDelete = props.onDelete;
    var width = props.width || 280;
    var knownDevices = props.knownDevices || [];
    var onDeviceUsed = props.onDeviceUsed;
    var colorVar = pinColorVar(pin.type);

    var labelState = React.useState(pin.label || '');
    var label = labelState[0];
    var setLabel = labelState[1];

    var initialDevice =
      (pin.type === 'metric' && pin.metricRef) ? (pin.metricRef.deviceId || '') :
      (pin.type === 'device' && pin.deviceRef) ? (pin.deviceRef.deviceId || '') :
      (pin.type === 'command' && pin.commandRef) ? (pin.commandRef.deviceId || '') : '';

    var deviceIdState = React.useState(initialDevice);
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

    // Metric keys available on the selected device — populated from
    // fetchDeviceValues() so the user picks from real keys, not guesses.
    var metricKeysState = React.useState([]);
    var metricKeys = metricKeysState[0];
    var setMetricKeys = metricKeysState[1];
    var keysLoadingState = React.useState(false);
    var keysLoading = keysLoadingState[0];
    var setKeysLoading = keysLoadingState[1];

    // Platform device list for the Device ID picker. Populated from
    // window.neomind.listDevices() when available; falls back to the
    // knownDevices history (datalist) if the host doesn't expose it.
    var deviceListState = React.useState([]);
    var deviceList = deviceListState[0];
    var setDeviceList = deviceListState[1];
    React.useEffect(function () {
      var neomind = window.neomind;
      if (!neomind || typeof neomind.listDevices !== 'function') return;
      neomind.listDevices().then(function (list) {
        setDeviceList(Array.isArray(list) ? list : []);
      }).catch(function () { setDeviceList([]); });
    }, []);

    React.useEffect(function () {
      if (pin.type !== 'metric') return;
      var id = (deviceId || '').trim();
      var neomind = window.neomind;
      if (!id || !neomind || typeof neomind.fetchDeviceValues !== 'function') {
        setMetricKeys([]);
        return;
      }
      setKeysLoading(true);
      neomind.fetchDeviceValues(id).then(function (v) {
        var keys = [];
        flattenKeys('', v, keys);
        setMetricKeys(keys);
      }).catch(function () { setMetricKeys([]); })
        .then(function () { setKeysLoading(false); });
    }, [deviceId, pin.type]);

    // Device-type schema (metrics + commands) for the selected device.
    // Sourced from window.neomind.getDeviceType() so the metric/command
    // pickers show the stable schema, not just live-reported keys.
    var typeMetricsState = React.useState([]);
    var typeMetrics = typeMetricsState[0];
    var setTypeMetrics = typeMetricsState[1];
    var typeCommandsState = React.useState([]);
    var typeCommands = typeCommandsState[0];
    var setTypeCommands = typeCommandsState[1];
    React.useEffect(function () {
      var id = (deviceId || '').trim();
      var neomind = window.neomind;
      if (!id || !neomind || typeof neomind.getDeviceType !== 'function') {
        setTypeMetrics([]);
        setTypeCommands([]);
        return;
      }
      // Resolve device_type from the picked device (or fall back to the id itself).
      var dev = deviceList.find(function (d) { return d.id === id; });
      var typeName = (dev && dev.device_type) || '';
      if (!typeName) { setTypeMetrics([]); setTypeCommands([]); return; }
      neomind.getDeviceType(typeName).then(function (t) {
        setTypeMetrics(t ? t.metrics : []);
        setTypeCommands(t ? t.commands : []);
      }).catch(function () { setTypeMetrics([]); setTypeCommands([]); });
    }, [deviceId, deviceList]);

    var handleSave = function () {
      var updated = Object.assign({}, pin, { label: label });
      if (pin.type === 'metric') {
        updated.metricRef = { deviceType: '', metricKey: metricKey, deviceId: deviceId };
        if (deviceId && onDeviceUsed) onDeviceUsed(deviceId);
      } else if (pin.type === 'device') {
        updated.deviceRef = { deviceType: '', deviceId: deviceId };
        if (deviceId && onDeviceUsed) onDeviceUsed(deviceId);
      } else if (pin.type === 'annotation') {
        updated.annotationText = text;
      } else if (pin.type === 'command') {
        updated.commandRef = { deviceType: '', commandKey: cmdKey, deviceId: deviceId };
        if (deviceId && onDeviceUsed) onDeviceUsed(deviceId);
      }
      onSave(updated);
    };

    // Shared Device ID field. When the host exposes window.neomind.listDevices,
    // render a <select> of real devices; otherwise fall back to a text input
    // with a datalist of recently-used IDs.
    var deviceField = function (hint) {
      var control = deviceList.length > 0
        ? (function () {
            var opts = deviceList.slice();
            // Always include the current value even if it's no longer in the list.
            if (deviceId && !opts.some(function (d) { return d.id === deviceId; })) {
              opts.unshift({ id: deviceId, name: deviceId, device_type: '' });
            }
            return jsxs('select', {
              style: selectStyle,
              value: deviceId,
              onChange: function (e) { setDeviceId(e.target.value); },
              children: [
                jsx('option', { value: '', children: '— Select a device —' }),
                opts.map(function (d) {
                  return jsx('option', { value: d.id, children: d.name === d.id ? d.id : (d.name + ' (' + d.id + ')') }, d.id);
                })
              ]
            });
          })()
        : jsx('input', {
            style: inputStyle,
            list: 'neomind-3d-devices',
            placeholder: 'device-id',
            value: deviceId,
            onChange: function (e) { setDeviceId(e.target.value); }
          });
      return FieldRow('Device ID', control, hint);
    };

    var fields = null;
    if (pin.type === 'metric') {
      // Build metric options from the device-type schema (preferred, carries
      // display_name) plus any live-reported keys not in the schema.
      var optList = typeMetrics.map(function (m) {
        return { value: m.name, label: m.display_name ? (m.display_name + ' (' + m.name + ')') : m.name };
      });
      var schemaNames = optList.map(function (o) { return o.value; });
      for (var i = 0; i < metricKeys.length; i++) {
        if (schemaNames.indexOf(metricKeys[i]) === -1) optList.push({ value: metricKeys[i], label: metricKeys[i] });
      }
      if (metricKey && !optList.some(function (o) { return o.value === metricKey; })) {
        optList.unshift({ value: metricKey, label: metricKey });
      }
      var metricControl = optList.length > 0
        ? jsxs('select', {
            style: selectStyle,
            value: metricKey,
            onChange: function (e) { setMetricKey(e.target.value); },
            children: [
              jsx('option', { value: '', children: '— Select a metric —' }),
              optList.map(function (o) { return jsx('option', { value: o.value, children: o.label }, o.value); })
            ]
          })
        : jsx('input', {
            style: inputStyle,
            placeholder: keysLoading ? 'Loading metrics…' : 'e.g. values.temperature',
            value: metricKey,
            onChange: function (e) { setMetricKey(e.target.value); }
          });
      fields = jsxs('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [
        deviceField('Pick a device. Metrics load from the device-type schema.'),
        FieldRow('Metric key', metricControl)
      ]});
    } else if (pin.type === 'device') {
      fields = deviceField('Pick a device.');
    } else if (pin.type === 'annotation') {
      fields = FieldRow('Note',
        jsx('textarea', {
          style: Object.assign({}, inputStyle, { height: 72, padding: '6px 8px', resize: 'none' }),
          placeholder: 'Annotation text…',
          value: text,
          onChange: function (e) { setText(e.target.value); }
        })
      );
    } else if (pin.type === 'command') {
      var cmdOptList = typeCommands.map(function (c) {
        return { value: c.name, label: c.display_name ? (c.display_name + ' (' + c.name + ')') : c.name };
      });
      if (cmdKey && !cmdOptList.some(function (o) { return o.value === cmdKey; })) {
        cmdOptList.unshift({ value: cmdKey, label: cmdKey });
      }
      var cmdControl = cmdOptList.length > 0
        ? jsxs('select', {
            style: selectStyle,
            value: cmdKey,
            onChange: function (e) { setCmdKey(e.target.value); },
            children: [
              jsx('option', { value: '', children: '— Select a command —' }),
              cmdOptList.map(function (o) { return jsx('option', { value: o.value, children: o.label }, o.value); })
            ]
          })
        : jsx('input', {
            style: inputStyle,
            placeholder: 'e.g. trigger_capture',
            value: cmdKey,
            onChange: function (e) { setCmdKey(e.target.value); }
          });
      fields = jsxs('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [
        deviceField('Pick a device.'),
        FieldRow('Command key', cmdControl, 'Falls back to free text if the device type defines no commands.')
      ]});
    }

    return jsxs('div', {
      style: {
        position: 'absolute', top: 0, right: 0, bottom: 0, width: width,
        zIndex: 46, pointerEvents: 'auto',
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid var(--color-border)',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.18)'
      },
      className: 'bg-popover',
      children: [
        // datalist for device-id autocompletion
        jsx('datalist', { id: 'neomind-3d-devices', children: knownDevices.map(function (d) { return jsx('option', { value: d }, d); }) }),
        // Header
        jsxs('div', {
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 },
          children: [
            jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [
              jsx('div', { style: { width: 10, height: 10, borderRadius: '50%', backgroundColor: colorVar } }),
              jsx('span', { className: 'text-sm font-semibold text-foreground', style: { textTransform: 'capitalize' }, children: pin.type + ' pin' })
            ]}),
            jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: 2 }, children: [
              onDelete ? jsx('button', {
                style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-muted-foreground)' },
                className: 'hover:bg-muted-30 hover:text-error transition-colors',
                title: 'Delete pin',
                onClick: function () { onDelete(pin.id); },
                children: Icon('trash', '', 16)
              }) : null,
              jsx('button', {
                style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-muted-foreground)' },
                className: 'hover:bg-muted-30 hover:text-foreground transition-colors',
                title: 'Close',
                onClick: onCancel,
                children: Icon('close', '', 16)
              })
            ]})
          ]
        }),
        // Body
        jsx('div', {
          style: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 },
          children: jsxs('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [
            FieldRow('Label',
              jsx('input', {
                style: inputStyle,
                placeholder: 'Pin label',
                value: label,
                onChange: function (e) { setLabel(e.target.value); }
              })
            ),
            fields
          ]})
        }),
        // Footer
        jsxs('div', {
          style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--color-border)', flexShrink: 0 },
          children: [
            jsx('div', { style: { flex: 1 } }),
            jsx('button', {
              style: { padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted-foreground)', cursor: 'pointer' },
              className: 'hover:bg-muted-30 hover:text-foreground transition-colors',
              onClick: onCancel,
              children: 'Cancel'
            }),
            jsx('button', {
              style: { padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: 'none', cursor: 'pointer', color: '#fff', backgroundColor: 'var(--accent-purple, #7c3aed)' },
              onClick: handleSave,
              children: 'Save'
            })
          ]
        })
      ]
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

    // Recently-used device IDs for the config sidebar's Device ID autocomplete.
    // The platform exposes no device-list API to components, so we can't
    // enumerate every device — this history is the best assist we can offer.
    var knownDevicesState = React.useState(function () {
      try {
        var raw = localStorage.getItem('neomind_3dviewer_devices');
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    });
    var knownDevices = knownDevicesState[0];
    var setKnownDevices = knownDevicesState[1];

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

    // Refs synchronization
    React.useEffect(function () { pinsRef.current = pins; }, [pins]);
    React.useEffect(function () { selectedPinIdRef.current = selectedPinId; }, [selectedPinId]);

    // --- Shared scene lifecycle helpers (used by both modelUrl and drag-drop paths) ---
    // Single source of truth for the render loop so the two paths can't drift
    // (the drop path previously ran a simpler loop that skipped detail-card /
    // config-popover positioning and clamping).
    var startRenderLoop = function () {
      function animate() {
        if (!sceneHandleRef.current) return;
        sceneHandleRef.current.frameId = requestAnimationFrame(animate);
        sceneHandleRef.current.controls.update();
        sceneHandleRef.current.renderer.render(sceneHandleRef.current.scene, sceneHandleRef.current.camera);
        var containerW = sceneHandleRef.current.container.offsetWidth;
        var containerH = sceneHandleRef.current.container.offsetHeight;
        var currentPins = pinsRef.current;
        for (var i = 0; i < currentPins.length; i++) {
          var pin = currentPins[i];
          var pinMesh = pinMeshesRef.current[pin.id];
          if (!pinMesh) continue;
          var screen = projectToScreen(pinMesh.position, sceneHandleRef.current.camera, containerW, containerH);
          var sx = Math.max(8, Math.min(screen.x, containerW - 8));
          var sy = Math.max(8, Math.min(screen.y, containerH - 8));
          var popupEl = popupRefs.current[pin.id];
          if (popupEl) {
            popupEl.style.left = sx + 'px';
            popupEl.style.top = sy + 'px';
            popupEl.style.display = screen.behind ? 'none' : '';
          }
          var detailEl = popupRefs.current[pin.id + '_detail'];
          if (pin.id === selectedPinIdRef.current && detailEl) {
            // Center the card on the pin horizontally; flip below when there
            // isn't room above (previously Math.max(4, sy-60) clamped the card
            // to the very top edge — "紧贴上方" — for pins near the top).
            var cardW = detailEl.offsetWidth || 176;
            var cardH = detailEl.offsetHeight || 132;
            var dx = Math.max(4, Math.min(sx - cardW / 2, containerW - cardW - 4));
            var dy = (sy - cardH - 10 >= 8)
              ? sy - cardH - 10
              : Math.min(sy + 14, containerH - cardH - 8);
            detailEl.style.left = dx + 'px';
            detailEl.style.top = dy + 'px';
            detailEl.style.display = screen.behind ? 'none' : '';
          } else if (detailEl) {
            detailEl.style.display = 'none';
          }
          // (Config panel is now a docked sidebar — no per-frame positioning.)
        }
      }
      animate();
    };

    var attachResizeObserver = function (container) {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
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
    };

    // Dispose any existing observer + scene, create a fresh scene, start the
    // render loop, and attach the ResizeObserver. Returns the new scene handle.
    var buildFreshScene = function (container, bgColor) {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      disposeScene(sceneHandleRef.current);
      sceneHandleRef.current = null;
      modelRef.current = null;
      var sceneHandle = createScene(container, bgColor);
      sceneHandleRef.current = sceneHandle;
      startRenderLoop();
      attachResizeObserver(container);
      return sceneHandle;
    };

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
            // A new model is being loaded — pin coordinates are model-specific
            // and cannot be reused, so clear any stale pin meshes/state.
            Object.keys(pinMeshesRef.current).forEach(function (id) {
              var mesh = pinMeshesRef.current[id];
              if (mesh) { mesh.geometry.dispose(); mesh.material.dispose(); }
            });
            pinMeshesRef.current = {};
            setPins([]);

            var sceneHandle = buildFreshScene(container, config.backgroundColor || '#111827');
            return loadModel(sceneHandle, file);
          }).then(function (model) {
            if (!model) return;
            modelRef.current = model;
            setLoadState('loaded');
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

    // Record a device ID used in the config sidebar so it autocompletes next time.
    var recordDeviceUsed = function (id) {
      var trimmed = (id || '').trim();
      if (!trimmed) return;
      setKnownDevices(function (prev) {
        if (prev.indexOf(trimmed) !== -1) return prev;
        var next = prev.concat([trimmed]).slice(-50);
        try { localStorage.setItem('neomind_3dviewer_devices', JSON.stringify(next)); } catch (e) {}
        return next;
      });
    };

    var handlePinConfigSave = function (updatedPin) {
      var next = pinsRef.current.map(function (p) { return p.id === updatedPin.id ? updatedPin : p; });
      pinsRef.current = next;
      setPins(next);
      setConfiguringPinId(null);
      if (props.onConfigChange) props.onConfigChange(Object.assign({}, config, { pins: next }));
    };

    // Delete a pin by id: dispose its 3D mesh, drop it from state, close any
    // open detail/config panel, and persist the reduced pin set. Previously
    // there was no delete path at all — saved pins could not be removed.
    var deletePin = function (pinId) {
      if (!pinId) return;
      var mesh = pinMeshesRef.current[pinId];
      if (mesh && sceneHandleRef.current) {
        sceneHandleRef.current.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      delete pinMeshesRef.current[pinId];
      var next = pinsRef.current.filter(function (p) { return p.id !== pinId; });
      pinsRef.current = next;
      setPins(next);
      if (selectedPinId === pinId) setSelectedPinId(null);
      if (configuringPinId === pinId) setConfiguringPinId(null);
      // Dashboard's onConfigChange expects a FULL config object (it replaces
      // component.config wholesale). Passing ('pins', next) would clobber
      // modelUrl/backgroundColor/autoRotate and make the model unload.
      if (props.onConfigChange) props.onConfigChange(Object.assign({}, config, { pins: next }));
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
          props.onConfigChange(Object.assign({}, config, { pins: pinsRef.current }));
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

    // Click handler for pin placement — re-attaches whenever a model finishes
    // loading (either path). Guard on loadStateValue === 'loaded' so we don't
    // attach to a stale canvas during the 'loading' transition.
    React.useEffect(function () {
      if (loadStateValue !== 'loaded') return;
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
        var nextPins = pinsRef.current.concat([newPin]);
        pinsRef.current = nextPins;
        setPins(nextPins);
        setConfiguringPinId(id);
        if (props.onConfigChange) props.onConfigChange(Object.assign({}, config, { pins: nextPins }));
      };

      sceneHandle.renderer.domElement.addEventListener('click', handleClick);

      return function cleanup() {
        sceneHandle.renderer.domElement.removeEventListener('click', handleClick);
      };
    }, [loadStateValue]);

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

        var sceneHandle = buildFreshScene(container, config.backgroundColor || '#111827');

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

    // React to autoRotate / editMode changes — also re-run when a new scene
    // finishes loading (buildFreshScene no longer bootstraps autoRotate, so
    // this effect must apply it to the fresh scene for both load paths).
    React.useEffect(function () {
      var handle = sceneHandleRef.current;
      if (!handle) return;
      handle.controls.autoRotate = autoRotate && !editMode;
      handle.controls.autoRotateSpeed = 2.0;
    }, [autoRotate, editMode, loadStateValue]);

    var rootStyle = { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 12 };

    return jsxs('div', {
      ref: containerRef,
      style: rootStyle,
      className: 'bg-muted',
      children: [
        jsx('style', { dangerouslySetInnerHTML: { __html: '@keyframes spin { to { transform: rotate(360deg) } }' } }),
        // Empty state — no model loaded yet via either path (URL or drag-drop)
        loadStateValue !== 'loaded' && !modelUrl && jsx('div', {
          style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
          children: jsxs('div', {
            style: { textAlign: 'center', padding: '0 24px' },
            children: [
              jsx('div', {
                style: { width: 64, height: 64, margin: '0 auto 16px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-info)', border: '1px dashed var(--color-info)', backgroundColor: 'color-mix(in oklch, var(--color-info) 8%, transparent)' },
                children: Icon('upload', '', 28)
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
          style: { position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 40, padding: '4px 12px', borderRadius: 6, fontSize: 12, border: '1px solid var(--color-success)', backgroundColor: 'color-mix(in oklch, var(--color-success) 14%, transparent)', color: 'var(--color-success)', whiteSpace: 'nowrap' },
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
          style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50, backgroundColor: 'color-mix(in oklch, var(--color-muted) 88%, transparent)' },
          children: jsxs('div', { style: { textAlign: 'center' }, children: [
            jsx('div', {
              style: { width: 40, height: 40, borderWidth: 3, borderStyle: 'solid', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto', borderColor: 'var(--color-border)', borderTopColor: 'var(--color-info)' }
            }),
            jsx('p', { className: 'mt-3 text-sm text-muted-foreground', children: 'Loading 3D Model...' })
          ]})
        }),
        // Error overlay — backdrop is click-through so it doesn't block the
        // dashboard's top-right edit/delete chrome; only the Retry card captures.
        loadStateValue === 'error' && jsx('div', {
          style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50, backgroundColor: 'color-mix(in oklch, var(--color-muted) 92%, transparent)', pointerEvents: 'none' },
          children: jsxs('div', { style: { textAlign: 'center', pointerEvents: 'auto' }, children: [
            jsx('p', { className: 'text-sm text-error', children: errorMsgValue || 'Failed to load model' }),
            jsx('button', {
              style: { marginTop: 8, padding: '4px 12px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', color: 'var(--color-primary-foreground, #fff)', backgroundColor: 'var(--color-info)' },
              onClick: function () {
                setLoadState('idle');
                prevModelUrlRef.current = '';
              },
              children: 'Retry'
            })
          ]})
        }),
        // Pin overlay — zIndex above toolbar (z:40) and edit-mode indicator
        // (z:40) so popups/detail cards aren't covered by them.
        jsx('div', {
          style: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 45 },
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
                  key: 'detail_' + selectedPinId,
                  pin: pins.find(function (p) { return p.id === selectedPinId; }),
                  value: pinValues[selectedPinId],
                  onAction: executeCommand,
                  onClose: function () { setSelectedPinId(null); },
                  onDelete: function (id) { deletePin(id); },
                  detailRef: popupRefs
                })]
              : []
          )
        }),
        // Config sidebar — docked to the right edge while a pin is being edited.
        configuringPinId && pins.find(function (p) { return p.id === configuringPinId; })
          ? jsx(PinConfigSidebar, {
              key: 'config_' + configuringPinId,
              pin: pins.find(function (p) { return p.id === configuringPinId; }),
              width: Math.max(200, Math.min(300, (containerSize.w || 300) - 8)),
              onSave: handlePinConfigSave,
              onCancel: handlePinConfigCancel,
              onDelete: function (id) { deletePin(id); },
              knownDevices: knownDevices,
              onDeviceUsed: recordDeviceUsed
            })
          : null
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
