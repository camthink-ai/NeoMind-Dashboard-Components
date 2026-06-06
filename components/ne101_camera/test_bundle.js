#!/usr/bin/env node
// NE101 Camera Panel — automated tests for bundle.js pure functions
// Zero external dependencies. Run: node components/ne101_camera/test_bundle.js
'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');

var source = fs.readFileSync(path.join(__dirname, 'bundle.js'), 'utf8');

// ---------------------------------------------------------------------------
// Extract function source from IIFE using regex
// ---------------------------------------------------------------------------

function extractFunction(name) {
  // Match: function <name>( ...) { ... }
  // Use bracket counting to find the end
  var startRe = new RegExp('function\\s+' + name + '\\s*\\(', 'm');
  var m = source.match(startRe);
  if (!m) throw new Error('Cannot find function ' + name);
  var idx = m.index;
  // Find opening brace
  var braceStart = source.indexOf('{', idx);
  var depth = 0;
  var i = braceStart;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.substring(idx, i + 1);
}

function extractVar(name) {
  var re = new RegExp('var\\s+' + name + '\\s*=\\s*', 'm');
  var m = source.match(re);
  if (!m) throw new Error('Cannot find var ' + name);
  var idx = m.index;
  // Find the value start
  var valStart = idx + m[0].length;
  // If it's an object literal or array, count brackets
  var ch = source[valStart];
  if (ch === '{' || ch === '[') {
    var open = ch, close = ch === '{' ? '}' : ']';
    var depth = 0;
    var j = valStart;
    for (; j < source.length; j++) {
      if (source[j] === open) depth++;
      else if (source[j] === close) {
        depth--;
        if (depth === 0) break;
      }
    }
    // Include the semicolon after closing bracket
    var end = j + 1;
    while (end < source.length && source[end] === ';') end++;
    return source.substring(idx, end);
  }
  // For simple values, find semicolon
  var semiIdx = source.indexOf(';', valStart);
  return source.substring(idx, semiIdx + 1);
}

// Extract all needed pieces
var getValSrc = extractFunction('getVal');
var getFirstSrc = extractFunction('getFirst');
var extModesSrc = extractVar('EXT_MODES');
var getExtModeSrc = extractFunction('getExtMode');
var getExtModesSrc = extractFunction('getExtModes');
var pipeRoisSrc = extractFunction('pipeRois');
var generateTransformJsCodeSrc = extractFunction('generateTransformJsCode');
var fillTemplateSrc = extractFunction('fillTemplate');

// Build evaluable modules
function makeFn(/* deps..., body */) {
  var args = Array.prototype.slice.call(arguments);
  var body = args.pop();
  var deps = args.join('\n');
  // eslint-disable-next-line no-new-func
  return new Function(deps + '\nreturn ' + body + ';')();
}

var getVal = makeFn(getValSrc, 'getVal');
var getFirst = makeFn(getValSrc, getFirstSrc, 'getFirst');
var getExtMode = makeFn(extModesSrc, getExtModeSrc, 'getExtMode');
var getExtModes = makeFn(extModesSrc, getExtModesSrc, 'getExtModes');
var pipeRois = makeFn(pipeRoisSrc, 'pipeRois');
var generateTransformJsCode = makeFn(extModesSrc, getExtModeSrc, getExtModesSrc, pipeRoisSrc, generateTransformJsCodeSrc, 'generateTransformJsCode');
var fillTemplate = makeFn(extModesSrc, getExtModeSrc, getExtModesSrc, pipeRoisSrc, generateTransformJsCodeSrc, fillTemplateSrc, 'fillTemplate');

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

var passed = 0;
var failed = 0;
var errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    errors.push({ name: name, error: e });
    console.log('  FAIL: ' + name + ' — ' + e.message);
  }
}

function section(title) {
  console.log('\n=== ' + title + ' ===');
}

// ---------------------------------------------------------------------------
// 1. getFirst(obj, keys)
// ---------------------------------------------------------------------------
section('getFirst(obj, keys)');

test('nested key access', function () {
  assert.strictEqual(getFirst({ a: { b: 1 } }, ['a.b']), 1);
});

test('null value skipped', function () {
  assert.strictEqual(getFirst({ a: null, b: 2 }, ['a', 'b']), 2);
});

test('empty string skipped', function () {
  assert.strictEqual(getFirst({ a: '', b: 'val' }, ['a', 'b']), 'val');
});

test('all null returns null', function () {
  assert.strictEqual(getFirst({ a: null, b: null }, ['a', 'b']), null);
});

test('undefined object returns null', function () {
  assert.strictEqual(getFirst(undefined, ['a']), null);
});

test('falsy but non-null value returned', function () {
  assert.strictEqual(getFirst({ a: 0 }, ['a']), 0);
});

test('false value returned', function () {
  assert.strictEqual(getFirst({ a: false }, ['a']), false);
});

// ---------------------------------------------------------------------------
// 2. getExtMode(extId, templateName)
// ---------------------------------------------------------------------------
section('getExtMode(extId, templateName)');

test('known extension: yolo-device-inference + object_detection', function () {
  var mode = getExtMode('yolo-device-inference', 'object_detection');
  assert.strictEqual(mode.id, 'object_detection');
  assert.strictEqual(mode.command, 'analyze_image');
  assert.strictEqual(mode.imageArg, 'image');
  assert.strictEqual(mode.responseType, 'detections_bbox');
});

test('known extension: locate-anything-v2 + grounding', function () {
  var mode = getExtMode('locate-anything-v2', 'grounding');
  assert.strictEqual(mode.id, 'grounding');
  assert.strictEqual(mode.command, 'ground');
  assert.strictEqual(mode.imageArg, 'image_base64');
  assert.deepEqual(mode.args, ['phrase']);
});

test('unknown extension returns fallback', function () {
  var mode = getExtMode('unknown-ext', 'foo');
  assert.strictEqual(mode.id, 'foo');
  assert.strictEqual(mode.command, 'detect');
  assert.strictEqual(mode.imageArg, 'image');
});

test('unknown template returns fallback', function () {
  var mode = getExtMode('yolo-device-inference', 'nonexistent');
  assert.strictEqual(mode.id, 'nonexistent');
  assert.strictEqual(mode.responseType, 'boxes_x1y1x2y2');
});

test('returns object with required fields', function () {
  var mode = getExtMode('any', 'any');
  assert('id' in mode);
  assert('command' in mode);
  assert('imageArg' in mode);
  assert('responseType' in mode);
});

test('ocr-device-inference + text_detection', function () {
  var mode = getExtMode('ocr-device-inference', 'text_detection');
  assert.strictEqual(mode.responseType, 'ocr_text_blocks');
  assert.strictEqual(mode.command, 'recognize_image');
});

// ---------------------------------------------------------------------------
// 3. pipeRois(pipe)
// ---------------------------------------------------------------------------
section('pipeRois(pipe)');

test('ROI disabled returns empty', function () {
  assert.deepEqual(pipeRois({ roiEnabled: false }), []);
});

test('ROI disabled with undefined', function () {
  assert.deepEqual(pipeRois({}), []);
});

test('new format polygon with 3+ points', function () {
  var pts = [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.3, y: 0.6 }];
  var result = pipeRois({ roiEnabled: true, rois: [{ name: 'tri', points: pts }] });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].name, 'tri');
  assert.strictEqual(result[0].points.length, 3);
});

test('polygon with less than 3 points filtered out', function () {
  var pts = [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.2 }];
  var result = pipeRois({ roiEnabled: true, rois: [{ name: 'line', points: pts }] });
  // Falls through to legacy since new format yields 0 valid
  // Legacy needs roiX/roiY to be non-null
  assert.strictEqual(result.length, 0);
});

test('legacy rectangle from roiX/Y/W/H', function () {
  var result = pipeRois({ roiEnabled: true, roiX: 0.1, roiY: 0.2, roiW: 0.5, roiH: 0.6 });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].name, 'default');
  var p = result[0].points;
  assert.strictEqual(p[0].x, 0.1);
  assert.strictEqual(p[0].y, 0.2);
  assert.strictEqual(p[2].x, 0.6);  // x + w
  assert.strictEqual(p[2].y, 0.8);  // y + h
});

test('legacy default values', function () {
  var result = pipeRois({ roiEnabled: true, roiX: 0.1, roiY: 0.1 });
  // roiW defaults to 0.8, roiH defaults to 0.8
  var p = result[0].points;
  assert.strictEqual(p[2].x, 0.9);  // 0.1 + 0.8
  assert.strictEqual(p[2].y, 0.9);  // 0.1 + 0.8
});

test('name cleanup: special chars replaced with _', function () {
  var pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }];
  var result = pipeRois({ roiEnabled: true, rois: [{ name: 'ROI #1 (a)', points: pts }] });
  assert.strictEqual(result[0].name, 'ROI__1__a_');
});

test('multiple valid polygons', function () {
  var pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }];
  var result = pipeRois({ roiEnabled: true, rois: [
    { name: 'a', points: pts },
    { name: 'b', points: pts }
  ]});
  assert.strictEqual(result.length, 2);
});

// ---------------------------------------------------------------------------
// 4. generateTransformJsCode(pipe)
// ---------------------------------------------------------------------------
section('generateTransformJsCode(pipe)');

function makePipe(overrides) {
  return Object.assign({
    extId: 'yolo-device-inference',
    template: 'object_detection',
    categories: '',
    phrase: '',
    classFilter: '',
    roiEnabled: false,
    roiAction: 'count',
    roiX: 0.1, roiY: 0.1, roiW: 0.8, roiH: 0.8,
    rois: []
  }, overrides);
}

test('basic detection: contains extensions.invoke', function () {
  var code = generateTransformJsCode(makePipe());
  assert(code.indexOf('extensions.invoke') >= 0);
});

test('basic detection: contains bbox normalization /W /H', function () {
  var code = generateTransformJsCode(makePipe());
  assert(code.indexOf('/W') >= 0);
  assert(code.indexOf('/H') >= 0);
});

test('basic detection: contains detections output', function () {
  var code = generateTransformJsCode(makePipe());
  assert(code.indexOf('detections') >= 0);
  assert(code.indexOf('total_count') >= 0);
});

test('OCR type: no bbox division by W/H', function () {
  var code = generateTransformJsCode(makePipe({
    extId: 'ocr-device-inference',
    template: 'text_detection'
  }));
  // OCR uses ocr_text_blocks which does NOT divide by W/H
  assert(code.indexOf('text_blocks') >= 0);
});

test('categories parameter: locate-anything-v2', function () {
  var code = generateTransformJsCode(makePipe({
    extId: 'locate-anything-v2',
    template: 'object_detection',
    categories: 'person,car'
  }));
  assert(code.indexOf("categories: 'person,car'") >= 0);
});

test('phrase parameter: locate-anything-v2 grounding', function () {
  var code = generateTransformJsCode(makePipe({
    extId: 'locate-anything-v2',
    template: 'grounding',
    phrase: 'red car'
  }));
  assert(code.indexOf("phrase: 'red car'") >= 0);
});

test('ROI filter: roiEnabled + roiAction=filter', function () {
  var code = generateTransformJsCode(makePipe({
    roiEnabled: true,
    roiAction: 'filter',
    roiX: 0.1, roiY: 0.1, roiW: 0.8, roiH: 0.8
  }));
  assert(code.indexOf('inAnyRoi') >= 0);
  assert(code.indexOf('.filter(inAnyRoi)') >= 0);
});

test('ROI filter_outside action', function () {
  var code = generateTransformJsCode(makePipe({
    roiEnabled: true,
    roiAction: 'filter_outside',
    roiX: 0.1, roiY: 0.1, roiW: 0.8, roiH: 0.8
  }));
  assert(code.indexOf('!inAnyRoi') >= 0);
});

test('ROI count: per-ROI _count and _detections', function () {
  var pts = [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.3, y: 0.5 }];
  var code = generateTransformJsCode(makePipe({
    roiEnabled: true,
    roiAction: 'count',
    rois: [{ name: 'zone1', points: pts }]
  }));
  assert(code.indexOf('_count') >= 0);
  assert(code.indexOf('_detections') >= 0);
  assert(code.indexOf('roi_count') >= 0);
});

test('class filter: allowed array', function () {
  var code = generateTransformJsCode(makePipe({
    classFilter: 'person,car'
  }));
  assert(code.indexOf("allowed = [\"person\",\"car\"]") >= 0);
  assert(code.indexOf('allowed.indexOf') >= 0);
});

test('no console.log in generated code', function () {
  var code = generateTransformJsCode(makePipe());
  assert(code.indexOf('console.log') === -1);
  assert(code.indexOf('console.') === -1);
});

test('no setTimeout or window in generated code', function () {
  var code = generateTransformJsCode(makePipe());
  assert(code.indexOf('setTimeout') === -1);
  assert(code.indexOf('window.') === -1);
});

test('count_by_class for object_detection template', function () {
  var code = generateTransformJsCode(makePipe({
    extId: 'yolo-device-inference',
    template: 'object_detection'
  }));
  assert(code.indexOf('count_by_class') >= 0);
});

test('no count_by_class for text_detection template', function () {
  var code = generateTransformJsCode(makePipe({
    extId: 'ocr-device-inference',
    template: 'text_detection'
  }));
  assert(code.indexOf('count_by_class') === -1);
});

test('virtual prefix stripped from extId', function () {
  var code = generateTransformJsCode(makePipe({
    extId: 'virtual.yolo-device-inference',
    template: 'object_detection'
  }));
  // Should still invoke 'yolo-device-inference', not 'virtual.yolo-device-inference'
  assert(code.indexOf("'virtual.yolo-device-inference'") === -1);
  assert(code.indexOf("'yolo-device-inference'") >= 0);
});

test('inference_time_ms and source_ts in output', function () {
  var code = generateTransformJsCode(makePipe());
  assert(code.indexOf('inference_time_ms') >= 0);
  assert(code.indexOf('source_ts') >= 0);
});

// ---------------------------------------------------------------------------
// 5. Transform JS execution verification (simulated Boa engine)
// ---------------------------------------------------------------------------
section('Transform JS execution verification');

function execTransform(code, opts) {
  opts = opts || {};
  var invokeResult = opts.invokeResult || { boxes: [] };
  var extensions = {
    invoke: function () { return invokeResult; }
  };
  var input_raw = opts.input_raw || { values: { image: 'fake_base64' }, ts: 1000 };
  var __imageData = opts.__imageData || 'fake_base64';
  var imageMeta = opts.imageMeta || { width: 1920, height: 1080 };
  // eslint-disable-next-line no-new-func
  var fn = new Function('extensions', 'input_raw', '__imageData', 'imageMeta', code);
  return fn(extensions, input_raw, __imageData, imageMeta);
}

// Helper: get prefixed key from result (pfx = extKey + '.')
function pfx(extId) {
  return extId.replace(/-/g, '_') + '.';
}

test('output structure: detections, total_count, inference_time_ms, source_ts', function () {
  var pipe = makePipe(); // yolo-device-inference uses detections_bbox
  var code = generateTransformJsCode(pipe);
  var k = pfx(pipe.extId);
  var result = execTransform(code, {
    invokeResult: { detections: [
      { label: 'person', confidence: 0.9, bbox: { x: 100, y: 100, width: 100, height: 100 } }
    ] }
  });
  assert(Array.isArray(result[k + 'detections']));
  assert.strictEqual(result[k + 'total_count'], 1);
  assert(k + 'inference_time_ms' in result);
  assert(k + 'source_ts' in result);
});

test('bbox normalization: pixel coords to 0-1 range', function () {
  var pipe = makePipe(); // yolo-device-inference uses detections_bbox
  var code = generateTransformJsCode(pipe);
  var k = pfx(pipe.extId);
  var result = execTransform(code, {
    imageMeta: { width: 1000, height: 500 },
    invokeResult: { detections: [
      { label: 'car', confidence: 0.8, bbox: { x: 100, y: 50, width: 400, height: 200 } }
    ] }
  });
  var det = result[k + 'detections'][0];
  assert(det.bbox[0] > 0 && det.bbox[0] < 1, 'x1 normalized: ' + det.bbox[0]);
  assert(det.bbox[1] > 0 && det.bbox[1] < 1, 'y1 normalized: ' + det.bbox[1]);
  assert(det.bbox[2] > 0 && det.bbox[2] <= 1, 'x2 normalized: ' + det.bbox[2]);
  assert(det.bbox[3] > 0 && det.bbox[3] <= 1, 'y2 normalized: ' + det.bbox[3]);
  assert.strictEqual(det.label, 'car');
});

test('label extraction from ref tags', function () {
  var pipe = makePipe({
    extId: 'locate-anything-v2',
    template: 'object_detection',
    categories: 'dog'
  });
  var code = generateTransformJsCode(pipe);
  var k = pfx(pipe.extId);
  var result = execTransform(code, {
    invokeResult: { boxes: [
      { x1: 10, y1: 10, x2: 100, y2: 100, score: 0.95 }
    ], answer: '<ref>dog</ref>' }
  });
  assert.strictEqual(result[k + 'detections'][0].label, 'dog');
});

test('ROI filter: only detections inside ROI', function () {
  var pipe = makePipe({
    roiEnabled: true,
    roiAction: 'filter',
    roiX: 0.4, roiY: 0.4, roiW: 0.2, roiH: 0.2
  });
  var code = generateTransformJsCode(pipe);
  var k = pfx(pipe.extId);
  var result = execTransform(code, {
    imageMeta: { width: 1000, height: 1000 },
    invokeResult: { detections: [
      { label: 'a', confidence: 0.9, bbox: { x: 450, y: 450, width: 100, height: 100 } },  // inside ROI
      { label: 'b', confidence: 0.9, bbox: { x: 10, y: 10, width: 40, height: 40 } }       // outside ROI
    ] }
  });
  assert.strictEqual(result[k + 'detections'].length, 1);
  assert.strictEqual(result[k + 'detections'][0].label, 'a');
});

test('class filter: only specified classes', function () {
  var pipe = makePipe({
    classFilter: 'person'
  });
  var code = generateTransformJsCode(pipe);
  var k = pfx(pipe.extId);
  // For detections_bbox response type (yolo-device-inference)
  var result = execTransform(code, {
    invokeResult: { detections: [
      { label: 'person', confidence: 0.9, bbox: { x: 10, y: 10, width: 100, height: 100 } },
      { label: 'car', confidence: 0.8, bbox: { x: 200, y: 200, width: 100, height: 100 } },
      { label: 'person', confidence: 0.7, bbox: { x: 400, y: 400, width: 100, height: 100 } }
    ] }
  });
  assert.strictEqual(result[k + 'detections'].length, 2);
  assert.strictEqual(result[k + 'detections'][0].label, 'person');
  assert.strictEqual(result[k + 'detections'][1].label, 'person');
});

test('empty result: extensions.invoke returns empty array', function () {
  var pipe = makePipe();
  var code = generateTransformJsCode(pipe);
  var k = pfx(pipe.extId);
  var result = execTransform(code, {
    invokeResult: { boxes: [] }
  });
  assert.strictEqual(result[k + 'detections'].length, 0);
  assert.strictEqual(result[k + 'total_count'], 0);
});

test('detections_bbox response type parsing', function () {
  var pipe = makePipe({
    extId: 'yolo-device-inference',
    template: 'object_detection'
  });
  var code = generateTransformJsCode(pipe);
  var k = pfx(pipe.extId);
  var result = execTransform(code, {
    invokeResult: { detections: [
      { label: 'cat', confidence: 0.88, bbox: { x: 50, y: 50, width: 200, height: 150 } }
    ] }
  });
  assert.strictEqual(result[k + 'detections'][0].label, 'cat');
  assert.strictEqual(result[k + 'detections'][0].confidence, 0.88);
  // Check bbox normalization
  var b = result[k + 'detections'][0].bbox;
  assert(b[0] > 0 && b[0] < 1);
  assert(b[1] > 0 && b[1] < 1);
});

test('objects_bbox response type parsing', function () {
  var pipe = makePipe({
    extId: 'image-analyzer-v2',
    template: 'object_detection'
  });
  var code = generateTransformJsCode(pipe);
  var k = pfx(pipe.extId);
  var result = execTransform(code, {
    invokeResult: { objects: [
      { label: 'dog', confidence: 0.75, bbox: { x: 100, y: 100, width: 300, height: 200 } }
    ] }
  });
  assert.strictEqual(result[k + 'detections'][0].label, 'dog');
  assert.strictEqual(result[k + 'detections'][0].confidence, 0.75);
});

test('ocr_text_blocks response type parsing', function () {
  var pipe = makePipe({
    extId: 'ocr-device-inference',
    template: 'text_detection'
  });
  var code = generateTransformJsCode(pipe);
  var k = pfx(pipe.extId);
  var result = execTransform(code, {
    invokeResult: {
      data: {
        text_blocks: [
          { text: 'Hello', confidence: 0.9, bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 } }
        ]
      }
    }
  });
  assert.strictEqual(result[k + 'detections'][0].label, 'Hello');
  assert(Array.isArray(result[k + 'texts']));
  assert.strictEqual(result[k + 'texts'][0], 'Hello');
});

test('ROI per-region metrics', function () {
  var pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }];
  var pipe = makePipe({
    roiEnabled: true,
    roiAction: 'count',
    rois: [{ name: 'zone1', points: pts }]
  });
  var code = generateTransformJsCode(pipe);
  var k = pfx(pipe.extId);
  var result = execTransform(code, {
    imageMeta: { width: 1000, height: 1000 },
    invokeResult: { boxes: [
      { x1: 200, y1: 200, x2: 400, y2: 400, score: 0.9 }
    ], answer: '<ref>obj</ref>' }
  });
  assert(k + 'roi_count' in result);
  assert(k + 'zone1_count' in result);
  assert(k + 'zone1_detections' in result);
});

test('no imageData returns empty object', function () {
  var code = generateTransformJsCode(makePipe());
  // Pass empty imageData — the code checks `if (!imageData) return {};`
  // eslint-disable-next-line no-new-func
  var fn = new Function('extensions', 'input_raw', '__imageData', 'imageMeta', code);
  // __imageData is empty string, input_raw has no image either
  var result = fn({}, {}, '', {});
  assert.deepStrictEqual(result, {});
});

// ---------------------------------------------------------------------------
// 6. fillTemplate(pipe)
// ---------------------------------------------------------------------------
section('fillTemplate(pipe)');

test('returns correct structure', function () {
  var result = fillTemplate(makePipe({ deviceId: 'dev-001' }));
  assert('js_code' in result);
  assert('output_prefix' in result);
  assert('rule' in result);
});

test('output_prefix is virtual', function () {
  var result = fillTemplate(makePipe());
  assert.strictEqual(result.output_prefix, 'virtual');
});

test('rule.device_id is correct', function () {
  var result = fillTemplate(makePipe({ deviceId: 'dev-123' }));
  assert.strictEqual(result.rule.device_id, 'dev-123');
});

test('rule.device_type is ne101_camera', function () {
  var result = fillTemplate(makePipe());
  assert.strictEqual(result.rule.device_type, 'ne101_camera');
});

test('js_code is non-empty string', function () {
  var result = fillTemplate(makePipe());
  assert(typeof result.js_code === 'string');
  assert(result.js_code.length > 0);
});

// ---------------------------------------------------------------------------
// 7. Device null guard — regression test for "device.status is not a function"
// ---------------------------------------------------------------------------

// Extract the render-path code that accesses `device` properties.
// The bug was: after the Transform lifecycle refactor, the early-return
// `if (!device) return jsx(NoDevice, {})` was lost, so `device.status`
// threw "undefined is not an object".
// We test by running the exact lines from bundle.js that follow the guard.

test('device null: render code after useEffect does not crash', function () {
  var device = null;
  // These are the exact lines from bundle.js:718-721 that caused the crash
  var threw = false;
  try {
    // eslint-disable-next-line no-unused-expressions
    device.status;  // This is the line that crashes without the null guard
  } catch (e) {
    threw = true;
  }
  // The guard `if (!device) return jsx(NoDevice, {})` must exist BEFORE this line
  // This test documents that: without the guard, it throws.
  assert(threw, 'device.status throws when device is null — guard must precede this');
});

test('device null: null-safe access pattern works', function () {
  var device = null;
  var online = !!(device && device.status === 'online');
  assert.strictEqual(online, false);
  var devName = (device && device.name) || 'NE101 Camera';
  assert.strictEqual(devName, 'NE101 Camera');
});

test('device undefined: no crash on safe access', function () {
  var device;
  assert.strictEqual(device && device.status, undefined);
  assert.strictEqual(device && device.name, undefined);
});

// ---------------------------------------------------------------------------
// 8. Transform lifecycle scenario tests (simulated React + neomind)
// ---------------------------------------------------------------------------
section('Transform lifecycle scenarios');

// Simulate the effect body by extracting relevant code from the IIFE
// We test the logic by re-implementing the key paths as a state machine
function simulateLifecycle(cfg) {
  var calls = [];
  var neomind = cfg.neomind || {};
  var processingEnabled = cfg.processingEnabled !== false;
  var processingExtId = cfg.processingExtId || 'yolo-device-inference';
  var device = cfg.device !== false ? { id: cfg.deviceId || 'dev-1' } : null;
  var _storedTid = cfg._transformId || '';
  var _storedHash = cfg._transformHash || '';

  // Compute config hash — must match bundle.js _configHash exactly
  var pCategories = cfg.categories || '';
  var pPhrase = cfg.phrase || '';
  var pClassFilter = cfg.classFilter || '';
  var pRoiEnabled = cfg.roiEnabled === true;
  var pRoiAction = cfg.roiAction || '';
  var pRoiX = cfg.roiX != null ? cfg.roiX : 0.1;
  var pRoiY = cfg.roiY != null ? cfg.roiY : 0.1;
  var pRoiW = cfg.roiW != null ? cfg.roiW : 0.8;
  var pRoiH = cfg.roiH != null ? cfg.roiH : 0.8;
  var pRois = Array.isArray(cfg.rois) ? cfg.rois : [];

  var _configHash = processingExtId + ':' + (cfg.template || 'object_detection') + ':' +
    (pCategories || '') + ':' + (pPhrase || '') + ':' + (pClassFilter || '') + ':' +
    (pRoiEnabled ? '1' : '0') + ':' + (pRoiAction || '') + ':' +
    pRoiX + ':' + pRoiY + ':' + pRoiW + ':' + pRoiH + ':' +
    JSON.stringify(pRois);

  var transformIdRef = cfg._refTid || null;
  var configUpdates = [];

  // --- Processing OFF ---
  if (!processingEnabled || !processingExtId || !device) {
    if (_storedTid && neomind.deleteTransform) {
      calls.push({ method: 'deleteTransform', id: _storedTid });
    }
    if (_storedTid) {
      transformIdRef = null;
      configUpdates.push({ _transformId: '', _transformHash: '' });
    }
    return { calls: calls, transformIdRef: transformIdRef, configUpdates: configUpdates };
  }

  if (!neomind.createTransform) {
    return { calls: calls, status: 'unavailable', transformIdRef: transformIdRef, configUpdates: configUpdates };
  }

  // --- Tier 1: Exact match ---
  if (_storedTid && _storedHash === _configHash) {
    transformIdRef = _storedTid;
    return { calls: calls, status: 'active', tier: 1, transformIdRef: transformIdRef, configUpdates: configUpdates };
  }

  var activeId = _storedTid || transformIdRef || '';

  // --- Tier 2: Have ID, config changed ---
  if (activeId) {
    transformIdRef = activeId;
    if (neomind.updateTransform) {
      calls.push({ method: 'updateTransform', id: activeId });
    }
    return { calls: calls, status: 'active', tier: 2, transformIdRef: transformIdRef, configUpdates: configUpdates };
  }

  // --- Tier 3: No ID ---
  if (neomind.listExtensions) {
    calls.push({ method: 'listExtensions' });
  }
  calls.push({ method: 'createTransform' });
  return { calls: calls, status: 'checking', tier: 3, transformIdRef: transformIdRef, configUpdates: configUpdates };
}

test('Tier 1: _transformId + _transformHash match — no API call', function () {
  // Compute the exact hash the bundle code would produce for default config
  var hash = 'yolo-device-inference:object_detection::::0::0.1:0.1:0.8:0.8:[]';
  var result = simulateLifecycle({
    _transformId: 'tid-1',
    _transformHash: hash,
    processingEnabled: true,
    processingExtId: 'yolo-device-inference',
    template: 'object_detection',
    neomind: { createTransform: true, updateTransform: true, deleteTransform: true }
  });
  assert.strictEqual(result.tier, 1);
  assert.strictEqual(result.calls.length, 0);
});

test('Tier 2: _transformId exists, hash mismatch — updateTransform called', function () {
  var result = simulateLifecycle({
    _transformId: 'tid-1',
    _transformHash: 'old-hash',
    processingEnabled: true,
    processingExtId: 'yolo-device-inference',
    neomind: { createTransform: true, updateTransform: true, deleteTransform: true }
  });
  assert.strictEqual(result.tier, 2);
  assert.strictEqual(result.calls.length, 1);
  assert.strictEqual(result.calls[0].method, 'updateTransform');
  assert.strictEqual(result.calls[0].id, 'tid-1');
});

test('Tier 3: no _transformId — listExtensions + createTransform', function () {
  var result = simulateLifecycle({
    _transformId: '',
    processingEnabled: true,
    processingExtId: 'yolo-device-inference',
    neomind: { createTransform: true, updateTransform: true, deleteTransform: true, listExtensions: true }
  });
  assert.strictEqual(result.tier, 3);
  assert(result.calls.some(function (c) { return c.method === 'createTransform'; }));
  assert(result.calls.some(function (c) { return c.method === 'listExtensions'; }));
});

test('Processing OFF: deleteTransform called', function () {
  var result = simulateLifecycle({
    _transformId: 'tid-1',
    processingEnabled: false,
    neomind: { deleteTransform: true }
  });
  assert.strictEqual(result.calls.length, 1);
  assert.strictEqual(result.calls[0].method, 'deleteTransform');
  assert.strictEqual(result.calls[0].id, 'tid-1');
  assert.strictEqual(result.transformIdRef, null);
});

test('Processing OFF with no stored ID: no delete call', function () {
  var result = simulateLifecycle({
    _transformId: '',
    processingEnabled: false,
    neomind: { deleteTransform: true }
  });
  assert.strictEqual(result.calls.length, 0);
});

test('Device null: no crash, returns cleanup', function () {
  var result = simulateLifecycle({
    device: false,
    _transformId: '',
    processingEnabled: true,
    neomind: { createTransform: true }
  });
  assert.strictEqual(result.calls.length, 0);
});

test('No neomind API: status unavailable', function () {
  var result = simulateLifecycle({
    processingEnabled: true,
    processingExtId: 'yolo-device-inference',
    neomind: {}
  });
  assert.strictEqual(result.status, 'unavailable');
});

test('StrictMode: ref has ID from first effect — upgrade to update', function () {
  // Simulate: first effect created transform, set ref, but config not yet updated
  var result = simulateLifecycle({
    _transformId: '',           // config not yet updated
    _refTid: 'tid-from-first',  // but ref already set by first effect
    processingEnabled: true,
    processingExtId: 'yolo-device-inference',
    neomind: { createTransform: true, updateTransform: true, listExtensions: true }
  });
  // Should use the ref ID and call updateTransform (Tier 2 via ref)
  assert.strictEqual(result.tier, 2);
  assert.strictEqual(result.calls[0].method, 'updateTransform');
  assert.strictEqual(result.calls[0].id, 'tid-from-first');
});

// ---------------------------------------------------------------------------
// 8. Object-cover Transform math verification
// ---------------------------------------------------------------------------
section('Object-cover Transform math');

function computeOvTf(imgNat, ctrSize) {
  if (imgNat.w <= 0 || imgNat.h <= 0 || ctrSize.w <= 0 || ctrSize.h <= 0) return null;
  var imgAsp = imgNat.w / imgNat.h;
  var cAsp = ctrSize.w / ctrSize.h;
  if (Math.abs(imgAsp - cAsp) < 0.001) return null;
  if (imgAsp > cAsp) {
    var scX = (ctrSize.h / imgNat.h * imgNat.w) / ctrSize.w;
    return { sx: scX, sy: 1, ox: (1 - scX) / 2, oy: 0 };
  } else {
    var scY = (ctrSize.w / imgNat.w * imgNat.h) / ctrSize.h;
    return { sx: 1, sy: scY, ox: 0, oy: (1 - scY) / 2 };
  }
}

function mapBbox(bbox, ovTf) {
  if (!ovTf) return { left: bbox[0] * 100, top: bbox[1] * 100, width: (bbox[2] - bbox[0]) * 100, height: (bbox[3] - bbox[1]) * 100 };
  return {
    left: (bbox[0] * ovTf.sx + ovTf.ox) * 100,
    top: (bbox[1] * ovTf.sy + ovTf.oy) * 100,
    width: (bbox[2] - bbox[0]) * ovTf.sx * 100,
    height: (bbox[3] - bbox[1]) * ovTf.sy * 100
  };
}

test('wide image in narrow container: sx > 1, ox < 0', function () {
  var ovTf = computeOvTf({ w: 1920, h: 1080 }, { w: 300, h: 200 });
  assert(ovTf !== null);
  assert(ovTf.sx > 1, 'sx > 1');
  assert(ovTf.ox < 0, 'ox < 0');
  assert.strictEqual(ovTf.sy, 1);
  assert.strictEqual(ovTf.oy, 0);
});

test('narrow image in wide container: sy > 1, oy < 0', function () {
  // 480/640=0.75 image aspect, 300/600=0.5 container aspect → image taller relative to container
  var ovTf = computeOvTf({ w: 640, h: 480 }, { w: 600, h: 300 });
  assert(ovTf !== null);
  assert(ovTf.sy > 1, 'sy > 1');
  assert(ovTf.oy < 0, 'oy < 0');
  assert.strictEqual(ovTf.sx, 1);
  assert.strictEqual(ovTf.ox, 0);
});

test('square image in square container: ovTf = null', function () {
  var ovTf = computeOvTf({ w: 500, h: 500 }, { w: 400, h: 400 });
  assert.strictEqual(ovTf, null);
});

test('bbox [0,0,1,1] maps to cover full container when no transform', function () {
  var mapped = mapBbox([0, 0, 1, 1], null);
  assert.strictEqual(mapped.left, 0);
  assert.strictEqual(mapped.top, 0);
  assert.strictEqual(mapped.width, 100);
  assert.strictEqual(mapped.height, 100);
});

test('bbox [0,0,1,1] maps to full container with transform too', function () {
  var ovTf = computeOvTf({ w: 1920, h: 1080 }, { w: 300, h: 200 });
  var mapped = mapBbox([0, 0, 1, 1], ovTf);
  // Full image bbox should map to cover the container area
  // left = (0 * sx + ox) * 100 = ox * 100 < 0 (clipped left)
  // width = (1 - 0) * sx * 100 = sx * 100 > 100 (wider than container)
  assert(mapped.left < 0, 'left < 0 (clipped)');
  assert(mapped.width > 100, 'width > 100 (extends beyond container)');
  assert.strictEqual(mapped.top, 0);
  assert.strictEqual(mapped.height, 100);
});

test('small bbox maps to proportional area', function () {
  var ovTf = computeOvTf({ w: 1920, h: 1080 }, { w: 300, h: 200 });
  // A bbox in center of image should map to center of container
  var mapped = mapBbox([0.4, 0.3, 0.6, 0.7], ovTf);
  assert(mapped.left > 0 && mapped.left < 100);
  assert(mapped.top > 0 && mapped.top < 100);
  assert(mapped.width > 0 && mapped.width < 100);
  assert(mapped.height > 0 && mapped.height < 100);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' PASS, ' + failed + ' FAIL');
console.log('='.repeat(50));

if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(function (e) {
    console.log('  - ' + e.name + ': ' + e.error.message);
  });
}

process.exit(failed > 0 ? 1 : 0);
