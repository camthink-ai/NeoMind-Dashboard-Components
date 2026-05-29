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
| `ne101-camera` | Device | CamThink NE101 camera panel with capture display, battery, and device commands |
