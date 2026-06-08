# Metric Card Component — Design Spec

## Overview

A frosted-glass metric card component for the NeoMind dashboard. Displays 1–12 numeric metrics with left-aligned hierarchy layout, adapting to card dimensions and aspect ratio. Supports both light and dark themes via CSS variables.

## Visual Design

### Glass Effect

The card uses a frosted glass aesthetic that adapts to the active theme:

- **Background**: `bg-card` with inline `backdrop-filter: blur(20px)`
- **Border**: `border-glass-border`
- **Border radius**: `rounded-xl`
- **Shadow**: `style={{ boxShadow: '0 4px 30px oklch(0.18 0.02 270 / 10%)' }}`
- **Theme**: All color tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-glass-border`) auto-adapt to light/dark mode — no theme-specific styles needed

### Layout: Left-Aligned Hierarchy

Each metric cell follows this structure:

```
┌─────────────────┐
│ TEMPERATURE     │  ← label: text-xs, uppercase, text-muted-foreground
│ 36.5 °C        │  ← value: font-bold, font-mono, tabular-nums + unit: text-xs
└─────────────────┘
```

- Label sits above the value+unit row
- Value and unit are baseline-aligned via flex `items-baseline`
- Numeric font: `font-mono tabular-nums` for column alignment

### Adaptive Grid

The layout adapts based on two factors: **number of data sources bound** and **card aspect ratio** (width vs height). The component uses `useRef` + `useEffect` to measure its container and chooses a layout strategy.

#### Layout Strategies

| Strategy | When | Columns | Description |
|---|---|---|---|
| `single` | 1 metric | 1 | Single large metric, vertically centered (`flex items-center justify-center`) |
| `columns` | 2+ metrics, wide-ish card | 2–12 | Horizontal columns in a single row (max 12) |
| `grid` | 3+ metrics, tall/narrow card | 2–4 | Multi-column grid wrapping to multiple rows |

#### Decision Logic (pseudo-code)

```
metrics = bound data sources with configured labels
count = metrics.length
aspectRatio = containerWidth / containerHeight

if count <= 1:
  layout = "single"
elif aspectRatio >= 1.2:
  layout = "columns"     // single row, N = count (max 12)
elif count >= 3 and aspectRatio < 1.2:
  layout = "grid"        // 2-col grid, wraps
```

#### Font Size by Metric Count

| Count | Value Size | Rationale |
|---|---|---|
| 1 | `text-4xl` | Maximize single value impact |
| 2 | `text-3xl` | Generous spacing for two values |
| 3 | `text-2xl` | Still comfortable in 2-col or 3-col |
| 4–6 | `text-xl` | Compact for multi-column |
| 7–12 | `text-sm`–`text-base` | Dense grid, labels may abbreviate |

#### Aspect Ratio Examples

```
2×2 (square)  → 1 metric: single, 2 metrics: columns
3×2 (wide)    → 1-3 metrics: columns
2×3 (tall)    → 1 metric: single, 2-12 metrics: grid (2-col)
4×3 (wide)    → up to 6 metrics: columns, 7+: grid (3-col)
6×2 (very wide) → up to 12 metrics: grid (6×2)
6×4 (max)     → up to 12 metrics: grid (4×3)
```

Grid dividers: vertical separators use `border-glass-border`, horizontal row separators use a subtle `bg-muted-30` line.

### States

**Empty state** (no data source bound):
- SVG inline icon (36×36 viewBox, stroke-only, `text-muted-foreground` stroke color):
  - Rounded rectangle outline with two horizontal lines inside, suggesting a data card
- Text: "Bind a data source" in `text-muted-foreground text-sm`
- Centered within the glass card (`flex flex-col items-center justify-center h-full`)

**Loading state** (data source bound, fetching):
- Placeholder value: `--` in `text-muted-foreground` with `font-bold`
- Label shows the configured metric name
- Subtitle: "Loading..." in `text-muted-foreground text-[10px]`

**Error state** (fetch failed):
- Value displays `--` in `text-muted-foreground`
- Label shows the configured metric name
- Global error handled with single retry prompt

**Per-cell handling**: Each metric cell renders independently. If the fetch result for a given source index is `null` or has no value, that specific cell shows `--` while other cells display their values normally.

## Data Source Binding

### Configuration

- `has_data_source: true`
- `max_data_sources: 12`

### Config Schema

```json
{
  "type": "object",
  "properties": {
    "metrics": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": { "type": "string", "default": "", "title": "Label" },
          "unit": { "type": "string", "default": "", "title": "Unit" },
          "decimalPlaces": { "type": "number", "default": 1, "title": "Decimal Places" }
        }
      },
      "maxItems": 12,
      "default": [],
      "title": "Metric Slots"
    }
  }
}
```

### Default Config

```json
{
  "metrics": []
}
```

When `metrics` array is shorter than the number of bound data sources, extra sources use default labels ("Value 1", "Value 2", ...) and no unit.

### Data Fetching

Uses the standard `fetchData()` prop with a single call. The dashboard returns an array when multiple data sources are configured:

```javascript
var result = await props.fetchData();

// Single source: result → { value: <number> } or null
// Multi source:  result → [{ value: <number> }, { value: <number> }, ...]
```

Normalize to array:

```javascript
var results = Array.isArray(result) ? result : (result ? [result] : []);
```

Each array index maps to the corresponding metric slot. If `results[i]` is `null` or has no `value`, that cell shows `--`.

### Data Refresh

- Fetch on mount
- Re-fetch when `dataSource` prop changes (via `useEffect` dependency)
- Auto-refresh every 30 seconds via `setInterval` (matching `data_list` pattern)
- Race condition protection via fetch ID counter

## Manifest

```json
{
  "id": "metric_card",
  "name": { "en": "Metric Card", "zh": "指标卡片" },
  "description": {
    "en": "A frosted-glass metric card with adaptive layout and multi-data-source support",
    "zh": "毛玻璃效果指标卡片，自适应布局，支持多数据源绑定"
  },
  "icon": "BarChart3",
  "category": "display",
  "version": "1.0.0",
  "author": "NeoMind Team",
  "size_constraints": {
    "min_w": 2, "min_h": 2,
    "default_w": 3, "default_h": 2,
    "max_w": 6, "max_h": 4
  },
  "has_data_source": true,
  "max_data_sources": 12,
  "has_device_binding": false,
  "has_display_config": true,
  "has_actions": false,
  "config_schema": {
    "type": "object",
    "properties": {
      "metrics": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "label": { "type": "string", "default": "", "title": "Label" },
            "unit": { "type": "string", "default": "", "title": "Unit" },
            "decimalPlaces": { "type": "number", "default": 1, "title": "Decimal Places" }
          }
        },
        "maxItems": 12,
        "default": [],
        "title": "Metric Slots"
      }
    }
  },
  "default_config": {
    "metrics": []
  },
  "global_name": "NeoMind_MetricCard",
  "export_name": "MetricCard"
}
```

## Technical Constraints

- Follows NeoMind IIFE bundle format: `var NeoMind_MetricCard = (function() { ... })()`
- Returns `{ default: Component, MetricCard: Component }`
- React via `window.React`, JSX runtime via `window.jsxRuntime`
- Uses OKLCH CSS variable tokens — no hardcoded Tailwind palette colors
- No `bg-*/opacity` slash syntax (not supported with CSS variables)
- All text in English by default
- No emoji or character icons — SVG inline for any iconography
