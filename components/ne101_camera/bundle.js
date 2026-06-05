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

  // SVG icons for AI mode cards (Lucide-style)
  var _iconBase = { fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  function ModeIcon(type) {
    switch (type) {
      case 'search':
        return jsx('svg', Object.assign({}, _iconBase, { width: '18', height: '18', viewBox: '0 0 24 24', children:
          jsxs('g', { children: [
            jsx('circle', { cx: '11', cy: '11', r: '8' }),
            jsx('path', { d: 'm21 21-4.3-4.3' })
          ]})
        }));
      case 'target':
        return jsx('svg', Object.assign({}, _iconBase, { width: '18', height: '18', viewBox: '0 0 24 24', children:
          jsxs('g', { children: [
            jsx('circle', { cx: '12', cy: '12', r: '10' }),
            jsx('circle', { cx: '12', cy: '12', r: '6' }),
            jsx('circle', { cx: '12', cy: '12', r: '2' })
          ]})
        }));
      case 'text':
        return jsx('svg', Object.assign({}, _iconBase, { width: '18', height: '18', viewBox: '0 0 24 24', children:
          jsxs('g', { children: [
            jsx('path', { d: 'M4 7V4h16v3' }),
            jsx('path', { d: 'M9 20h6' }),
            jsx('path', { d: 'M12 4v16' })
          ]})
        }));
      case 'monitor':
        return jsx('svg', Object.assign({}, _iconBase, { width: '18', height: '18', viewBox: '0 0 24 24', children:
          jsxs('g', { children: [
            jsx('rect', { x: '2', y: '3', width: '20', height: '14', rx: '2' }),
            jsx('path', { d: 'M8 21h8' }),
            jsx('path', { d: 'M12 17v4' })
          ]})
        }));
      case 'cursor':
        return jsx('svg', Object.assign({}, _iconBase, { width: '18', height: '18', viewBox: '0 0 24 24', children:
          jsx('path', { d: 'm4 4 7.07 17 2.51-7.39L21 11.07z' })
        }));
      default:
        return jsx('svg', Object.assign({}, _iconBase, { width: '18', height: '18', viewBox: '0 0 24 24', children:
          jsx('circle', { cx: '12', cy: '12', r: '10' })
        }));
    }
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
      { id: 'object_detection', command: 'detect', imageArg: 'image_base64', responseType: 'boxes_x1y1x2y2', label: 'Object Detection', desc: 'Detect objects by category', icon: 'search', args: ['categories'] },
      { id: 'grounding', command: 'ground', imageArg: 'image_base64', responseType: 'boxes_x1y1x2y2', label: 'Grounding', desc: 'Find objects by description', icon: 'target', args: ['phrase'] },
      { id: 'text_detection', command: 'detect_text', imageArg: 'image_base64', responseType: 'boxes_x1y1x2y2', label: 'Text Detection', desc: 'Extract text from image', icon: 'text', args: [] },
      { id: 'ground_gui', command: 'ground_gui', imageArg: 'image_base64', responseType: 'boxes_x1y1x2y2', label: 'UI Grounding', desc: 'Locate UI elements by description', icon: 'monitor', args: ['phrase'] },
      { id: 'point', command: 'point', imageArg: 'image_base64', responseType: 'boxes_x1y1x2y2', label: 'Point', desc: 'Point to specific objects', icon: 'cursor', args: ['phrase'] }
    ],
    'image-analyzer-v2': [
      { id: 'object_detection', command: 'analyze_image', imageArg: 'image', responseType: 'objects_bbox', label: 'Object Detection', desc: 'YOLOv8 object detection', icon: 'search', args: [] }
    ],
    'yolo-device-inference': [
      { id: 'object_detection', command: 'analyze_image', imageArg: 'image', responseType: 'detections_bbox', label: 'Object Detection', desc: 'YOLOv8 device inference', icon: 'search', args: [] }
    ],
    'ocr-device-inference': [
      { id: 'text_detection', command: 'recognize_image', imageArg: 'image', responseType: 'ocr_text_blocks', label: 'Text Detection', desc: 'OCR text recognition', icon: 'text', args: [] }
    ]
  };

  /** Get a single mode definition for an extension + template */
  function getExtMode(extensionId, templateName) {
    var modes = EXT_MODES[extensionId];
    if (modes) {
      for (var i = 0; i < modes.length; i++) {
        if (modes[i].id === templateName) return modes[i];
      }
    }
    // Fallback: return default object_detection mode for unknown extensions
    // This allows Transform creation to proceed even for unlisted extensions
    return {
      id: templateName || 'object_detection',
      command: 'detect',
      imageArg: 'image',
      responseType: 'boxes_x1y1x2y2',
      label: 'Object Detection',
      desc: 'Generic detection',
      icon: 'search',
      args: []
    };
  }

  /** Get available modes for an extension */
  function getExtModes(extensionId) {
    return EXT_MODES[extensionId] || [{ id: 'object_detection', command: 'detect', imageArg: 'image', responseType: 'boxes_x1y1x2y2', label: 'Object Detection', desc: 'Generic detection', icon: 'search' }];
  }

  /** Build ROI object from a pipeline config */
  function pipeRoi(pipe) {
    if (!pipe.roiEnabled) return null;
    if (pipe.roiX == null || pipe.roiY == null) return null;
    // Ensure all required values are valid numbers
    var x = Number(pipe.roiX) || 0;
    var y = Number(pipe.roiY) || 0;
    var w = Number(pipe.roiW) || 0.8;
    var h = Number(pipe.roiH) || 0.8;
    if (w <= 0) w = 0.8;
    if (h <= 0) h = 0.8;
    return { x: x, y: y, w: w, h: h };
  }

  /**
   * Generate a js_code string for a single pipeline in a TransformAutomation.
   * Uses extensions.invoke() for AI extension calls.
   * Virtual metrics are namespaced: virtual.{ext_id}.{metric}
   *
   * @param {object} pipe - A pipeline config object { extId, template, categories, phrase, classFilter, roiEnabled, roiAction, roiX/Y/W/H }
   */
  function generateTransformJsCode(pipe) {
    var extensionId = pipe.extId;
    // Remove any 'virtual' prefix in various formats (defensive)
    if (extensionId.indexOf('virtual') === 0) {
      // Handle: virtual-xxx, virtual.xxx, virtual_xxx
      extensionId = extensionId.replace(/^virtual[._-]/, '');
    }
    var templateName = pipe.template;
    var mode = getExtMode(extensionId, templateName);
    if (!mode) return '';

    var extKey = extensionId.replace(/-/g, '_');
    var pfx = extKey + '.';
    var imageArg = mode.imageArg;
    var hasCats = (mode.args || []).indexOf('categories') >= 0 && pipe.categories;
    var hasPhrase = (mode.args || []).indexOf('phrase') >= 0 && pipe.phrase;
    var roi = pipeRoi(pipe);
    var roiAction = pipe.roiAction || 'count';
    var classFilter = pipe.classFilter;

    var L = [];
    L.push('// NE101 Camera Transform');
    L.push('// Extension: ' + extensionId + ' | Mode: ' + mode.label);
    L.push('// Generated by component config — safe to customize');
    L.push('');

    // Input
    L.push('var imageData = __imageData || (input_raw && input_raw.values && input_raw.values.image) || (input_raw && input_raw.image) || \'\';');
    L.push('if (!imageData) return {};');
    L.push('');

    // Image dimensions for coordinate normalization
    L.push('var W = (imageMeta && imageMeta.width) || 1;');
    L.push('var H = (imageMeta && imageMeta.height) || 1;');
    L.push('');

    // Extension invocation — params use __imageData (injected by platform)
    L.push('var r = extensions.invoke(\'' + extensionId + '\', \'' + mode.command + '\', {');
    L.push('  ' + imageArg + ': __imageData');
    if (hasCats) L.push(',  categories: \'' + pipe.categories.replace(/'/g, "\\'") + '\'');
    if (hasPhrase) L.push(',  phrase: \'' + pipe.phrase.replace(/'/g, "\\'") + '\'');
    L.push('});');
    L.push('');

    // Parse detections based on response type
    L.push('// Parse detections from extension response');
    if (mode.responseType === 'boxes_x1y1x2y2') {
      L.push('var rawBoxes = r.boxes || [];');
      L.push('var refTags = (r.answer || \'\').match(/<ref>(.*?)<\\/ref>/g) || [];');
      L.push('var dets = rawBoxes.map(function(b, i) {');
      L.push('  return {');
      L.push('    bbox: [b.x1 / W, b.y1 / H, b.x2 / W, b.y2 / H],');
      L.push('    label: (refTags[i] || \'\').replace(/<\\/?ref>/g, \'\'),');
      L.push('    confidence: b.score || b.confidence || null');
      L.push('  };');
      L.push('});');
    } else if (mode.responseType === 'objects_bbox') {
      L.push('var dets = (r.objects || []).map(function(o) {');
      L.push('  var b = o.bbox || {};');
      L.push('  return {');
      L.push('    bbox: [(b.x||0)/W, (b.y||0)/H, ((b.x||0)+(b.width||0))/W, ((b.y||0)+(b.height||0))/H],');
      L.push('    label: o.label || \'\',');
      L.push('    confidence: o.confidence || null');
      L.push('  };');
      L.push('});');
    } else if (mode.responseType === 'detections_bbox') {
      L.push('var dets = (r.detections || []).map(function(d) {');
      L.push('  var b = d.bbox || {};');
      L.push('  return {');
      L.push('    bbox: [(b.x||0)/W, (b.y||0)/H, ((b.x||0)+(b.width||0))/W, ((b.y||0)+(b.height||0))/H],');
      L.push('    label: d.label || \'\',');
      L.push('    confidence: d.confidence || null');
      L.push('  };');
      L.push('});');
    } else if (mode.responseType === 'ocr_text_blocks') {
      L.push('var data = r.data || r;');
      L.push('var blocks = data.text_blocks || [];');
      L.push('var dets = blocks.map(function(b) {');
      L.push('  var b2 = b.bbox || {};');
      L.push('  return {');
      L.push('    bbox: [b2.x, b2.y, (b2.x||0) + (b2.width||0), (b2.y||0) + (b2.height||0)],');
      L.push('    label: b.text || \'\',');
      L.push('    confidence: b.confidence || null');
      L.push('  };');
      L.push('});');
      L.push('var texts = blocks.map(function(b) { return b.text; }).filter(Boolean);');
    }
    L.push('');

    // ROI filter
    if (roi) {
      L.push('// ROI: {x:' + roi.x + ', y:' + roi.y + ', w:' + roi.w + ', h:' + roi.h + '}');
      L.push('var roi = {x:' + roi.x + ', y:' + roi.y + ', w:' + roi.w + ', h:' + roi.h + '};');
      L.push('var inRoi = function(d) {');
      L.push('  var cx = (d.bbox[0] + d.bbox[2]) / 2;');
      L.push('  var cy = (d.bbox[1] + d.bbox[3]) / 2;');
      L.push('  return cx >= roi.x && cx <= roi.x + roi.w && cy >= roi.y && cy <= roi.y + roi.h;');
      L.push('};');
      if (roiAction === 'filter') {
        L.push('var filtered = dets.filter(inRoi);');
        L.push('var roiCount = filtered.length;');
      } else {
        L.push('var filtered = dets;');
        L.push('var roiCount = dets.filter(inRoi).length;');
      }
    } else {
      L.push('var filtered = dets;');
    }
    L.push('');

    // Class filter
    if (classFilter) {
      var classes = classFilter.split(',').map(function(c) { return c.trim(); }).filter(Boolean);
      if (classes.length > 0) {
        L.push('// Class filter');
        L.push('var allowed = ' + JSON.stringify(classes) + ';');
        L.push('var outputDets = filtered.filter(function(d) { return !d.label || allowed.indexOf(d.label) >= 0; });');
      } else {
        L.push('var outputDets = filtered;');
      }
    } else {
      L.push('var outputDets = filtered;');
    }
    L.push('');

    // Output metrics
    L.push('var out = {};');
    L.push('out[\'' + pfx + 'detections\'] = outputDets;');

    if (templateName === 'object_detection') {
      L.push('out[\'' + pfx + 'total_count\'] = outputDets.length;');
      L.push('out[\'' + pfx + 'count_by_class\'] = outputDets.reduce(function(a, d) { a[d.label] = (a[d.label]||0)+1; return a; }, {});');
    }

    if (roi) {
      L.push('out[\'' + pfx + 'roi_count\'] = roiCount;');
      if (roiAction === 'count_by_class') {
        L.push('out[\'' + pfx + 'roi_count_by_class\'] = dets.filter(inRoi).reduce(function(a, d) { a[d.label] = (a[d.label]||0)+1; return a; }, {});');
      }
    }

    if (mode.responseType === 'ocr_text_blocks') {
      L.push('out[\'' + pfx + 'texts\'] = texts || [];');
    }

    L.push('out[\'' + pfx + 'inference_time_ms\'] = r.inference_time_ms || r.processing_time_ms || null;');

    L.push('');
    L.push('return out;');

    return L.join('\n');
  }

  /**
   * Build transform payload for a single pipeline.
   * Returns { js_code, output_prefix } — standard TransformAutomation format.
   */
  function fillTemplate(pipe) {
    var jsCode = generateTransformJsCode(pipe);
    return {
      js_code: jsCode,
      output_prefix: 'virtual'
    };
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

    // -- Processing config (single extension) --
    var processingEnabled = config.processingEnabled === true;
    var processingExtId = config.processingExtensionId || '';
    var processingTemplate = config.processingTemplate || 'object_detection';
    var processingCategories = config.processingCategories || '';
    var processingPhrase = config.processingPhrase || '';
    var processingClassFilter = config.processingClassFilter || '';
    var processingRoiEnabled = config.processingRoiEnabled === true;
    var processingRoiAction = config.processingRoiAction || 'count';
    var processingRoiX = config.processingRoiX != null ? config.processingRoiX : 0.1;
    var processingRoiY = config.processingRoiY != null ? config.processingRoiY : 0.1;
    var processingRoiW = config.processingRoiW != null ? config.processingRoiW : 0.8;
    var processingRoiH = config.processingRoiH != null ? config.processingRoiH : 0.8;

    var extStatusState = React.useState('idle');
    var extStatus = extStatusState[0];
    var setExtStatus = extStatusState[1];

    // Track transform ID for cleanup
    var transformIdRef = React.useRef(null); // single transform ID

    // WS-triggered fetch: platform WS delivers small metrics (battery, ts) in real-time,
    // but large base64 images may exceed WS message size limits.
    // Strategy: when WS updates device.currentValues (detected by ts change),
    // trigger a single REST fetch to get the full data including the image.
    var imageState = React.useState(null);
    var imageData = imageState[0];
    var setImageData = imageState[1];

    var lastFetchTsRef = React.useRef(null);
    var fetchingRef = React.useRef(false);

    // Track latest device.currentValues (updated by WS via ComponentRenderer)
    var wsValues = device ? (device.currentValues || {}) : {};
    var wsTs = getFirst(wsValues, ['ts', 'values.ts', 'timestamp', 'values.timestamp']);

    React.useEffect(function () {
      if (!device || wsTs == null) return;
      // Only fetch when ts actually changed (new telemetry from WS)
      if (wsTs === lastFetchTsRef.current) return;
      if (fetchingRef.current) return;

      var neomind = window.neomind;
      if (!neomind || typeof neomind.fetchDeviceValues !== 'function') return;

      lastFetchTsRef.current = wsTs;
      fetchingRef.current = true;

      neomind.fetchDeviceValues(device.id).then(function (v) {
        if (v) setImageData(v);
      }).catch(function () {}).finally(function () {
        fetchingRef.current = false;
      });
    }, [device ? device.id : null, wsTs]);

    // Merge: WS values as base (real-time small metrics), REST image data overlay
    var _vals = Object.assign({}, wsValues, imageData || {});

    // Early-extract imageSrc — device may send URL or base64
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

    // Single-extension Transform lifecycle
    React.useEffect(function () {
      if (!processingEnabled || !processingExtId || !device) {
        // Clean up transform if processing is disabled
        var nm = window.neomind;
        if (transformIdRef.current && nm && nm.deleteTransform) {
          nm.deleteTransform(transformIdRef.current).catch(function () {});
          transformIdRef.current = null;
        }
        setExtStatus('idle');
        return;
      }

      var neomind = window.neomind;
      if (!neomind || typeof neomind.listExtensions !== 'function') {
        setExtStatus('unavailable');
        return;
      }

      setExtStatus('checking');
      var cancelled = false;

      neomind.listExtensions().then(function (exts) {
        if (cancelled) return;
        var extList = Array.isArray(exts) ? exts : [];

        // Find the selected extension
        var matched = null;
        for (var ei = 0; ei < extList.length; ei++) {
          if (extList[ei].id === processingExtId) { matched = extList[ei]; break; }
        }

        if (!matched) {
          setExtStatus('not_installed');
          return;
        }

        var stateLower = (matched.state || '').toLowerCase();
        if (stateLower.indexOf('stopped') >= 0 || stateLower.indexOf('failed') >= 0 || stateLower.indexOf('error') >= 0) {
          setExtStatus('offline');
          return;
        }

        setExtStatus('active');

        // Build transform config
        var mode = getExtMode(processingExtId, processingTemplate);
        if (!mode) return;

        // Validate required args (only if mode specifies them)
        var reqArgs = mode.args || [];
        var missing = false;
        for (var ai = 0; ai < reqArgs.length; ai++) {
          if (reqArgs[ai] === 'categories' && !(processingCategories || '').trim()) { missing = true; break; }
          if (reqArgs[ai] === 'phrase' && !(processingPhrase || '').trim()) { missing = true; break; }
        }
        if (missing) {
          console.warn('[ne101] Missing required args for transform', { extId: processingExtId, template: processingTemplate, reqArgs: reqArgs, categories: processingCategories, phrase: processingPhrase });
          return;
        }

        var pipe = {
          id: 'main',
          extId: processingExtId,
          template: processingTemplate,
          categories: processingCategories,
          phrase: processingPhrase,
          classFilter: processingClassFilter,
          roiEnabled: processingRoiEnabled,
          roiAction: processingRoiAction,
          roiX: processingRoiX,
          roiY: processingRoiY,
          roiW: processingRoiW,
          roiH: processingRoiH
        };

        var tplConfig = fillTemplate(pipe);
        var tName = 'ne101-' + device.id + '-main';
        var fp = JSON.stringify({ js_code: tplConfig.js_code });
        var payload = Object.assign({}, tplConfig, {
          name: tName,
          scope: device.id,
          description: 'fp:' + fp
        });

        // Sync transform: create or update
        if (!neomind.listTransforms || !neomind.createTransform) return null;

        return neomind.listTransforms({ scope: device.id }).then(function (transforms) {
          if (cancelled) return;
          var tList = Array.isArray(transforms) ? transforms : [];
          var existing = null;
          for (var ti = 0; ti < tList.length; ti++) {
            if (tList[ti].name === tName) { existing = tList[ti]; break; }
          }

          if (existing) {
            // Check fingerprint
            var oldDesc = existing.description || '';
            var oldFp = oldDesc.indexOf('fp:') === 0 ? oldDesc.substring(3) : '';
            if (oldFp === fp) {
              // Same config — reuse
              transformIdRef.current = existing.id;
              return;
            }
            // Config changed — update
            if (neomind.updateTransform) {
              return neomind.updateTransform(existing.id, {
                name: payload.name,
                description: payload.description,
                scope: payload.scope,
                js_code: payload.js_code,
                output_prefix: payload.output_prefix
              }).catch(function () {
                // Transform may have been deleted — recreate
                if (cancelled) return null;
                return neomind.createTransform(payload);
              }).then(function (result) {
                if (result && result.id) transformIdRef.current = result.id;
              });
            }
          } else {
            // Create new
            return neomind.createTransform(payload).then(function (result) {
              if (result && result.id) transformIdRef.current = result.id;
            });
          }
        });
      }).catch(function () {
        if (!cancelled) setExtStatus('error');
      });

      return function () {
        cancelled = true;
        // Cleanup transform when unmounting or deps change
        var nm = window.neomind;
        if (transformIdRef.current && nm && nm.deleteTransform) {
          nm.deleteTransform(transformIdRef.current).catch(function () {});
          transformIdRef.current = null;
        }
      };
    }, [device ? device.id : null, processingEnabled, processingExtId, processingTemplate, processingCategories, processingPhrase, processingClassFilter, processingRoiEnabled, processingRoiX, processingRoiY, processingRoiW, processingRoiH]);

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

    // Virtual metrics (from processing pipeline)
    var detections = [];
    if (processingEnabled && processingExtId) {
      // Read detections from virtual metrics (backend transform results)
      var pfx = 'virtual.' + processingExtId.replace(/-/g, '_') + '.';
      var vDet = getFirst(vals, [pfx + 'detections', 'values.' + pfx + 'detections']);
      if (Array.isArray(vDet)) detections = vDet;
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
        active: { color: 'rgba(34,197,94,0.9)', label: 'Pipeline Active' },
        not_installed: { color: 'rgba(239,68,68,0.9)', label: 'Ext. Not Installed' },
        offline: { color: 'rgba(234,179,8,0.9)', label: 'Ext. Offline' },
        error: { color: 'rgba(239,68,68,0.9)', label: 'Pipeline Error' },
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
              className: '',
              style: {
                width: '6px', height: '6px', borderRadius: '50%',
                border: 'none',
                background: sc.color
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

    // Detection summary — read from single extension
    var hasAnySummary = processingEnabled && processingExtId && (
      detections.length > 0 ||
      (function () {
        var pfx = 'virtual.' + processingExtId.replace(/-/g, '_') + '.';
        return getFirst(vals, [pfx + 'total_count', 'values.' + pfx + 'total_count']) != null;
      })()
    );
    if (hasAnySummary) {
      // Read virtual metrics from single extension
      var pfx = 'virtual.' + processingExtId.replace(/-/g, '_') + '.';
      var vTotalCount = getFirst(vals, [pfx + 'total_count', 'values.' + pfx + 'total_count']);
      var vRoiCount = getFirst(vals, [pfx + 'roi_count', 'values.' + pfx + 'roi_count']);
      var vCountByClass = getFirst(vals, [pfx + 'count_by_class', 'values.' + pfx + 'count_by_class']);
      var vTexts = getFirst(vals, [pfx + 'texts', 'values.' + pfx + 'texts']);
      var maxInfTime = getFirst(vals, [pfx + 'inference_time_ms', 'values.' + pfx + 'inference_time_ms']);

      // Calculate ROI from config (for overlay display)
      var roi = processingRoiEnabled ? {
        x: Number(processingRoiX) || 0,
        y: Number(processingRoiY) || 0,
        w: Number(processingRoiW) || 0.8,
        h: Number(processingRoiH) || 0.8
      } : null;

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

      if (maxInfTime != null) {
        detSummaryChildren.push(
          jsx('span', { key: 'inf', style: Object.assign({}, white50, textShadow, { fontSize: '8px', fontFamily: 'monospace' }), children: Math.round(maxInfTime) + 'ms' })
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
                // Detection boxes overlay — color-coded per pipeline
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
                        // Single extension: use first color
                        var clr = { border: 'rgba(59,130,246,0.8)', bg: 'rgba(59,130,246,0.85)', shadow: 'rgba(59,130,246,0.3)' };
                        return jsxs('div', {
                          key: 'dbox-' + i,
                          className: 'absolute',
                          style: {
                            left: (bx1 * 100) + '%', top: (by1 * 100) + '%',
                            width: ((bx2 - bx1) * 100) + '%', height: ((by2 - by1) * 100) + '%',
                            border: '1.5px solid ' + clr.border, borderRadius: '2px',
                            boxShadow: '0 0 4px ' + clr.shadow
                          },
                          children: (detLabel || detConf)
                            ? jsxs('span', {
                                style: {
                                  position: 'absolute', top: '-14px', left: '-1px',
                                  background: clr.bg, color: '#fff',
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

    function update(key, value) {
      if (onChange) onChange(key, value);
    }

    // Derived values
    var enabled = config.processingEnabled === true;
    var extId = config.processingExtensionId || '';
    var template = config.processingTemplate || 'object_detection';

    // Extension list (auto-fetched, filtered to AI extensions)
    var extState = React.useState({ list: [], loading: false, error: null });
    var extLoading = extState[0].loading;

    React.useEffect(function () {
      if (!enabled) return;
      var neomind = window.neomind;
      if (!neomind || typeof neomind.listExtensions !== 'function') return;
      var cancelled = false;
      extState[1]({ list: [], loading: true, error: null });
      neomind.listExtensions().then(function (exts) {
        if (cancelled) return;
        var arr = Array.isArray(exts) ? exts : [];
        var filtered = [];
        for (var i = 0; i < arr.length; i++) {
          if (AI_EXT_IDS.indexOf(arr[i].id) >= 0) filtered.push(arr[i]);
        }
        extState[1]({ list: filtered, loading: false, error: null });
      }).catch(function () {
        if (!cancelled) {
          extState[1]({ list: [], loading: false, error: 'Failed to load extensions' });
        }
      });
      return function () { cancelled = true; };
    }, [enabled]);

    var extensions = extState[0].list;

    // Get available modes for selected extension
    var availableModes = extId ? getExtModes(extId) : [];
    var validTemplate = template;
    if (availableModes.length > 0) {
      var found = false;
      for (var mi = 0; mi < availableModes.length; mi++) {
        if (availableModes[mi].id === validTemplate) { found = true; break; }
      }
      if (!found) validTemplate = availableModes[0].id;
    }

    var currentMode = null;
    for (var cmi = 0; cmi < availableModes.length; cmi++) {
      if (availableModes[cmi].id === validTemplate) { currentMode = availableModes[cmi]; break; }
    }
    var modeArgs = currentMode ? (currentMode.args || []) : [];

    var items = [];

    // Toggle
    items.push(
      jsxs('div', { key: 'toggle', className: 'flex items-center justify-between', children: [
        jsx('label', { className: LABEL_CLS + ' cursor-pointer', children: 'Enable AI Processing' }),
        SwitchControl(enabled, function () { update('processingEnabled', !enabled); })
      ]})
    );

    if (enabled) {
      // AI Extension selector
      items.push(
        jsxs('div', { key: 'ext', className: FIELD_CLS, children: [
          jsx('label', { className: LABEL_CLS, children: 'AI Extension' }),
          jsx(ExtDropdown, {
            extensions: extensions,
            value: extId,
            onChange: function (id) {
              update('processingExtensionId', id);
              // Auto-switch template when extension changes
              if (id) {
                var modes = getExtModes(id);
                if (modes.length > 0) {
                  update('processingTemplate', modes[0].id);
                }
              }
            },
            loading: extLoading
          })
        ]})
      );

      // Mode cards
      if (availableModes.length > 0) {
        var tplCards = availableModes.map(function (m) {
          var selected = validTemplate === m.id;
          return jsx('button', {
            key: m.id,
            type: 'button',
            onClick: function () { update('processingTemplate', m.id); },
            className: 'flex items-center gap-2 p-2 rounded-md border text-left transition-colors text-xs ' +
              (selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-muted-foreground/30'),
            children: jsxs('div', { className: 'flex items-center gap-1.5', children: [
              jsx('div', { className: 'flex-shrink-0', children: ModeIcon(m.icon) }),
              jsx('span', { className: 'font-medium ' + (selected ? 'text-primary' : ''), children: m.label })
            ]})
          });
        });
        items.push(
          jsxs('div', { key: 'tpl', className: FIELD_CLS, children: [
            jsx('label', { className: LABEL_CLS, children: 'Working Mode' }),
            jsx('div', { className: 'grid grid-cols-2 gap-1.5', children: tplCards })
          ]})
        );
      }

      // Mode-specific fields
      if (modeArgs.indexOf('categories') >= 0) {
        items.push(
          jsxs('div', { key: 'cat', className: FIELD_CLS, children: [
            jsx('label', { className: LABEL_CLS, children: jsxs('span', { children: ['Categories', jsx('span', { style: { color: '#ef4444', marginLeft: 4 }, children: '*' })] }) }),
            jsx('input', { className: INPUT_CLS, value: config.processingCategories || '', placeholder: 'person, car, dog', onChange: function (e) { update('processingCategories', e.target.value); } })
          ]})
        );
      }
      if (modeArgs.indexOf('phrase') >= 0) {
        items.push(
          jsxs('div', { key: 'phrase', className: FIELD_CLS, children: [
            jsx('label', { className: LABEL_CLS, children: jsxs('span', { children: ['Search Phrase', jsx('span', { style: { color: '#ef4444', marginLeft: 4 }, children: '*' })] }) }),
            jsx('input', { className: INPUT_CLS, value: config.processingPhrase || '', placeholder: 'Describe what to find', onChange: function (e) { update('processingPhrase', e.target.value); } })
          ]})
        );
      }

      // Class filter
      items.push(
        jsxs('div', { key: 'cf', className: FIELD_CLS, children: [
          jsx('label', { className: LABEL_CLS, children: 'Class Filter' }),
          jsx('input', { className: INPUT_CLS, value: config.processingClassFilter || '', placeholder: 'Empty = all classes', onChange: function (e) { update('processingClassFilter', e.target.value); } })
        ]})
      );

      // ROI toggle
      var roiEnabled = config.processingRoiEnabled === true;
      items.push(
        jsxs('div', { key: 'roi-div', className: 'flex items-center justify-between pt-2 border-t mt-1', children: [
          jsx('label', { className: 'text-xs font-medium cursor-pointer', children: 'ROI' }),
          SwitchControl(roiEnabled, function () { update('processingRoiEnabled', !roiEnabled); })
        ]})
      );

      if (roiEnabled) {
        // ROI action chips
        var roiAction = config.processingRoiAction || 'count';
        var actionChips = ROI_ACTIONS.map(function (a) {
          var selected = roiAction === a.id;
          return jsx('button', {
            key: a.id,
            type: 'button',
            onClick: function () { update('processingRoiAction', a.id); },
            className: 'px-2 py-1 rounded-md border text-xs font-medium transition-colors ' +
              (selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/30'),
            children: a.label
          });
        });
        items.push(
          jsxs('div', { key: 'roi-act', className: FIELD_CLS, children: [
            jsx('label', { className: 'text-xs font-medium', children: 'ROI Action' }),
            jsx('div', { className: 'flex gap-1.5', children: actionChips })
          ]})
        );

        // ROI sliders
        var roiX = config.processingRoiX != null ? config.processingRoiX : 0.1;
        var roiY = config.processingRoiY != null ? config.processingRoiY : 0.1;
        var roiW = config.processingRoiW != null ? config.processingRoiW : 0.8;
        var roiH = config.processingRoiH != null ? config.processingRoiH : 0.8;
        items.push(
          jsxs('div', { key: 'roi-sliders', className: 'grid grid-cols-2 gap-x-3 gap-y-1', children: [
            jsxs('div', { key: 'x', className: FIELD_CLS, children: [
              jsxs('div', { className: 'flex justify-between', children: [ jsx('span', { className: DESC_CLS, children: 'X' }), jsx('span', { className: DESC_CLS + ' font-mono', children: roiX.toFixed(2) }) ]}),
              jsx('input', { type: 'range', min: 0, max: 1, step: 0.01, value: roiX, onChange: function (e) { update('processingRoiX', Number(e.target.value)); }, className: 'w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer' })
            ]}),
            jsxs('div', { key: 'y', className: FIELD_CLS, children: [
              jsxs('div', { className: 'flex justify-between', children: [ jsx('span', { className: DESC_CLS, children: 'Y' }), jsx('span', { className: DESC_CLS + ' font-mono', children: roiY.toFixed(2) }) ]}),
              jsx('input', { type: 'range', min: 0, max: 1, step: 0.01, value: roiY, onChange: function (e) { update('processingRoiY', Number(e.target.value)); }, className: 'w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer' })
            ]}),
            jsxs('div', { key: 'w', className: FIELD_CLS, children: [
              jsxs('div', { className: 'flex justify-between', children: [ jsx('span', { className: DESC_CLS, children: 'W' }), jsx('span', { className: DESC_CLS + ' font-mono', children: roiW.toFixed(2) }) ]}),
              jsx('input', { type: 'range', min: 0.05, max: 1, step: 0.01, value: roiW, onChange: function (e) { update('processingRoiW', Number(e.target.value)); }, className: 'w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer' })
            ]}),
            jsxs('div', { key: 'h', className: FIELD_CLS, children: [
              jsxs('div', { className: 'flex justify-between', children: [ jsx('span', { className: DESC_CLS, children: 'H' }), jsx('span', { className: DESC_CLS + ' font-mono', children: roiH.toFixed(2) }) ]}),
              jsx('input', { type: 'range', min: 0.05, max: 1, step: 0.01, value: roiH, onChange: function (e) { update('processingRoiH', Number(e.target.value)); }, className: 'w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer' })
            ]})
          ]})
        );
      }

      if (extensions.length === 0 && !extLoading) {
        items.push(
          jsx('p', { key: 'no-ext', className: DESC_CLS, children: 'No AI extensions installed. Install one from the Extensions page.' })
        );
      }
    }

    return jsx('div', { className: 'space-y-3', children: items });
  }
  return { default: NE101CameraPanel, NE101CameraPanel: NE101CameraPanel, ConfigPanel: ConfigPanel, AdvancedPanel: AdvancedPanel };
})();
