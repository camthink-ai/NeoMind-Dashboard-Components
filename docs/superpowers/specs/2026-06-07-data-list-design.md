# Data List Component Design

## Overview

A generic, zero-config data list component for the NeoMind Dashboard. Binds to a data source via the main project's metric selection, auto-infers columns from the data structure, and renders a compact, styled list with responsive layout.

## Component Identity

- **ID**: `data_list`
- **Name**: `{ "en": "Data List", "zh": "数据列表" }`
- **Description**: `{ "en": "A configurable data list with auto-inferred columns and responsive layout", "zh": "可配置的数据列表，自动推断列，响应式布局" }`
- **Icon**: `List`
- **Category**: `display`
- **Version**: `1.0.0`
- **Author**: `NeoMind Team`
- **Global Name**: `NeoMind_DataList`
- **Export Name**: `DataList`
- **Size Constraints**: `min_w: 2, min_h: 2, default_w: 4, default_h: 3, max_w: 12, max_h: 8`
- **Data Source**: `has_data_source: true`, `max_data_sources: 1`
- **Display Config**: `has_display_config: true`
- **Actions**: `has_actions: false`

## File Structure

```
components/data_list/
├── manifest.json        # Component metadata + config_schema
├── bundle.js            # IIFE: DataList + ConfigPanel exports
└── screenshot.png
```

## Data Flow

```
Main Project                    Component
─────────────                   ─────────
useDataSource selection  ──→   fetchData() called
(metric binding done             ↓
 in dashboard)                 { value: [{...}, ...] }
                                 ↓
                              Auto-infer columns
                              from first item's keys
                                 ↓
                              Render list rows
```

1. User selects metrics in the main project dashboard, binding a data source to this component
2. Component calls `props.fetchData()` on mount and receives data
3. Component auto-infers columns from the first array item's keys
4. Data is rendered as styled list rows

### Refresh Strategy

- Component re-fetches data on mount and when `fetchData` prop reference changes (data source reconfigured)
- No periodic polling — the component relies on the main project's data freshness management
- If the main project supports push updates via prop changes, the component reacts automatically

## Data Format Adaptation

`fetchData()` can return various formats. The component auto-adapts:

| Return format | Strategy |
|---|---|
| `{ value: [...] }` where value is array | Use directly as row data |
| `{ value: {...} }` where value is object | Search for first array-typed field |
| `{ series: [...] }` | Convert series to row data |
| Incompatible / null | Show "Data format incompatible" empty state |

Optional `data_path` config field allows manual override (e.g., `value.items`, `data.records`). See Config Schema below.

## Column Auto-Inference

When data arrives, extract columns from the first array item:

```
{ name: "Front Door Cam", type: "camera", battery: 84, status: "online", lastSeen: 1740640441620 }
       ↓
columns:
  - key: "name"      label: "Name"       type: text
  - key: "type"      label: "Type"       type: text
  - key: "battery"   label: "Battery"    type: number
  - key: "status"    label: "Status"     type: text
  - key: "lastSeen"  label: "Last Seen"  type: time
```

**Inference rules**:
- `label`: key transformed (snake_case → Title Case, camelCase → Space Separated)
- `type`:
  - Values are numbers → `number` (right-aligned, tabular-nums)
  - Values are timestamps (> 1e12) → `time` (relative time display)
  - Values are booleans → `status` (colored dot + text)
  - String values with fewer than 8 distinct values among first 50 items → `tag` (semi-transparent colored badge)
  - All other → `text`
- `width`: proportional flex — first text column gets `flex:2`, others get `flex:1`
- `priority`: inferred order determines responsive hide priority (last columns hidden first)

## Column Rendering by Type

| Type | Render |
|---|---|
| `text` | Plain text, left-aligned |
| `number` | Right-aligned, `font-mono tabular-nums`, mini progress bar if percentage-like |
| `time` | Right-aligned, relative time ("2 min ago", "3h ago") or formatted date |
| `status` | Colored dot (`bg-success`/`bg-error`) + label text |
| `tag` | Semi-transparent colored badge with accent color |

Tag colors are auto-assigned from the accent palette (purple, cyan, emerald, orange) based on distinct values in the first batch of data.

## Config Schema

```json
{
  "config_schema": {
    "type": "object",
    "properties": {
      "row_height": {
        "type": "string",
        "enum": ["compact", "default"],
        "default": "default",
        "title": "Row Height"
      },
      "data_path": {
        "type": "string",
        "default": "",
        "title": "Data Path"
      },
      "columns": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "key": { "type": "string" },
            "label": { "type": "string" },
            "visible": { "type": "boolean", "default": true },
            "order": { "type": "number" }
          }
        },
        "default": [],
        "title": "Columns"
      }
    }
  },
  "default_config": {
    "row_height": "default",
    "data_path": "",
    "columns": []
  }
}
```

When `columns` is empty (default), all columns are auto-inferred and shown. User can optionally override visibility, labels, and order through the ConfigPanel.

## ConfigPanel

Minimal UI for optional tweaks after auto-inference:

- **Row height toggle**: Compact (7px padding) / Default (10px padding)
- **Column list**: Checkboxes for show/hide, drag handles for reorder
- **Label editing**: Click column name to edit display label

No required configuration. The component works immediately upon data source binding.

## Visual Design

### Container
- Background: `bg-card`
- Border: `border border-glass-border`
- Border radius: `rounded-lg` (10px)
- Fills container: `w-full h-full`

### Column Header
- Padding: 6-8px horizontal, 8px vertical
- Font: 10px, uppercase, letter-spacing 0.5px, `text-muted-foreground`
- Border bottom: `border-glass-border`
- Sticky at top

### Row Styling
- Default height padding: `py-2.5 px-3.5` (default) / `py-2 px-3` (compact)
- Alternating row background: `bg-card` / `bg-muted-30`
- Hover: `bg-muted` background + left 2px accent border
- Row separator: `border-t border-glass-border`
- Font size: 12px body, 11px secondary text
- Transition: `transition-colors`

### Name Column
- Gradient icon (28x28, rounded-md) + text
- Icon background: gradient from accent color
- Text: `font-medium text-foreground`
- Truncation: `overflow-hidden text-ellipsis whitespace-nowrap`

### Tag Column
- Font: 10px, `font-semibold`
- Background: accent color light variant (`bg-accent-*-light`)
- Text: accent color (`text-accent-*`)
- Padding: `px-2 py-0.5`
- Border radius: `rounded`

### Number Column
- Right-aligned
- Mini progress bar (32x4px) + value for percentage-like values
- `font-mono tabular-nums`
- Low values (< 20%): `text-error`
- Warning values (20-40%): `text-warning`
- Normal: `text-foreground`

### Status Column
- Colored dot (6x6px, `rounded-full`)
- Online: `bg-success` with glow (`box-shadow: 0 0 6px`)
- Offline: `bg-muted-foreground` (not error — offline is distinct from error per STYLE_GUIDE section 5)
- Label text in matching color

### Time Column
- Right-aligned, 11px, `text-muted-foreground`
- Relative format: "Just now", "2 min ago", "3h ago", "2d ago"
- Fallback to date string for older entries

## Responsive Behavior

Three breakpoints based on container width:

| Width | Layout | Columns |
|---|---|---|
| > 400px | Full row layout | All columns visible, flex proportional |
| 300-400px | Row layout | Hide columns by priority (last → first) |
| < 300px | Stacked mode | Icon + name + status dot on line 1, subtitle summary on line 2 |

Priority order for hiding: rightmost columns first (time → status → number → tag → name always visible).

In stacked mode (< 300px):
- No column header row
- Each row: icon (22x22) + name (ellipsis) + status dot
- Second line: `text-muted-foreground` summary (e.g., "Camera · 84%")

## Infinite Scroll

- Initial load: `fetchData()` — returns all available data
- If result is an array with 50+ items, component loads first 50 and marks as scrollable
- Detect scroll to bottom via `onScroll` on the scrollable container
- Load next batch from the already-fetched data (client-side chunking)
- If the data source supports `fetchData({ limit: N })`, use it for server-side pagination
- Show loading indicator (animated dots) while fetching
- Stop loading when all data is rendered

## Empty States

| State | Display |
|---|---|
| No data source bound | `text-muted-foreground` "No data source configured" |
| Empty data (0 items) | `text-muted-foreground` "No data" with subtle icon |
| Incompatible format | `text-muted-foreground` "Data format incompatible" |
| Fetch error | `text-muted-foreground` "Failed to load data" with retry button |
| Loading | Animated pulse dots |

## ConfigPanel Export

The component exports a `ConfigPanel` function for the main project to render in the configuration panel area. It receives the same `config` and an `onConfigChange` callback to update settings.

```javascript
return {
  default: DataList,
  ConfigPanel: ConfigPanel
};
```

## Style Token Reference

All styling uses NeoMind design tokens exclusively:

- Surfaces: `bg-card`, `bg-muted`, `bg-muted-30`
- Borders: `border-glass-border`
- Text: `text-foreground`, `text-muted-foreground`
- Status: `text-success`, `text-error`, `text-warning`
- Accents: `text-accent-purple`, `text-accent-cyan`, `text-accent-emerald`, `text-accent-orange`
- Accent lights: `bg-accent-purple-light`, `bg-accent-cyan-light`, etc.
- Foreground on color: `text-primary-foreground`

No hardcoded Tailwind palette colors. No raw hex/rgb values. All colors adapt to dark mode automatically.

## Technical Notes

- IIFE wrapper: `var NeoMind_DataList = (function() { ... })();`
- Uses `window.React`, `window.jsxRuntime.jsx`, `window.jsxRuntime.jsxs`
- No external dependencies
- All CSS via Tailwind classes + inline styles for dynamic values
- `key` prop required on all mapped elements (use row index or item id field)
- React `useEffect` + `useRef` for scroll detection
- React `useState` for data, loading state, and column config
- Export: `return { default: DataList, DataList: DataList, ConfigPanel: ConfigPanel };`
