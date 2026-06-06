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

    // Refs for per-frame updates (mirrors of state, used in rAF loop)
    var popupRefs = React.useRef({});
    var pinMeshesRef = React.useRef({});
    var pinsRef = React.useRef(pins);
    var selectedPinIdRef = React.useRef(selectedPinId);

    // Refs synchronization
    React.useEffect(function () { pinsRef.current = pins; }, [pins]);
    React.useEffect(function () { selectedPinIdRef.current = selectedPinId; }, [selectedPinId]);

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
      };

      sceneHandle.renderer.domElement.addEventListener('click', handleClick);

      return function cleanup() {
        sceneHandle.renderer.domElement.removeEventListener('click', handleClick);
      };
    }, [modelRef.current]);

    React.useEffect(function () {
      if (!modelUrl) return;

      setLoadState('loading');
      setErrorMsg('');

      var container = containerRef.current;
      if (!container) return;

      var observer = null;
      var sceneHandle = null;

      loadThreeJS().then(function () {
        sceneHandle = createScene(container, bgColor);
        sceneHandleRef.current = sceneHandle;

        if (autoRotate) {
          sceneHandle.controls.autoRotate = true;
          sceneHandle.controls.autoRotateSpeed = 2.0;
        }

        return loadModel(sceneHandle, modelUrl);
      }).then(function (model) {
        modelRef.current = model;

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

        function animate() {
          if (!sceneHandleRef.current) return;
          sceneHandleRef.current.controls.update();
          sceneHandleRef.current.renderer.render(
            sceneHandleRef.current.scene,
            sceneHandleRef.current.camera
          );

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

          sceneHandleRef.current.frameId = requestAnimationFrame(animate);
        }
        animate();

        observer = new ResizeObserver(function () {
          if (!sceneHandleRef.current) return;
          var w = container.offsetWidth;
          var h = container.offsetHeight;
          sceneHandleRef.current.camera.aspect = w / h;
          sceneHandleRef.current.camera.updateProjectionMatrix();
          sceneHandleRef.current.renderer.setSize(w, h);
        });
        observer.observe(container);

        setLoadState('loaded');
      }).catch(function (err) {
        console.error('Failed to load 3D model:', err);
        setErrorMsg(err.message || 'Failed to load model');
        setLoadState('error');
        if (sceneHandleRef.current) {
          disposeScene(sceneHandleRef.current);
          sceneHandleRef.current = null;
        }
      });

      return function cleanup() {
        if (observer) observer.disconnect();
        if (sceneHandleRef.current) {
          disposeScene(sceneHandleRef.current);
          sceneHandleRef.current = null;
        }
      };
    }, [modelUrl, bgColor, autoRotate]);

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
        loadState === 'loading' && jsx('div', {
          className: 'absolute inset-0 flex flex-col items-center justify-center bg-card/80 z-10',
          children: jsxs('div', { className: 'text-center space-y-2', children: [
            jsx('div', { className: 'w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto' }),
            jsx('p', { className: 'text-sm text-muted-foreground', children: 'Loading model...' })
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
