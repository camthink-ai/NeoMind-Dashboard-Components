# NeoMind Dashboard Components

Community component marketplace for NeoMind Edge AI Platform.

## Structure

```
index.json                        # Component index (fetched by NeoMind backend)
STYLE_GUIDE.md                    # Visual style guide for component authors
components/
  └── {component-id}/
      ├── manifest.json           # Component metadata
      ├── bundle.js               # IIFE JavaScript bundle
      └── screenshot.png          # Optional screenshot
```

## Adding a Component

1. Create a directory under `components/` with your component ID
2. Add `manifest.json` with metadata (see schema below)
3. Add `bundle.js` as an IIFE that registers on `window`
4. Optionally add `screenshot.png`
5. Add an entry to `index.json`

### Manifest Schema

```json
{
  "id": "my-component",
  "name": { "en": "My Component", "zh": "我的组件" },
  "description": { "en": "A custom component", "zh": "自定义组件" },
  "icon": "Box",
  "category": "display",
  "version": "1.0.0",
  "author": "Author Name",
  "size_constraints": {
    "min_w": 1, "min_h": 1,
    "default_w": 2, "default_h": 2,
    "max_w": 12, "max_h": 12
  },
  "has_data_source": false,
  "has_display_config": false,
  "has_actions": false,
  "global_name": "MyComponent",
  "export_name": "MyComponent"
}
```

### Bundle Format

Bundles must be IIFE scripts that expose a React component via a global variable:

```javascript
var MyComponent = (function() {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;

  function Component(props) {
    return jsx('div', { children: 'Hello' });
  }

  return { default: Component, MyComponent: Component };
})();
```

Available globals: `window.React`, `window.jsxRuntime` (jsx, jsxs).

## Device Binding Components

Components can bind to specific device types to receive rich device context (metrics, commands, current values).

### Manifest Fields

```json
{
  "has_device_binding": true,
  "device_type_filter": ["ne101_camera"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `has_device_binding` | `boolean` | Component requires a device instance to function |
| `device_type_filter` | `string[]` | Restrict device selector to these device_type strings |

### Props Received

When a device is bound, the component receives these additional props:

```javascript
{
  deviceContext: {
    device: {
      id: "ne101_abc123",
      name: "Front Door Camera",
      deviceType: "ne101_camera",
      status: "online",
      lastSeen: "2026-05-11T06:00:00Z",
      currentValues: {
        "ts": 1740640441620,
        "values.battery": 84,
        "values.devName": "NE101"
      }
    },
    deviceType: {
      name: "CamThink Sensing Camera",
      deviceType: "ne101_camera",
      metrics: [
        { "name": "ts", "display_name": "Timestamp", "data_type": "Integer" },
        { "name": "values.battery", "display_name": "Battery Level", "data_type": "Integer", "unit": "%" }
      ],
      commands: []
    }
  },
  sendDeviceCommand: async (command, params?) => boolean
}
```

### Real-time Data Updates (WebSocket)

**`device.currentValues` is updated in real-time by the platform.** Do NOT poll REST APIs or use `setInterval` to fetch device data.

The platform's update flow:

```
WS DeviceMetric event
  → ComponentRenderer processes event
  → store.updateDeviceMetric(deviceId, key, value)
  → deviceContext.currentValues updated
  → Component re-renders with new props
```

Community components receive real-time updates automatically through this mechanism — the same WebSocket infrastructure used by built-in components. Simply read `device.currentValues` in your render logic and the component will re-render whenever new telemetry arrives.

```javascript
// ✅ Correct — use device.currentValues directly (auto-updated via WS)
function Component(props) {
  var device = props.deviceContext && props.deviceContext.device;
  var values = device ? (device.currentValues || {}) : {};
  var battery = values['values.battery'];
  // ...
}

// ❌ Wrong — do NOT poll REST APIs for real-time data
var timer = setInterval(function () {
  neomind.fetchDeviceValues(device.id).then(function (v) { ... });
}, 5000);
```

### Example: Rendering Device Metrics

```javascript
function DevicePanel(props) {
  var device = props.deviceContext && props.deviceContext.device;
  var deviceType = props.deviceContext && props.deviceContext.deviceType;

  if (!device) {
    return jsx('div', { className: '...', children: 'No device bound' });
  }

  var values = device.currentValues || {};
  var metrics = (deviceType && deviceType.metrics) || [];

  // Render each metric
  var rows = metrics.map(function(m) {
    var v = values[m.name];
    return jsx('div', { key: m.name, children: (m.display_name || m.name) + ': ' + (v != null ? v : '--') });
  });

  return jsx('div', { children: rows });
}
```

### Example: Sending Commands

```javascript
function DeviceControls(props) {
  var commands = (props.deviceContext && props.deviceContext.deviceType && props.deviceContext.deviceType.commands) || [];
  var sendCmd = props.sendDeviceCommand;

  return jsx('div', {
    children: commands.map(function(cmd) {
      return jsx('button', {
        key: cmd.name,
        onClick: function() { sendCmd(cmd.name); },
        children: cmd.display_name || cmd.name
      });
    })
  });
}
```

## Data Access (fetchData Prop)

Community and extension components receive a `fetchData` prop for unified data access. This is available to **all** community/extension components (not just device-bound ones), regardless of `has_data_source` setting.

```javascript
// fetchData is an async function that resolves DataSource data
// Returns { value } for latest/info modes, { series } for timeseries mode
props.fetchData(options?)  // → Promise<{ value?: any, series?: any[] } | null>
```

### Example: Fetch Device Metric

```javascript
function MetricWidget(props) {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var dataState = React.useState(null);
  var data = dataState[0];
  var setData = dataState[1];

  React.useEffect(function() {
    if (props.fetchData) {
      props.fetchData().then(function(result) {
        if (result) setData(result.value || result.series);
      });
    }
  }, [props.dataSource]);

  return jsx('div', { children: data != null ? String(data) : 'Loading...' });
}
```

### Example: Fetch with Time Range

```javascript
// Fetch last 24 hours of telemetry data
props.fetchData({ timeRange: 24, limit: 200 }).then(function(result) {
  // result.series → array of { timestamp, value } points
});
```

### Return Format

| Mode | Returns | Use Case |
|------|---------|----------|
| `latest` | `{ value: <any> }` | Single metric value |
| `timeseries` | `{ series: [{ timestamp, value }] }` | Historical chart data |
| `info` | `{ value: <string> }` | Device metadata (name, status) |
| `command` | `{ value: undefined }` | Command sources (no fetch) |

> **Note**: `fetchData` resolves the component's configured `dataSource` from the dashboard config. If no dataSource is configured, returns `null`.

## Custom Config Panel

Components can export optional config panels for rich configuration UI. When detected, NeoMind uses them instead of the auto-generated JSON Schema form.

### Bundle Exports

| Export | Config Tab | Description |
|--------|-----------|-------------|
| `ConfigPanel` | Display | Basic component settings |
| `AdvancedPanel` | Style | Advanced/complex settings |

Both are optional — export one or both. Bundles without them fall back to JSON Schema auto-generation.

```javascript
var MyComponent = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  // Display tab — basic settings
  function ConfigPanel(props) {
    var config = props.config;
    var onChange = props.onChange;
    return jsxs('div', { className: 'space-y-3', children: [
      /* Toggle switches, inputs, selects using Tailwind classes */
    ]});
  }

  // Style tab — advanced settings
  function AdvancedPanel(props) {
    var config = props.config;
    var onChange = props.onChange;
    return jsxs('div', { className: 'space-y-3', children: [
      /* Complex config: visual editors, multi-field groups, etc. */
    ]});
  }

  function Component(props) { /* ... */ }

  return { default: Component, MyComponent: Component, ConfigPanel: ConfigPanel, AdvancedPanel: AdvancedPanel };
})();
```

### Panel Props

Both panels receive identical props:

| Prop | Type | Description |
|------|------|-------------|
| `config` | `Record<string, any>` | Current configuration values |
| `onChange` | `(key: string, value: any) => void` | Update a single config key |

### UI Guidelines

- Use **Tailwind CSS classes** to match the platform's design system
- Container: `className="space-y-3"`
- Labels: `className="text-sm font-medium"`
- Inputs: `className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"`
- Descriptions: `className="text-xs text-muted-foreground"`
- Toggle switches can be built with `role="switch"` buttons + Tailwind

### Notes

- No manifest changes required — detected at runtime via `window[globalName].ConfigPanel` / `window[globalName].AdvancedPanel`
- Uses the same `window.React` and `window.jsxRuntime` globals as the main component
- Device binding and data source sections are rendered **separately** by the platform

## Style Guide

See [STYLE_GUIDE.md](./STYLE_GUIDE.md) for the full visual style guide covering:

- Color tokens and semantic colors
- Typography scale and font rules
- Spacing, radius, and layout patterns
- Status colors and badges
- Animation classes
- Dark mode handling
- Device binding prop reference

## Existing Components

| ID | Category | Description |
|----|----------|-------------|
| `clock` | Display | Real-time clock widget with 12h/24h format |
| `ne101_camera` | Device | CamThink NE101 camera panel with capture display, battery, AI processing pipeline, and device commands |

---

## NE101 Camera Panel — Processing Pipeline

The NE101 component supports a built-in AI processing pipeline that runs inference on captured images via NeoMind extensions.

### How It Works

1. **Backend Transform (Layer 1)**: When `processing.enabled` is true, the component creates a Transform automation via `window.neomind.createTransform()`. The backend TransformEngine resolves input mappings (e.g., fetches the image URL, converts to base64), calls the extension, extracts outputs, and writes virtual metrics.

2. **Client-side Fallback (Layer 2)**: If the backend hasn't produced virtual metrics yet (e.g., first image), the component directly calls the extension via `window.neomind.callExtension()` and processes the response locally.

3. **Virtual Metrics**: Both layers produce metrics prefixed with `virtual.` that are stored on the device and displayed in the component overlay.

### Processing Templates

| Template | Extensions | Virtual Metrics |
|----------|------------|-----------------|
| `object_detection` | `locate-anything-v2` (`detect`), `image-analyzer-v2` (`analyze_image`), `yolo-device-inference` (`analyze_image`) | `virtual.detections`, `virtual.total_count`, `virtual.count_by_class` |
| `grounding` | `locate-anything-v2` (`ground`) | `virtual.detections` |
| `text_detection` | `locate-anything-v2` (`detect_text`), `ocr-device-inference` (`recognize_image`) | `virtual.detections`, `virtual.texts` |
| `ground_gui` | `locate-anything-v2` (`ground_gui`) | `virtual.detections` |
| `point` | `locate-anything-v2` (`point`) | `virtual.points` |

Each extension uses a different input argument name and response format. The component normalizes all responses into a unified detection format (`{ bbox, label, confidence }`) with normalized 0–1 coordinates.

ROI is a **standalone feature** enabled via `processingRoiEnabled`. When active, it adds `virtual.roi_count` and optionally modifies `virtual.detections` based on the `processingRoiAction` setting.

### Configuration

```json
{
  "processingEnabled": true,
  "processingExtensionId": "locate-anything-v2",
  "processingTemplate": "object_detection",
  "processingCategories": "person,car",
  "processingPhrase": "",
  "processingClassFilter": "",
  "processingRoiEnabled": true,
  "processingRoiAction": "count",
  "processingRoiX": 0.1,
  "processingRoiY": 0.1,
  "processingRoiW": 0.8,
  "processingRoiH": 0.8
}
```

| Field | Description |
|-------|-------------|
| `processingEnabled` | Enable/disable the processing pipeline |
| `processingExtensionId` | ID of the installed extension to invoke |
| `processingTemplate` | Built-in template (`object_detection`, `grounding`, `text_detection`) |
| `processingCategories` | Comma-separated detection categories |
| `processingPhrase` | Search phrase for grounding/text detection |
| `processingClassFilter` | Comma-separated class names to include (empty = all) |
| `processingRoiEnabled` | Enable Region of Interest (independent of template) |
| `processingRoiAction` | ROI post-processing: `count`, `count_by_class`, or `filter` |
| `processingRoiX` / `processingRoiY` | ROI top-left corner position (0–1 normalized) |
| `processingRoiW` / `processingRoiH` | ROI width and height (0–1 normalized) |

### Virtual Metrics

Virtual metrics are stored under `device.currentValues` with the `virtual.` prefix:

| Metric | Type | Description |
|--------|------|-------------|
| `virtual.detections` | JSON array | Bounding boxes with `bbox` (normalized 0–1), `label`, `confidence` |
| `virtual.total_count` | Number | Total number of detected objects |
| `virtual.roi_count` | Number | Objects within the configured ROI |
| `virtual.count_by_class` | JSON object | Per-class count, e.g. `{"person": 2, "car": 1}` |
| `virtual.texts` | JSON array | Extracted text strings from text detection |

### Visual Overlays

When processing is active, the component renders:
- **Detection boxes** — Blue bounding boxes with labels and confidence percentages
- **ROI rectangle** — Yellow dashed rectangle showing the active Region of Interest (when ROI is enabled)
- **Count badges** — Total count, ROI count, and per-class breakdown in the bottom overlay
- **Extracted texts** — Preview of detected text content (for `text_detection` template)

### Input/Output Mapping

The templates define how device data maps to extension inputs and how extension responses map to virtual metrics. This mapping is handled by the backend TransformEngine:

**Input mapping** (device → extension):
```json
{ "image_base64": { "from": "values.image", "convert": "url_to_base64" } }
```

> **Note**: The device may send images as either base64 strings or URLs. The backend TransformEngine auto-detects base64 and passes it through without conversion.

**Output mapping** (extension → virtual metrics):
```json
{
  "virtual.detections": { "from": "boxes", "normalize": true },
  "virtual.total_count": { "from": "boxes", "transform": "count" },
  "virtual.count_by_class": { "from": "boxes", "transform": "count_by_class" }
}
```

The component does **not** interpret these mappings — they are passed through to `createTransform()` for the backend TransformEngine to process.

## NeoMind Runtime API (`window.neomind`)

Components running inside NeoMind have access to the platform API via `window.neomind`. All methods are async and degrade gracefully when unavailable.

```javascript
var neomind = window.neomind;
if (!neomind) {
  // Running outside NeoMind — disable platform features
}
```

### Available Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `callExtension(id, command, args?)` | `Promise<unknown>` | Execute a command on an installed extension |
| `listExtensions()` | `Promise<Extension[]>` | List all installed extensions |
| `createTransform(config)` | `Promise<Transform>` | Create a transform (processing pipeline step) |
| `deleteTransform(id)` | `Promise<void>` | Delete a transform by ID |
| `listTransforms(filter?)` | `Promise<Transform[]>` | List transforms, optionally filtered |
| `writeMetric(deviceId, metric, value)` | `Promise<void>` | Write a virtual metric value for a device |
| `fetchDeviceValues(deviceId)` | `Promise<object \| null>` | One-time fetch of all device telemetry values |

> **Warning**: `fetchDeviceValues` is for **one-time** data retrieval only (e.g., initial load). Do NOT use it in a polling loop (`setInterval`). Real-time updates come automatically via `device.currentValues` through the platform's WebSocket infrastructure.

### Extension Object

```javascript
{
  id: "locate-anything-v2",
  name: "Locate Anything",
  version: "2.0.0",
  state: "running"  // "running" | "stopped" | "error"
}
```

### TransformConfig

```javascript
{
  name: "unique-name",
  scope: "device-id",          // Scope to a device's data stream
  extension_id: "ext-id",      // Extension to invoke
  command: "detect",           // Extension command
  rule: { device_id: "..." },  // Matching rule
  input: { ... },              // Input field mappings (optional)
  output: { ... }              // Output field mappings (optional)
}
```

### Best Practices

- **Always check** `window.neomind` exists before calling methods
- **Wrap calls** in try/catch — methods may fail if extension is unavailable
- **Never poll REST APIs** — `device.currentValues` in props is updated in real-time via WebSocket
- **Clean up transforms** only on component deletion, not on page navigation or unmount
- **Never block rendering** — use async patterns and show loading/fallback states
