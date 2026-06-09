# TextDisplay Component Design Spec

## Overview

A dashboard component that renders structured data (JSON, key-value pairs, arrays, nested objects) as clean, readable text with highlighted values. Designed for the NeoMind Edge AI Platform dashboard.

## Requirements

### Data Source

- Binds to NeoMind platform data sources (up to 5)
- Accepts JSON objects, arrays, strings, and numbers
- Auto-detects data type and formats accordingly

### Display Style

- **Natural sentence style**: key and value on same line, values highlighted with color pills
- **No emoji or character icons** in the output
- Frosted-glass card aesthetic matching existing components (backdrop-filter, semi-transparent borders)
- Monospace font for content area

### Format Rules

| Input Type | Formatting |
|---|---|
| Key-Value (flat object) | `key` **value** (one per line) |
| Array of strings | Each item on its own line, values highlighted |
| Array of objects | Each object's fields rendered inline, separated by line breaks |
| Nested object | Dot-notation keys: `parent.child` **value** |
| String | Direct display, numbers within text auto-highlighted |
| Number | Displayed with highlighting |

### Highlight Colors (Design Tokens)

Uses OKLCH design tokens per STYLE_GUIDE.md — no hardcoded hex colors:

- **Cyan** (`text-accent-cyan` / `bg-accent-cyan-light`): string values (IDs, names, types)
- **Warning** (`text-warning` / `bg-warning-light`): numeric values (counts, measurements, durations)
- **Success** (`text-success` / `bg-success-light`): status-like values (online, success, percentages)

### Value Formatting

- Numbers between 0-1 with decimal: auto-convert to percentage (0.985 → 98.5%)
- Boolean: displayed as text (true/false or custom labels)

## Manifest

```json
{
  "id": "text_display",
  "name": { "en": "Text Display", "zh": "文本展示" },
  "description": {
    "en": "Renders structured data as formatted text with highlighted values",
    "zh": "将结构化数据格式化为带高亮的可读文本展示"
  },
  "icon": "FileText",
  "category": "display",
  "version": "1.0.0",
  "author": "NeoMind Team",
  "size_constraints": {
    "min_w": 2,
    "min_h": 2,
    "default_w": 3,
    "default_h": 3,
    "max_w": 6,
    "max_h": 6
  },
  "has_data_source": true,
  "max_data_sources": 5,
  "has_device_binding": false,
  "has_display_config": true,
  "has_actions": false,
  "config_schema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "default": "Text Display",
        "title": "Title"
      },
      "maxHeight": {
        "type": "number",
        "default": 300,
        "title": "Max Height (px)"
      },
      "fontSize": {
        "type": "string",
        "default": "medium",
        "enum": ["small", "medium", "large"],
        "title": "Font Size"
      },
      "highlightNumbers": {
        "type": "boolean",
        "default": true,
        "title": "Highlight Numbers"
      }
    }
  },
  "default_config": {
    "title": "Text Display",
    "maxHeight": 300,
    "fontSize": "medium",
    "highlightNumbers": true
  },
  "global_name": "NeoMind_TextDisplay",
  "export_name": "TextDisplay"
}
```

## Visual Structure

```
┌─────────────────────────────────────┐
│  Title                    (config)  │
│─────────────────────────────────────│
│  key1  highlighted_value            │
│  key2  highlighted_value            │
│  key3  highlighted_value            │
│  ...                                │
│              ↕ scrollable           │
└─────────────────────────────────────┘
```

- Title: `text-accent-purple`, bottom border separator
- Content: monospace, line-height 1.8
- Values rendered as inline pills with semi-transparent background
- Max height configurable, overflow scrolls

## Technical Architecture

### File Structure

```
components/text-display/
├── manifest.json    # Component metadata + config schema
├── bundle.js        # IIFE component bundle
└── screenshot.png   # Preview image
```

### Core Functions

1. **`formatData(data)`** — Entry point, dispatches by data type
2. **`formatObject(obj, prefix)`** — Recursively flattens object to key-value lines, dot-notation for nested keys
3. **`formatArray(arr)`** — Each item formatted as a line; objects within arrays get inline field rendering
4. **`formatString(str)`** — Pass-through with optional number highlighting
5. **`renderLine(key, value)`** — Renders a single text line with highlighted value pill

### Rendering Pipeline

```
NeoMind DataSource → raw data → formatData() → [{key, value, type}] → renderLine() → React elements
```

### React Component

- Functional component using `window.React` and `window.jsxRuntime`
- `useEffect` to inject scoped CSS styles
- `useMemo` for formatted data computation
- Props: standard NeoMind component props (data sources, config)

### CSS

- Scoped via unique class prefix (`text-display-xxx`)
- Injected via `<style>` tag with unique ID
- Uses OKLCH design tokens from platform where available
- Scrollbar styling for WebKit browsers

## Data Source Integration

- Component declares up to 5 data source slots in manifest
- Uses `props.fetchData()` to fetch data (see STYLE_GUIDE section 11)
- `useEffect` with `[props.fetchData]` dependency triggers fetch on mount and source change
- `fetchData()` returns `{ value: <any> }` — the `value` field is passed to `formatData()`
- If multiple sources are bound, their content is rendered sequentially with a subtle separator
- Each rendered line uses `key + '_' + index` as the React key to guarantee uniqueness

## Edge Cases

- Empty/null data: show "No data" placeholder with `text-muted-foreground`
- Very long string values: truncate with ellipsis in display, full text on hover via title attribute
- Deeply nested objects: flatten up to 10 levels deep
- Mixed-type arrays: handle each element by its own type
