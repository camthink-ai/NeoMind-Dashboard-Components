# NeoMind Dashboard Components

Community component marketplace for NeoMind Edge AI Platform.

## Structure

```
index.json                        # Component index (fetched by NeoMind backend)
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
