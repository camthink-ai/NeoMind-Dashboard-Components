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

  // NeoMind standard muted colors for empty/default states
  var mutedFg = { color: '#a1a1aa' };
  var mutedFgSub = { color: 'rgba(161,161,170,0.7)' };

  // Location pin SVG icon
  function PinIcon() {
    return jsx('svg', {
      width: '12', height: '12', viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round',
      style: { flexShrink: '0' },
      children: jsx('path', { d: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z' })
    });
  }

  // ---------------------------------------------------------------------------
  // Extension profiles — which AI modes each extension supports
  // ---------------------------------------------------------------------------
  var AI_EXT_IDS = ['locate-anything-v2', 'image-analyzer-v2', 'yolo-device-inference', 'ocr-device-inference'];

  // imageArg: extension's input parameter name for the image
  //   'image_base64' = locate-anything-v2 style (expects raw base64 string)
  //   'image' = most other extensions (expects base64 string under 'image' key)
  // responseType: how the extension returns detection results
  //   'boxes_x1y1x2y2' = { boxes: [{x1,y1,x2,y2}, ...] } (pixel coords)
  //   'objects_bbox'   = { objects: [{label, confidence, bbox:{x,y,width,height}}] } (pixel coords)
  //   'detections_bbox'= { detections: [{label, confidence, bbox:{x,y,width,height}}] } (pixel coords)
  //   'ocr_text_blocks'= { success, data: { text_blocks: [{text,confidence,bbox:{x,y,width,height}}] } } (normalized 0-1)
  var EXT_MODES = {
    'locate-anything-v2': [
      { id: 'object_detection', command: 'detect', imageArg: 'image_base64', responseType: 'boxes_x1y1x2y2', label: 'Object Detection', desc: 'Detect objects by category', icon: '\u{1F50D}', args: ['categories'] },
      { id: 'grounding', command: 'ground', imageArg: 'image_base64', responseType: 'boxes_x1y1x2y2', label: 'Grounding', desc: 'Find objects by description', icon: '\u{1F3AF}', args: ['phrase'] },
      { id: 'text_detection', command: 'detect_text', imageArg: 'image_base64', responseType: 'boxes_x1y1x2y2', label: 'Text Detection', desc: 'Extract text from image', icon: '\u{1F4DD}', args: [] },
      { id: 'ground_gui', command: 'ground_gui', imageArg: 'image_base64', responseType: 'boxes_x1y1x2y2', label: 'UI Grounding', desc: 'Locate UI elements by description', icon: '\u{1F5A5}', args: ['phrase'] },
      { id: 'point', command: 'point', imageArg: 'image_base64', responseType: 'boxes_x1y1x2y2', label: 'Point', desc: 'Point to specific objects', icon: '\u{1F446}', args: ['phrase'] }
    ],
    'image-analyzer-v2': [
      { id: 'object_detection', command: 'analyze_image', imageArg: 'image', responseType: 'objects_bbox', label: 'Object Detection', desc: 'YOLOv8 object detection', icon: '\u{1F50D}', args: [] }
    ],
    'yolo-device-inference': [
      { id: 'object_detection', command: 'analyze_image', imageArg: 'image', responseType: 'detections_bbox', label: 'Object Detection', desc: 'YOLOv8 device inference', icon: '\u{1F50D}', args: [] }
    ],
    'ocr-device-inference': [
      { id: 'text_detection', command: 'recognize_image', imageArg: 'image', responseType: 'ocr_text_blocks', label: 'Text Detection', desc: 'OCR text recognition', icon: '\u{1F4DD}', args: [] }
    ]
  };

  // Output mapping per template type (independent of extension)
  var TPL_OUTPUTS = {
    object_detection: {
      'virtual.detections': { from: 'boxes', normalize: true },
      'virtual.total_count': { from: 'boxes', transform: 'count' },
      'virtual.count_by_class': { from: 'boxes', transform: 'count_by_class' }
    },
    grounding: {
      'virtual.detections': { from: 'boxes', normalize: true }
    },
    text_detection: {
      'virtual.detections': { from: 'boxes', normalize: true },
      'virtual.texts': { from: 'answer', transform: 'extract_texts' }
    },
    ground_gui: {
      'virtual.detections': { from: 'boxes', normalize: true }
    },
    point: {
      'virtual.points': { from: 'points' }
    }
  };

  /** Get the command for an extension + template combination */
  function getExtCommand(extensionId, templateName) {
    var mode = getExtMode(extensionId, templateName);
    return mode ? mode.command : 'detect';
  }

  /** Get a single mode definition for an extension + template */
  function getExtMode(extensionId, templateName) {
    var modes = EXT_MODES[extensionId];
    if (modes) {
      for (var i = 0; i < modes.length; i++) {
        if (modes[i].id === templateName) return modes[i];
      }
    }
    return null;
  }

  /** Get available modes for an extension */
  function getExtModes(extensionId) {
    return EXT_MODES[extensionId] || [{ id: 'object_detection', command: 'detect', imageArg: 'image', responseType: 'boxes_x1y1x2y2', label: 'Object Detection', desc: 'Generic detection', icon: '\u{1F50D}' }];
  }

  /**
   * Build transform input mapping for an extension.
   * Uses the image field path with url_to_base64 conversion.
   * The backend's resolve_input_mapping auto-detects base64 and passes through.
   */
  function buildInputMapping(extensionId, templateName) {
    var mode = getExtMode(extensionId, templateName);
    var arg = (mode && mode.imageArg) || 'image';
    var mapping = {};
    // Use 'values.image' as primary source (base64 from device), fallback to imageUrl
    // Backend resolve_input_mapping handles both URL and base64 automatically
    mapping[arg] = { from: 'values.image', convert: 'url_to_base64' };
    return mapping;
  }

  /**
   * Normalize extension response into a standard detections array.
   * Returns: { detections: [{ bbox:[x1,y1,x2,y2], label, confidence }], texts?: string[], inferenceTimeMs?: number }
   * bbox values are normalized 0-1.
   */
  function normalizeResponse(resp, responseType, imgW, imgH) {
    if (!resp) return { detections: [] };
    var w = imgW || 1;
    var h = imgH || 1;
    var dets = [];
    var texts = null;
    var inferenceTimeMs = null;

    if (responseType === 'objects_bbox' && Array.isArray(resp.objects)) {
      // image-analyzer-v2: { objects: [{ label, confidence, bbox: {x,y,width,height} }] }
      inferenceTimeMs = resp.processing_time_ms;
      for (var i = 0; i < resp.objects.length; i++) {
        var obj = resp.objects[i];
        var b = obj.bbox || {};
        dets.push({
          bbox: [b.x / w, b.y / h, (b.x + b.width) / w, (b.y + b.height) / h],
          label: obj.label || '',
          confidence: obj.confidence || null
        });
      }
    } else if (responseType === 'detections_bbox' && Array.isArray(resp.detections)) {
      // yolo-device-inference: { detections: [{ label, confidence, bbox: {x,y,width,height} }] }
      inferenceTimeMs = resp.inference_time_ms;
      for (var i = 0; i < resp.detections.length; i++) {
        var det = resp.detections[i];
        var b = det.bbox || {};
        dets.push({
          bbox: [b.x / w, b.y / h, (b.x + b.width) / w, (b.y + b.height) / h],
          label: det.label || '',
          confidence: det.confidence || null
        });
      }
    } else if (responseType === 'ocr_text_blocks') {
      // ocr-device-inference: { success, data: { text_blocks: [{ text, confidence, bbox: {x,y,width,height} }] } }
      var data = resp.data || resp;
      var blocks = Array.isArray(data.text_blocks) ? data.text_blocks : [];
      inferenceTimeMs = data.inference_time_ms;
      var textArr = [];
      for (var i = 0; i < blocks.length; i++) {
        var blk = blocks[i];
        var b = blk.bbox || {};
        // OCR bbox is already normalized 0-1
        dets.push({
          bbox: [b.x, b.y, b.x + b.width, b.y + b.height],
          label: blk.text || '',
          confidence: blk.confidence || null
        });
        if (blk.text) textArr.push(blk.text);
      }
      if (textArr.length > 0) texts = textArr;
    } else if (Array.isArray(resp.boxes)) {
      // locate-anything-v2: { boxes: [{x1,y1,x2,y2}], answer, inference_time_ms }
      inferenceTimeMs = resp.inference_time_ms;
      var answerStr = resp.answer || '';
      var labels = [];
      var refMatches = answerStr.match(/<ref>(.*?)<\/ref>/g);
      if (refMatches) {
        for (var ri = 0; ri < refMatches.length; ri++) {
          labels.push(refMatches[ri].replace(/<\/?ref>/g, ''));
        }
      }
      for (var i = 0; i < resp.boxes.length; i++) {
        var box = resp.boxes[i];
        dets.push({
          bbox: [box.x1 / w, box.y1 / h, box.x2 / w, box.y2 / h],
          label: labels[i] || '',
          confidence: box.score || box.confidence || null
        });
      }
    }

    var result = { detections: dets };
    if (texts) result.texts = texts;
    if (inferenceTimeMs != null) result.inferenceTimeMs = inferenceTimeMs;
    return result;
  }

  /**
   * Build a transform config from template + extension + procConfig.
   */
  function fillTemplate(templateName, extensionId, procConfig) {
    var command = getExtCommand(extensionId, templateName);
    var output = TPL_OUTPUTS[templateName] || TPL_OUTPUTS.object_detection;
    var inputMapping = buildInputMapping(extensionId, templateName);
    var config = {
      command: command,
      input: inputMapping,
      output: JSON.parse(JSON.stringify(output))
    };

    // Inject classFilter into count_by_class transforms
    var cf = procConfig.classFilter;
    if (cf && config.output) {
      var keys2 = Object.keys(config.output);
      for (var ci = 0; ci < keys2.length; ci++) {
        if (config.output[keys2[ci]].transform === 'count_by_class') {
          config.output[keys2[ci]].classFilter = cf;
        }
      }
    }

    // Inject ROI-related output transforms dynamically
    var roi = procConfig.roi;
    var roiAction = procConfig.roiAction || 'count';
    if (roi && config.output) {
      config.output['virtual.roi_count'] = { from: 'boxes', transform: 'count_in_roi', roi: roi };
      if (roiAction === 'filter') {
        config.output['virtual.detections'] = { from: 'boxes', transform: 'filter_roi', roi: roi };
      } else if (roiAction === 'count_by_class') {
        config.output['virtual.roi_count_by_class'] = { from: 'boxes', transform: 'count_by_class_in_roi', roi: roi };
      }
    }

    return config;
  }

  // No device placeholder
  function NoDevice() {
    return jsxs('div', {
      className: 'flex flex-col items-center justify-center h-full w-full p-4 text-center border border-border rounded-lg',
      children: [
        jsx('div', { key: 'icon', className: 'w-10 h-10 rounded-lg flex items-center justify-center mb-3', style: { background: 'rgba(161,161,170,0.15)' }, children:
          jsx('span', { style: Object.assign({}, mutedFg, { fontSize: '14px', fontWeight: '700' }), children: 'CAM' })
        }),
        jsx('p', { key: 'title', style: Object.assign({}, mutedFg, { fontSize: '14px', fontWeight: '500' }), children: 'NE101 Camera' }),
        jsx('p', { key: 'hint', style: Object.assign({}, mutedFgSub, { fontSize: '10px', marginTop: '4px' }), children: 'Bind a device in config panel' })
      ]
    });
  }

  // Main Component — image-centric layout
  function NE101CameraPanel(props) {
    var config = props.config || {};
    var showCommands = config.showCommands !== false;
    // Title: platform passes as props.title (from ComponentConfigDialog titleSection)
    // Backward compat: also check config.displayTitle / config.location
    var location = props.title || config.displayTitle || config.location || '';

    var deviceCtx = props.deviceContext;
    var device = deviceCtx && deviceCtx.device;
    var deviceType = deviceCtx && deviceCtx.deviceType;
    var sendCmd = props.sendDeviceCommand;

    var cmdState = React.useState({});
    var cmdLoading = cmdState[0];
    var setCmdLoading = cmdState[1];

    // -- Processing pipeline state (must be declared before early return) --
    var processingEnabled = config.processingEnabled === true;
    var extensionId = config.processingExtensionId || '';
    // Backward compat: object_detection_roi → object_detection + roiEnabled
    var rawTemplate = config.processingTemplate || 'object_detection';
    var procTemplate = rawTemplate === 'object_detection_roi' ? 'object_detection' : rawTemplate;
    var procCategories = config.processingCategories || '';
    var procPhrase = config.processingPhrase || '';
    var procClassFilter = config.processingClassFilter || '';
    // ROI enabled independently of template
    var roiEnabled = config.processingRoiEnabled === true || rawTemplate === 'object_detection_roi';
    var roiAction = config.processingRoiAction || 'count';
    // Reconstruct ROI from flat config fields (only when enabled)
    var roi = null;
    if (roiEnabled && config.processingRoiX != null && config.processingRoiY != null) {
      roi = { x: config.processingRoiX, y: config.processingRoiY, w: config.processingRoiW || 0.8, h: config.processingRoiH || 0.8 };
    }

    var extStatusState = React.useState('idle');
    var extStatus = extStatusState[0];
    var setExtStatus = extStatusState[1];

    var transformIdState = React.useState(null);
    var transformId = transformIdState[0];
    var setTransformId = transformIdState[1];

    // Client-side processing state
    var procStateState = React.useState('idle');
    var processingState = procStateState[0];
    var setProcessingState = procStateState[1];

    var localDetectionsState = React.useState([]);
    var localDetections = localDetectionsState[0];
    var setLocalDetections = localDetectionsState[1];

    var inferenceTimeState = React.useState(null);
    var inferenceTime = inferenceTimeState[0];
    var setInferenceTime = inferenceTimeState[1];

    var lastProcessedRef = React.useRef('');

    // Periodic refresh tick — forces re-render to pick up latest device telemetry.
    // Device images (base64) may not trigger WS-based re-renders due to:
    // 1. Large payload not included in WS events (only small metrics like ts/battery)
    // 2. Event type mismatch in the platform's DeviceMetric filter
    // The platform's boundDeviceTelemetry useStore subscription IS reactive,
    // but only updates when the store actually changes — which may happen via
    // a background fetch rather than WS. This tick ensures we catch those updates.
    var tickState = React.useState(0);
    var refreshTick = tickState[0];
    var setRefreshTick = tickState[1];
    React.useEffect(function () {
      if (!device) return;
      var timer = setInterval(function () {
        setRefreshTick(function (t) { return t + 1; });
      }, 3000);
      return function () { clearInterval(timer); };
    }, [device ? device.id : null]);

    // Early-extract imageSrc — device may send URL or base64
    var _vals = device ? (device.currentValues || {}) : {};
    var rawImageSrc = getFirst(_vals, ['values.imageUrl', 'values.image', 'values.photo', 'imageUrl', 'image', 'photo', 'values.picture', 'picture']);
    var isBase64Image = rawImageSrc && (rawImageSrc.indexOf('data:image') === 0 || !rawImageSrc.match(/^https?:\/\//));
    // For URL images: append ts-based cache buster; for base64: use as-is (ts change triggers re-render via new imageSrc ref)
    var imgTs = getFirst(_vals, ['ts', 'values.ts', 'timestamp', 'values.timestamp']);
    var imageSrc;
    if (!rawImageSrc) {
      imageSrc = '';
    } else if (isBase64Image) {
      // Ensure base64 has data URI prefix for <img> display
      imageSrc = rawImageSrc.indexOf('data:') === 0 ? rawImageSrc : 'data:image/jpeg;base64,' + rawImageSrc;
    } else {
      imageSrc = rawImageSrc + (rawImageSrc.indexOf('?') >= 0 ? '&' : '?') + '_t=' + (imgTs || 0);
    }

    // Extension check + transform lifecycle (async, non-blocking)
    // Transforms are persistent backend automations — created once, NOT deleted on unmount.
    // On mount: check if transform already exists for this device+extension, create if not.
    React.useEffect(function () {
      if (!processingEnabled || !extensionId || !device) return;

      var neomind = window.neomind;
      if (!neomind || typeof neomind.listExtensions !== 'function') {
        setExtStatus('unavailable');
        return;
      }

      setExtStatus('checking');
      var cancelled = false;
      var transformName = 'ne101-' + device.id + '-' + extensionId;

      neomind.listExtensions().then(function (exts) {
        if (cancelled) return;
        var extList = Array.isArray(exts) ? exts : [];
        var matched = null;
        for (var ei = 0; ei < extList.length; ei++) {
          if (extList[ei].id === extensionId) { matched = extList[ei]; break; }
        }
        if (!matched) { setExtStatus('not_installed'); return; }
        var stateLower = (matched.state || '').toLowerCase();
        if (stateLower.indexOf('stopped') >= 0 || stateLower.indexOf('failed') >= 0 || stateLower.indexOf('error') >= 0) { setExtStatus('offline'); return; }
        setExtStatus('active');

        // Check if transform already exists — avoid duplicates
        if (neomind.listTransforms) {
          return neomind.listTransforms({ scope: device.id }).then(function (transforms) {
            if (cancelled) return;
            var tList = Array.isArray(transforms) ? transforms : [];
            for (var ti = 0; ti < tList.length; ti++) {
              if (tList[ti].name === transformName) {
                // Already exists — reuse it
                setTransformId(tList[ti].id);
                return null; // skip creation
              }
            }
            // Not found — create new transform
            if (!neomind.createTransform) return null;
            var procConfigTpl = { roi: roi, roiAction: roiAction, classFilter: procClassFilter };
            var tplConfig = fillTemplate(procTemplate, extensionId, procConfigTpl);
            var transformArgs = {};
            if (procCategories) transformArgs.categories = procCategories;
            if (procPhrase) transformArgs.phrase = procPhrase;
            var transformPayload = Object.assign({}, tplConfig, {
              name: transformName,
              scope: device.id,
              extension_id: extensionId,
              args: Object.keys(transformArgs).length > 0 ? transformArgs : undefined,
              rule: { device_id: device.id, device_type: 'ne101_camera' }
            });
            return neomind.createTransform(transformPayload);
          });
        }
        // Fallback: no listTransforms, create directly
        if (neomind.createTransform) {
          var procConfigTpl = { roi: roi, roiAction: roiAction, classFilter: procClassFilter };
          var tplConfig = fillTemplate(procTemplate, extensionId, procConfigTpl);
          var transformArgs = {};
          if (procCategories) transformArgs.categories = procCategories;
          if (procPhrase) transformArgs.phrase = procPhrase;
          var transformPayload = Object.assign({}, tplConfig, {
            name: transformName,
            scope: device.id,
            extension_id: extensionId,
            args: Object.keys(transformArgs).length > 0 ? transformArgs : undefined,
            rule: { device_id: device.id, device_type: 'ne101_camera' }
          });
          return neomind.createTransform(transformPayload);
        }
        return null;
      }).then(function (result) {
        if (cancelled || !result) return;
        setTransformId(result.id);
      }).catch(function () {
        if (!cancelled) setExtStatus('error');
      });

      // No cleanup — transforms persist across component lifecycle
      return function () { cancelled = true; };
    }, [device ? device.id : null, processingEnabled, extensionId, procTemplate, roiEnabled, roiAction]);

    // Reset lastProcessedRef when extension becomes active (fixes race condition)
    React.useEffect(function () {
      if (extStatus === 'active') {
        lastProcessedRef.current = '';
      }
    }, [extStatus]);

    // Client-side processing: when new image arrives and no virtual detections, process directly
    React.useEffect(function () {
      if (!processingEnabled || !extensionId || !imageSrc) return;
      // Skip if already processed this image
      if (lastProcessedRef.current === imageSrc) return;
      // Only process when extension is confirmed active (avoid wasted calls during checking)
      if (extStatus !== 'active') return;

      var neomind = window.neomind;
      if (!neomind || typeof neomind.callExtension !== 'function') return;

      // Check if TransformEngine already produced detections
      var detRaw = getFirst(_vals, ['virtual.detections', 'values.virtual.detections']);
      if (Array.isArray(detRaw) && detRaw.length > 0) {
        lastProcessedRef.current = imageSrc;
        setProcessingState('done');
        return;
      }

      // Mark as running to prevent re-entry
      lastProcessedRef.current = imageSrc;
      setProcessingState('running');
      setLocalDetections([]);
      setInferenceTime(null);

      // Resolve command from extension + template
      var command = getExtCommand(extensionId, procTemplate);
      var mode = getExtMode(extensionId, procTemplate);
      var imageArg = (mode && mode.imageArg) || 'image';

      var cancelled = false;

      // Extract pure base64 string (strip data URI prefix if present)
      var rawB64 = rawImageSrc || '';
      if (rawB64.indexOf('data:') === 0) {
        var commaIdx = rawB64.indexOf(',');
        if (commaIdx >= 0) rawB64 = rawB64.substring(commaIdx + 1);
      }

      // Build args for extension
      var callArgs = {};
      callArgs[imageArg] = rawB64;
      if (procCategories) callArgs.categories = procCategories;
      if (procPhrase) callArgs.phrase = procPhrase;

      // Load image to get dimensions for coordinate normalization (async)
      var img = new Image();
      img.onload = function () {
        if (cancelled) return;

        neomind.callExtension(extensionId, command, callArgs).then(function (resp) {
          if (cancelled) return;

          var imgW = img.naturalWidth || 1;
          var imgH = img.naturalHeight || 1;
          var respType = (mode && mode.responseType) || 'boxes_x1y1x2y2';
          var norm = normalizeResponse(resp, respType, imgW, imgH);

          if (!norm.detections || norm.detections.length === 0) {
            setProcessingState('done');
            return;
          }

          setLocalDetections(norm.detections);
          setProcessingState('done');
          if (norm.inferenceTimeMs != null) setInferenceTime(norm.inferenceTimeMs);

          // Write back as virtual metric so dashboard can persist it
          if (neomind.writeMetric) {
            neomind.writeMetric(device.id, 'virtual.detections', norm.detections).catch(function () {});
            if (norm.texts) neomind.writeMetric(device.id, 'virtual.texts', norm.texts).catch(function () {});
          }
        }).catch(function () {
          if (!cancelled) setProcessingState('error');
        });
      };
      img.onerror = function () {
        if (!cancelled) setProcessingState('error');
      };
      img.src = imageSrc;

      return function () { cancelled = true; };
    }, [imageSrc, processingEnabled, extensionId, extStatus, refreshTick]);

    if (!device) return jsx(NoDevice, {});

    var vals = _vals;
    var online = device.status === 'online';
    var batteryVal = getFirst(vals, ['values.battery', 'battery']);
    var devName = device.name || getFirst(vals, ['values.devName', 'devName']) || 'NE101 Camera';

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

    // Virtual metrics (from processing pipeline) + client-side detections
    var detections = [];
    if (processingEnabled) {
      var detRaw = getFirst(vals, ['virtual.detections', 'values.virtual.detections']);
      if (Array.isArray(detRaw) && detRaw.length > 0) {
        detections = detRaw;
      } else if (localDetections.length > 0) {
        detections = localDetections;
      }
    }

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

    // Pipeline status badge (non-blocking, degrades gracefully)
    if (processingEnabled && extStatus !== 'idle') {
      var statusMap = {
        checking: { color: 'rgba(234,179,8,0.9)', label: 'Checking...' },
        active: { color: 'rgba(34,197,94,0.9)', label: processingState === 'running' ? 'Processing...' : 'Pipeline Active' },
        not_installed: { color: 'rgba(239,68,68,0.9)', label: 'Ext. Not Installed' },
        offline: { color: 'rgba(234,179,8,0.9)', label: 'Ext. Offline' },
        error: { color: 'rgba(239,68,68,0.9)', label: processingState === 'error' ? 'Processing Failed' : 'Pipeline Error' },
        unavailable: { color: 'rgba(128,128,128,0.6)', label: 'API Unavailable' }
      };
      var sc = statusMap[extStatus] || statusMap.error;
      topRightBadges.push(
        jsxs('div', {
          key: 'pipeline',
          className: 'flex items-center gap-1 px-1.5 py-0.5 rounded-md',
          style: Object.assign({}, bgBadgeStyle, textShadow),
          children: [
            jsx('div', {
              key: 'dot',
              className: processingState === 'running' ? 'animate-spin' : '',
              style: {
                width: '6px', height: '6px', borderRadius: '50%',
                border: processingState === 'running' ? '1.5px solid rgba(255,255,255,0.3)' : 'none',
                borderTopColor: processingState === 'running' ? sc.color : undefined,
                background: processingState === 'running' ? 'transparent' : sc.color
              }
            }),
            jsx('span', { key: 'lbl', style: Object.assign({}, white, { fontSize: '8px', fontWeight: '500' }), children: sc.label })
          ]
        })
      );
    }

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

    // Detection summary (from processing pipeline + virtual metrics)
    if (processingEnabled && (detections.length > 0 || getFirst(vals, ['virtual.total_count', 'values.virtual.total_count']) != null)) {
      // Read virtual metrics produced by backend transform
      var vTotalCount = getFirst(vals, ['virtual.total_count', 'values.virtual.total_count']);
      var vRoiCount = getFirst(vals, ['virtual.roi_count', 'values.virtual.roi_count']);
      var vCountByClass = getFirst(vals, ['virtual.count_by_class', 'values.virtual.count_by_class']);
      var vTexts = getFirst(vals, ['virtual.texts', 'values.virtual.texts']);

      var displayCount = vTotalCount != null ? vTotalCount : detections.length;
      var detLabels = detections.slice(0, 4).map(function (d) { return d.label || '?'; });

      var detSummaryChildren = [];
      detSummaryChildren.push(
        jsx('span', {
          key: 'count',
          style: Object.assign({}, white, bgMetricStyle, textShadow, { fontSize: '9px', fontWeight: '600', padding: '2px 6px', borderRadius: '4px' }),
          children: displayCount + ' detected'
        })
      );

      // ROI count badge
      if (vRoiCount != null) {
        detSummaryChildren.push(
          jsxs('span', {
            key: 'roi-count',
            style: Object.assign({}, white80, { fontSize: '8px', fontWeight: '600', padding: '2px 5px', borderRadius: '3px', background: 'rgba(255,200,50,0.25)', border: '1px solid rgba(255,200,50,0.4)' }),
            children: ['ROI: ', jsx('span', { key: 'n', style: { fontFamily: 'monospace' }, children: vRoiCount })]
          })
        );
      }

      // Class breakdown from count_by_class metric
      if (vCountByClass && typeof vCountByClass === 'object') {
        var classKeys = Object.keys(vCountByClass);
        for (var ci = 0; ci < Math.min(classKeys.length, 4); ci++) {
          var cls = classKeys[ci];
          var clsCount = vCountByClass[cls];
          detSummaryChildren.push(
            jsxs('span', {
              key: 'cls-' + cls,
              style: Object.assign({}, white80, bgMetricStyle, textShadow, { fontSize: '8px', padding: '1px 4px', borderRadius: '3px' }),
              children: [cls + ' ', jsx('span', { key: 'n', style: { fontFamily: 'monospace', fontWeight: '600' }, children: clsCount })]
            })
          );
        }
      } else {
        // Fallback: show detection labels from bounding boxes
        for (var li = 0; li < detLabels.length; li++) {
          detSummaryChildren.push(
            jsx('span', { key: 'dl-' + li, style: Object.assign({}, white60, textShadow, { fontSize: '8px' }), children: detLabels[li] })
          );
        }
      }

      // Extracted texts (from text_detection template)
      if (Array.isArray(vTexts) && vTexts.length > 0) {
        var textPreview = vTexts.slice(0, 3).join(', ');
        if (vTexts.length > 3) textPreview += '...';
        detSummaryChildren.push(
          jsxs('span', {
            key: 'texts',
            style: Object.assign({}, white80, { fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.4)' }),
            children: ['"', textPreview, '"']
          })
        );
      }

      if (inferenceTime != null) {
        detSummaryChildren.push(
          jsx('span', { key: 'inf', style: Object.assign({}, white50, textShadow, { fontSize: '8px', fontFamily: 'monospace' }), children: Math.round(inferenceTime) + 'ms' })
        );
      }

      bottomChildren.push(
        jsx('div', {
          key: 'det',
          className: 'flex items-center gap-1.5 flex-wrap',
          children: detSummaryChildren
        })
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
                }),
                // ROI rectangle overlay
                processingEnabled && roi
                  ? jsxs('div', {
                      key: 'roi-rect',
                      className: 'absolute',
                      style: {
                        left: (roi.x * 100) + '%',
                        top: (roi.y * 100) + '%',
                        width: (roi.w * 100) + '%',
                        height: (roi.h * 100) + '%',
                        border: '1.5px dashed rgba(255,200,50,0.7)',
                        borderRadius: '2px',
                        pointerEvents: 'none'
                      },
                      children: [
                        jsx('span', {
                          key: 'roi-label',
                          style: {
                            position: 'absolute', top: '-13px', left: '-1px',
                            background: 'rgba(255,200,50,0.85)', color: '#000',
                            fontSize: '7px', fontWeight: '700', padding: '1px 4px',
                            borderRadius: '2px', whiteSpace: 'nowrap', fontFamily: 'monospace'
                          },
                          children: 'ROI'
                        })
                      ]
                    })
                  : null,
                // Detection boxes overlay (virtual metrics from processing pipeline)
                processingEnabled && detections.length > 0
                  ? jsx('div', {
                      key: 'det-boxes',
                      className: 'absolute inset-0',
                      style: { pointerEvents: 'none' },
                      children: detections.map(function (det, i) {
                        if (!det.bbox || det.bbox.length < 4) return null;
                        var bx1 = det.bbox[0], by1 = det.bbox[1], bx2 = det.bbox[2], by2 = det.bbox[3];
                        var detLabel = det.label || '';
                        var detConf = typeof det.confidence === 'number' ? Math.round(det.confidence * 100) : '';
                        return jsxs('div', {
                          key: 'dbox-' + i,
                          className: 'absolute',
                          style: {
                            left: (bx1 * 100) + '%', top: (by1 * 100) + '%',
                            width: ((bx2 - bx1) * 100) + '%', height: ((by2 - by1) * 100) + '%',
                            border: '1.5px solid rgba(59,130,246,0.8)', borderRadius: '2px',
                            boxShadow: '0 0 4px rgba(59,130,246,0.3)'
                          },
                          children: (detLabel || detConf)
                            ? jsxs('span', {
                                style: {
                                  position: 'absolute', top: '-14px', left: '-1px',
                                  background: 'rgba(59,130,246,0.85)', color: '#fff',
                                  fontSize: '8px', fontWeight: '600', padding: '1px 4px',
                                  borderRadius: '2px', whiteSpace: 'nowrap', fontFamily: 'monospace'
                                },
                                children: [detLabel, detConf ? ' ' + detConf + '%' : '']
                              })
                            : null
                        });
                      })
                    })
                  : null
              ]
            })
          : jsxs('div', {
              key: 'media',
              className: 'w-full h-full flex flex-col items-center justify-center',
              style: { background: 'rgba(128,128,128,0.15)' },
              children: [
                jsx('div', { key: 'icon', className: 'w-10 h-10 rounded-lg flex items-center justify-center mb-2', style: { background: 'rgba(161,161,170,0.15)' }, children:
                  jsx('span', { style: Object.assign({}, mutedFg, { fontSize: '12px', fontWeight: '700' }), children: 'CAM' })
                }),
                jsx('span', { key: 'hint', style: Object.assign({}, mutedFgSub, { fontSize: '10px' }), children: online ? 'Waiting for capture...' : 'Device offline' })
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

  // ---------------------------------------------------------------------------
  // Shared UI helpers — match shadcn component CSS exactly
  // ---------------------------------------------------------------------------
  // shadcn Input classes (from components/ui/input.tsx)
  var INPUT_CLS = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
  // shadcn Label classes (from components/ui/label.tsx)
  var LABEL_CLS = 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70';
  // shadcn Field wrapper (from components/ui/field.tsx)
  var FIELD_CLS = 'flex flex-col gap-1.5';
  // shadcn Description
  var DESC_CLS = 'text-sm text-muted-foreground';

  // shadcn Switch replica — uses data-state to trigger same CSS rules
  function SwitchControl(checked, onChangeFn) {
    var state = checked ? 'checked' : 'unchecked';
    return jsx('button', {
      type: 'button',
      role: 'switch',
      'data-state': state,
      'aria-checked': String(checked),
      onClick: onChangeFn,
      className: 'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
      children: jsx('span', {
        'data-state': state,
        className: 'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'
      })
    });
  }

  // ---------------------------------------------------------------------------
  // ConfigPanel — Display tab
  // ---------------------------------------------------------------------------
  function ConfigPanel(props) {
    // Title field is provided by the platform (ComponentConfigDialog → titleSection)
    // No custom fields needed — this keeps Display tab clean with just the platform title
    return jsx('div', { className: 'space-y-3', children: null });
  }


  // ---------------------------------------------------------------------------
  // AdvancedPanel — Advanced tab: AI processing, extension-aware templates, ROI
  // ---------------------------------------------------------------------------

  var ROI_ACTIONS = [
    { id: 'count', label: 'Count', desc: 'Count objects in ROI' },
    { id: 'count_by_class', label: 'Count by Class', desc: 'Per-class count in ROI' },
    { id: 'filter', label: 'Filter', desc: 'Only show detections in ROI' }
  ];

  // shadcn-style dropdown (replaces native <select>)
  function ExtDropdown(props) {
    var exts = props.extensions;
    var value = props.value;
    var onChangeFn = props.onChange;
    var loading = props.loading;

    var openSt = React.useState(false);
    var open = openSt[0];
    var setOpen = openSt[1];
    var wrapRef = React.useRef(null);

    React.useEffect(function () {
      if (!open) return;
      function handler(e) {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
      }
      document.addEventListener('mousedown', handler);
      return function () { document.removeEventListener('mousedown', handler); }
    }, [open]);

    if (loading) {
      return jsx('div', { className: INPUT_CLS + ' flex items-center text-muted-foreground', children: 'Loading extensions...' });
    }

    var selExt = null;
    for (var i = 0; i < exts.length; i++) {
      if (exts[i].id === value) { selExt = exts[i]; break; }
    }

    var optItems = [];
    for (var j = 0; j < exts.length; j++) {
      (function (ext) {
        var stateCls = ext.state === 'running' ? 'bg-green-500' : 'bg-zinc-400';
        optItems.push(
          jsx('button', {
            key: ext.id,
            type: 'button',
            className: 'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground' + (ext.id === value ? ' bg-accent text-accent-foreground' : ''),
            onClick: function () { onChangeFn(ext.id); setOpen(false); },
            children: jsxs('div', { className: 'flex items-center gap-2 w-full', children: [
              jsx('div', { className: 'h-1.5 w-1.5 rounded-full shrink-0 ' + stateCls }),
              jsxs('div', { className: 'flex flex-col items-start min-w-0', children: [
                jsx('span', { className: 'truncate', children: ext.name }),
                jsx('span', { className: 'text-xs text-muted-foreground truncate', children: ext.id })
              ]})
            ]})
          })
        );
      })(exts[j]);
    }

    var triggerLabel = selExt
      ? jsxs('span', { className: 'flex items-center gap-2 truncate', children: [
          jsx('div', { className: 'h-1.5 w-1.5 rounded-full shrink-0 ' + (selExt.state === 'running' ? 'bg-green-500' : 'bg-zinc-400') }),
          jsx('span', { children: selExt.name })
        ]})
      : jsx('span', { className: 'text-muted-foreground', children: 'Select extension...' });

    return jsxs('div', { ref: wrapRef, className: 'relative', children: [
      jsx('button', {
        type: 'button',
        className: INPUT_CLS + ' flex items-center justify-between cursor-pointer',
        onClick: function () { setOpen(!open); },
        children: jsxs('span', { className: 'flex items-center gap-2 w-full', children: [
          jsx('span', { className: 'truncate flex-1 text-left', children: triggerLabel }),
          jsx('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'ml-2 shrink-0 opacity-50', children: jsx('path', { d: 'm6 9 6 6 6-6' }) })
        ]})
      }),
      open && optItems.length > 0
        ? jsx('div', {
            className: 'absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md',
            children: jsx('div', { className: 'p-1 max-h-48 overflow-y-auto', children: optItems })
          })
        : null
    ]});
  }

  function AdvancedPanel(props) {
    var config = props.config || {};
    var onChange = props.onChange;

    var enabled = config.processingEnabled === true;
    // Backward compat: object_detection_roi → object_detection + roiEnabled
    var rawTemplate = config.processingTemplate || 'object_detection';
    var template = rawTemplate === 'object_detection_roi' ? 'object_detection' : rawTemplate;
    var roiEnabled = config.processingRoiEnabled === true || rawTemplate === 'object_detection_roi';
    var roiAction = config.processingRoiAction || 'count';
    var selectedExtId = config.processingExtensionId || '';

    // ROI editor state
    var roiRef = React.useRef(null);
    var dragRef = React.useRef(null);
    var roiX = config.processingRoiX != null ? config.processingRoiX : 0.1;
    var roiY = config.processingRoiY != null ? config.processingRoiY : 0.1;
    var roiW = config.processingRoiW != null ? config.processingRoiW : 0.8;
    var roiH = config.processingRoiH != null ? config.processingRoiH : 0.8;

    // Extension list (auto-fetched, filtered to AI extensions only)
    var extState = React.useState({ list: [], loading: false, error: null });
    var extLoading = extState[0].loading;

    React.useEffect(function () {
      if (!enabled) return;
      var neomind = window.neomind;
      if (!neomind || typeof neomind.listExtensions !== 'function') return;
      extState[1]({ list: [], loading: true, error: null });
      neomind.listExtensions().then(function (exts) {
        var arr = Array.isArray(exts) ? exts : [];
        // Filter to AI extensions only
        var filtered = [];
        for (var i = 0; i < arr.length; i++) {
          if (AI_EXT_IDS.indexOf(arr[i].id) >= 0) filtered.push(arr[i]);
        }
        extState[1]({ list: filtered, loading: false, error: null });
      }).catch(function () {
        extState[1]({ list: [], loading: false, error: 'Failed to load extensions' });
      });
    }, [enabled]);

    var extensions = extState[0].list;

    // Available modes for the selected extension
    var availableModes = selectedExtId ? getExtModes(selectedExtId) : [];
    // If current template is not in available modes, auto-switch to first available
    var validTemplate = template;
    if (availableModes.length > 0) {
      var found = false;
      for (var mi = 0; mi < availableModes.length; mi++) {
        if (availableModes[mi].id === template) { found = true; break; }
      }
      if (!found) validTemplate = availableModes[0].id;
    }

    // ROI drag handler
    function handleRoiMouseDown(e) {
      var el = roiRef.current; if (!el) return;
      var rect = el.getBoundingClientRect();
      var nx = (e.clientX - rect.left) / rect.width;
      var ny = (e.clientY - rect.top) / rect.height;
      var hs = 0.06;
      var atL = Math.abs(nx - roiX) < hs, atR = Math.abs(nx - (roiX + roiW)) < hs;
      var atT = Math.abs(ny - roiY) < hs, atB = Math.abs(ny - (roiY + roiH)) < hs;
      var inside = nx >= roiX && nx <= roiX + roiW && ny >= roiY && ny <= roiY + roiH;
      var mode = null;
      if (atR && atB) mode = 'se'; else if (atL && atB) mode = 'sw';
      else if (atR && atT) mode = 'ne'; else if (atL && atT) mode = 'nw';
      else if (inside) mode = 'move';
      if (!mode) return;
      e.preventDefault();
      dragRef.current = { mode: mode, sx: nx, sy: ny, ox: roiX, oy: roiY, ow: roiW, oh: roiH };
      function onMove(ev) {
        var d = dragRef.current; if (!d) return;
        var r = roiRef.current.getBoundingClientRect();
        var cx = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
        var cy = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
        var dx = cx - d.sx, dy = cy - d.sy;
        var nx2 = d.ox, ny2 = d.oy, nw = d.ow, nh = d.oh;
        if (d.mode === 'move') { nx2 += dx; ny2 += dy; }
        else if (d.mode === 'se') { nw += dx; nh += dy; }
        else if (d.mode === 'sw') { nx2 += dx; nw -= dx; nh += dy; }
        else if (d.mode === 'ne') { nw += dx; ny2 += dy; nh -= dy; }
        else if (d.mode === 'nw') { nx2 += dx; ny2 += dy; nw -= dx; nh -= dy; }
        nw = Math.max(0.05, nw); nh = Math.max(0.05, nh);
        nx2 = Math.max(0, Math.min(1 - nw, nx2));
        ny2 = Math.max(0, Math.min(1 - nh, ny2));
        onChange('processingRoiX', Math.round(nx2 * 100) / 100);
        onChange('processingRoiY', Math.round(ny2 * 100) / 100);
        onChange('processingRoiW', Math.round(nw * 100) / 100);
        onChange('processingRoiH', Math.round(nh * 100) / 100);
      }
      function onUp() { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    var items = [];

    // Toggle
    items.push(
      jsxs('div', { key: 'toggle', className: 'flex items-center justify-between', children: [
        jsx('label', { className: LABEL_CLS + ' cursor-pointer', children: 'Enable AI Processing' }),
        SwitchControl(enabled, function () { onChange('processingEnabled', !enabled); })
      ]})
    );

    if (enabled) {
      // Extension selector — custom dropdown, AI extensions only
      items.push(
        jsxs('div', { key: 'ext', className: FIELD_CLS, children: [
          jsx('label', { className: LABEL_CLS, children: 'AI Extension' }),
          jsx(ExtDropdown, {
            extensions: extensions,
            value: selectedExtId,
            onChange: function (id) { onChange('processingExtensionId', id); },
            loading: extLoading
          }),
          extensions.length === 0 && !extLoading
            ? jsx('p', { className: DESC_CLS, children: 'No AI extensions installed' })
            : null
        ]})
      );

      // Mode cards — only show modes available for the selected extension
      if (availableModes.length > 0) {
        var tplCards = availableModes.map(function (m) {
          var selected = validTemplate === m.id;
          return jsx('button', {
            key: m.id,
            type: 'button',
            onClick: function () { onChange('processingTemplate', m.id); },
            className: 'flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-colors ' +
              (selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-muted-foreground/30'),
            children: jsxs('div', { className: 'flex items-center gap-2', children: [
              jsx('span', { className: 'text-base', children: m.icon }),
              jsxs('div', { className: 'flex flex-col', children: [
                jsx('span', { className: 'text-sm font-medium ' + (selected ? 'text-primary' : ''), children: m.label }),
                jsx('span', { className: 'text-xs text-muted-foreground', children: m.desc })
              ]})
            ]})
          });
        });
        items.push(
          jsxs('div', { key: 'tpl', className: FIELD_CLS, children: [
            jsx('label', { className: LABEL_CLS, children: 'Working Mode' }),
            jsx('div', { className: 'grid grid-cols-1 gap-2', children: tplCards })
          ]})
        );
      }

      // Mode-specific fields (only show if the mode supports them)
      var currentMode = null;
      for (var cmi = 0; cmi < availableModes.length; cmi++) {
        if (availableModes[cmi].id === validTemplate) { currentMode = availableModes[cmi]; break; }
      }
      var modeArgs = currentMode ? (currentMode.args || []) : [];
      if (modeArgs.indexOf('categories') >= 0) {
        items.push(
          jsxs('div', { key: 'cat', className: FIELD_CLS, children: [
            jsx('label', { className: LABEL_CLS, children: 'Detection Categories' }),
            jsx('input', { className: INPUT_CLS, value: config.processingCategories || '', placeholder: 'person, car, dog', onChange: function (e) { onChange('processingCategories', e.target.value); } })
          ]})
        );
      }
      if (modeArgs.indexOf('phrase') >= 0) {
        items.push(
          jsxs('div', { key: 'phrase', className: FIELD_CLS, children: [
            jsx('label', { className: LABEL_CLS, children: 'Search Phrase' }),
            jsx('input', { className: INPUT_CLS, value: config.processingPhrase || '', placeholder: 'Describe what to find', onChange: function (e) { onChange('processingPhrase', e.target.value); } })
          ]})
        );
      }

      // Class filter
      items.push(
        jsxs('div', { key: 'cf', className: FIELD_CLS, children: [
          jsx('label', { className: LABEL_CLS, children: 'Class Filter' }),
          jsx('input', { className: INPUT_CLS, value: config.processingClassFilter || '', placeholder: 'Empty = all classes', onChange: function (e) { onChange('processingClassFilter', e.target.value); } }),
          jsx('p', { className: DESC_CLS, children: 'Comma-separated class names to include' })
        ]})
      );

      // ── ROI (independent of template) ──
      items.push(
        jsxs('div', { key: 'roi-div', className: 'flex items-center justify-between pt-3 border-t', children: [
          jsx('label', { className: LABEL_CLS + ' cursor-pointer', children: 'Region of Interest (ROI)' }),
          SwitchControl(roiEnabled, function () { onChange('processingRoiEnabled', !roiEnabled); })
        ]})
      );

      if (roiEnabled) {
        // ROI action selector
        var actionChips = ROI_ACTIONS.map(function (a) {
          var selected = roiAction === a.id;
          return jsx('button', {
            key: a.id,
            type: 'button',
            onClick: function () { onChange('processingRoiAction', a.id); },
            className: 'px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ' +
              (selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/30'),
            children: a.label
          });
        });
        items.push(
          jsxs('div', { key: 'roi-act', className: FIELD_CLS, children: [
            jsx('label', { className: LABEL_CLS, children: 'ROI Action' }),
            jsx('div', { className: 'flex gap-2', children: actionChips })
          ]})
        );

        // ROI visual editor
        items.push(
          jsxs('div', { key: 'roi-editor', className: 'space-y-2', children: [
            jsx('p', { className: DESC_CLS, children: 'Drag to move, corners to resize' }),
            jsxs('div', {
              ref: roiRef,
              className: 'relative w-full rounded-md overflow-hidden select-none',
              style: { aspectRatio: '4/3', background: '#18181b', backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '10% 10%', cursor: 'crosshair' },
              onMouseDown: handleRoiMouseDown,
              children: [
                jsxs('div', {
                  key: 'rect',
                  className: 'absolute',
                  style: { left: (roiX*100)+'%', top: (roiY*100)+'%', width: (roiW*100)+'%', height: (roiH*100)+'%', border: '2px dashed rgba(250,204,21,0.8)', backgroundColor: 'rgba(250,204,21,0.06)', borderRadius: '2px', cursor: 'move' },
                  children: [
                    jsx('span', { key: 'lbl', style: { position: 'absolute', top: '-16px', left: '0', background: 'rgba(250,204,21,0.9)', color: '#000', fontSize: '9px', fontWeight: '700', padding: '1px 4px', borderRadius: '2px', fontFamily: 'monospace', whiteSpace: 'nowrap' }, children: 'ROI' }),
                    jsx('div', { key: 'nw', style: { position: 'absolute', top: '-4px', left: '-4px', width: '8px', height: '8px', background: '#facc15', borderRadius: '50%', cursor: 'nw-resize' } }),
                    jsx('div', { key: 'ne', style: { position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', background: '#facc15', borderRadius: '50%', cursor: 'ne-resize' } }),
                    jsx('div', { key: 'sw', style: { position: 'absolute', bottom: '-4px', left: '-4px', width: '8px', height: '8px', background: '#facc15', borderRadius: '50%', cursor: 'sw-resize' } }),
                    jsx('div', { key: 'se', style: { position: 'absolute', bottom: '-4px', right: '-4px', width: '8px', height: '8px', background: '#facc15', borderRadius: '50%', cursor: 'se-resize' } })
                  ]
                })
              ]
            }),
            // Fine-tuning sliders
            jsxs('div', { key: 'sliders', className: 'grid grid-cols-2 gap-x-4 gap-y-2', children: [
              jsxs('div', { key: 'x', className: FIELD_CLS, children: [
                jsxs('div', { className: 'flex justify-between', children: [ jsx('span', { className: DESC_CLS, children: 'X' }), jsx('span', { className: DESC_CLS + ' font-mono', children: roiX.toFixed(2) }) ]}),
                jsx('input', { type: 'range', min: 0, max: 1, step: 0.01, value: roiX, onChange: function (e) { onChange('processingRoiX', Number(e.target.value)); }, className: 'w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer' })
              ]}),
              jsxs('div', { key: 'y', className: FIELD_CLS, children: [
                jsxs('div', { className: 'flex justify-between', children: [ jsx('span', { className: DESC_CLS, children: 'Y' }), jsx('span', { className: DESC_CLS + ' font-mono', children: roiY.toFixed(2) }) ]}),
                jsx('input', { type: 'range', min: 0, max: 1, step: 0.01, value: roiY, onChange: function (e) { onChange('processingRoiY', Number(e.target.value)); }, className: 'w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer' })
              ]}),
              jsxs('div', { key: 'w', className: FIELD_CLS, children: [
                jsxs('div', { className: 'flex justify-between', children: [ jsx('span', { className: DESC_CLS, children: 'Width' }), jsx('span', { className: DESC_CLS + ' font-mono', children: roiW.toFixed(2) }) ]}),
                jsx('input', { type: 'range', min: 0.05, max: 1, step: 0.01, value: roiW, onChange: function (e) { onChange('processingRoiW', Number(e.target.value)); }, className: 'w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer' })
              ]}),
              jsxs('div', { key: 'h', className: FIELD_CLS, children: [
                jsxs('div', { className: 'flex justify-between', children: [ jsx('span', { className: DESC_CLS, children: 'Height' }), jsx('span', { className: DESC_CLS + ' font-mono', children: roiH.toFixed(2) }) ]}),
                jsx('input', { type: 'range', min: 0.05, max: 1, step: 0.01, value: roiH, onChange: function (e) { onChange('processingRoiH', Number(e.target.value)); }, className: 'w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer' })
              ]})
            ]})
          ]})
        );
      }
    }

    return jsx('div', { className: 'space-y-3', children: items });
  }
  return { default: NE101CameraPanel, NE101CameraPanel: NE101CameraPanel, ConfigPanel: ConfigPanel, AdvancedPanel: AdvancedPanel };
})();
