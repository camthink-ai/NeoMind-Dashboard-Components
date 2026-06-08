# Metric Card Component — Design Spec

## Overview

A frosted-glass metric card component for the NeoMind dashboard. Displays 1–5 numeric metrics with left-aligned hierarchy layout, adapting automatically to card size. Supports both light and dark themes via CSS variables.

## Visual Design

### Glass Effect

The card uses a frosted glass aesthetic that adapts to the active theme:

- **Background**: `bg-card` with inline `backdrop-filter: blur(20px)`
- **Border**: `border-glass-border`
- **Border radius**: `rounded-xl`
- **Shadow**: inline `box-shadow`
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
- Value and unit are baseline-aligned
- Numeric font: `font-mono tabular-nums` for column alignment

### Adaptive Grid

The layout adapts based on the number of data sources bound and the available card dimensions:

| Data Sources | Layout | Value Font Size |
|---|---|---|
| 1 | Single metric, centered vertically | `text-4xl`–`text-5xl` |
| 2 | 2-column grid | `text-2xl`–`text-3xl` |
| 3–4 | 2-column × N-row grid | `text-xl`–`text-2xl` |
| 5 | 3+2 or 5-column depending on width | `text-xl` |

Grid columns separated by `border-glass-border` dividers. Rows separated by subtle horizontal lines.

### States

**Empty state** (no data source bound):
- SVG line-art icon: a rounded rectangle with two horizontal lines inside, suggesting a data card
- Text: "Bind a data source" in `text-muted-foreground`
- Centered within the glass card

**Loading state** (data source bound, fetching):
- Placeholder value: `--` in `text-muted-foreground` with `font-bold`
- Label shows the configured metric name
- Subtitle: "Loading..." in `text-muted-foreground`

**Error state** (fetch failed):
- Value displays `--`
- Label shows the configured metric name

## Data Source Binding

### Configuration

- `has_data_source: true`
- `max_data_sources: 5`

### Config Schema

Each data source slot is configured with:

| Field | Type | Description |
|---|---|---|
| `label` | string | Display name for the metric (e.g. "Temperature") |
| `unit` | string | Unit suffix displayed beside the value (e.g. "°C", "%", "dBm") |
| `decimalPlaces` | number | Number of decimal places to show (default: 1) |

The config schema defines up to 5 metric slot configurations. Each slot maps to one data source binding.

### Data Fetching

Uses the standard `fetchData()` prop:

```javascript
var result = await props.fetchData({ dataSourceIndex: i });
// result → { value: <number> } or null
```

Each data source is fetched independently. If a source returns `null` or has no value, that cell shows `--`.

## Component Metadata

| Property | Value |
|---|---|
| Name | `metric_card` |
| Version | `1.0.0` |
| Min size | 2×2 |
| Default size | 3×2 |
| Max size | 6×4 |
| `has_data_source` | `true` |
| `max_data_sources` | `5` |
| `has_device_binding` | `false` |

## Technical Constraints

- Follows NeoMind IIFE bundle format (`var MetricCard = (function() { ... })()`)
- React via `window.React`, JSX runtime via `window.jsxRuntime`
- Uses OKLCH CSS variable tokens — no hardcoded Tailwind palette colors
- No `bg-*/opacity` slash syntax (not supported with CSS variables)
- All text in English by default
- No emoji or character icons — SVG inline for any iconography
