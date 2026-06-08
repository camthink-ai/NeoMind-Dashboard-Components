# Metric Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frosted-glass metric card component supporting 1–12 data sources with adaptive layout.

**Architecture:** Single IIFE bundle component following the NeoMind component pattern. Uses `fetchData()` prop for multi-source data, `useRef`+`useEffect` for container measurement and adaptive layout, CSS variable tokens for theme support.

**Tech Stack:** React (via `window.React`), JSX Runtime (via `window.jsxRuntime`), Tailwind CSS with OKLCH tokens, NeoMind component IIFE format.

**Spec:** `docs/superpowers/specs/2026-06-08-metric-card-design.md`

---

## File Structure

| Action | File | Purpose |
|---|---|---|
| Create | `components/metric_card/manifest.json` | Component metadata, config schema, size constraints |
| Create | `components/metric_card/bundle.js` | IIFE bundle with MetricCard React component |
| Modify | `index.json` | Register metric_card in component registry |

---

### Task 1: Create manifest.json

**Files:**
- Create: `components/metric_card/manifest.json`

- [ ] **Step 1: Create component directory**

```bash
mkdir -p components/metric_card
```

- [ ] **Step 2: Write manifest.json**

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
    "min_w": 2,
    "min_h": 2,
    "default_w": 3,
    "default_h": 2,
    "max_w": 6,
    "max_h": 4
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

- [ ] **Step 3: Commit**

```bash
git add components/metric_card/manifest.json
git commit -m "feat(metric_card): add manifest.json"
```

---

### Task 2: Create bundle.js — component skeleton with empty state

**Files:**
- Create: `components/metric_card/bundle.js`

This task creates the IIFE wrapper, props handling, and the empty state render. No data fetching yet.

- [ ] **Step 1: Write the IIFE wrapper and empty state component**

The component must:
1. Use `var React = window.React; var jsx = window.jsxRuntime.jsx; var jsxs = window.jsxRuntime.jsxs;`
2. Return `{ default: MetricCard, MetricCard: MetricCard }`
3. Extract `config`, `fetchData`, `dataSource`, `className`, `style` from props
4. When no `dataSource` is bound, render the empty state: SVG icon + "Bind a data source"
5. The glass card container uses `bg-card backdrop-blur-xl border border-glass-border rounded-xl` with inline box-shadow

```javascript
var NeoMind_MetricCard = (function () {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;
  var jsxs = window.jsxRuntime.jsxs;

  function EmptyState() {
    return jsxs('div', {
      className: 'flex flex-col items-center justify-center h-full w-full p-4',
      children: [
        jsx('svg', {
          width: '36',
          height: '36',
          viewBox: '0 0 36 36',
          fill: 'none',
          style: { marginBottom: '12px' },
          children: jsxs('g', {
            children: [
              jsx('rect', { x: '4', y: '8', width: '28', height: '20', rx: '4', stroke: 'currentColor', strokeWidth: '1.5', fill: 'none' }),
              jsx('line', { x1: '10', y1: '16', x2: '26', y2: '16', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', opacity: '0.4' }),
              jsx('line', { x1: '10', y1: '21', x2: '20', y2: '21', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', opacity: '0.4' })
            ]
          })
        }),
        jsx('span', { className: 'text-sm text-muted-foreground', children: 'Bind a data source' })
      ]
    });
  }

  function MetricCard(props) {
    var config = props.config || {};
    var fetchData = props.fetchData;
    var dataSource = props.dataSource;

    // No data source bound → empty state
    if (!fetchData || !dataSource) {
      return jsx('div', {
        className: 'flex flex-col h-full w-full p-3',
        children: jsx('div', {
          className: 'bg-card border border-glass-border rounded-xl flex-1',
          style: { backdropFilter: 'blur(20px)', boxShadow: '0 4px 30px oklch(0.18 0.02 270 / 10%)' },
          children: jsx(EmptyState, {})
        })
      });
    }

    // Loading / data state placeholder — will be completed in Task 3
    return jsx('div', {
      className: 'flex flex-col h-full w-full p-3',
      children: jsx('div', {
        className: 'bg-card border border-glass-border rounded-xl flex-1 flex items-center justify-center',
        style: { backdropFilter: 'blur(20px)', boxShadow: '0 4px 30px oklch(0.18 0.02 270 / 10%)' },
        children: jsx('span', { className: 'text-muted-foreground text-sm', children: 'Loading...' })
      })
    });
  }

  return { default: MetricCard, MetricCard: MetricCard };
})();
```

- [ ] **Step 2: Verify syntax**

```bash
node -c components/metric_card/bundle.js
```

Expected: no output (syntax OK)

- [ ] **Step 3: Commit**

```bash
git add components/metric_card/bundle.js
git commit -m "feat(metric_card): add IIFE skeleton with empty state"
```

---

### Task 3: Add data fetching and state management

**Files:**
- Modify: `components/metric_card/bundle.js`

Add React hooks for data fetching following the `data_list` pattern:
- `useState` for `values` (array of fetched results), `loading`, `error`
- `useRef` for `fetchDataRef`, `configRef`, `fetchIdRef`, `lastDsKeyRef`
- `doFetch()` function that calls `fetchData()`, normalizes result to array, handles race conditions
- `useEffect` for fetch-on-mount and re-fetch on `dataSource` change
- `useEffect` for 30s auto-refresh interval

The key fetch logic:

```javascript
function doFetch() {
  var fn = fetchDataRef.current;
  var cfg = configRef.current;
  var fid = ++fetchIdRef.current;
  if (!fn) { setLoading(false); return; }
  setLoading(true);
  setError(null);
  fn().then(function (result) {
    if (fid !== fetchIdRef.current) return; // race guard
    var results = Array.isArray(result) ? result : (result ? [result] : []);
    var vals = results.map(function (r) {
      return (r && r.value != null) ? r.value : null;
    });
    setValues(vals);
  }).catch(function () {
    if (fid !== fetchIdRef.current) return;
    setError('fetch');
  }).finally(function () {
    if (fid !== fetchIdRef.current) return;
    setLoading(false);
  });
}
```

Effects:

```javascript
// Fetch on mount and when dataSource changes
React.useEffect(function () {
  var triggerKey = getStableDsKey(dataSource);
  if (triggerKey === lastDsKeyRef.current) return;
  lastDsKeyRef.current = triggerKey;
  setValues([]);
  doFetch();
}, [dataSource]);

// Auto-refresh every 30s
React.useEffect(function () {
  var dsKey = getStableDsKey(dataSource);
  if (!dsKey) return;
  var iv = setInterval(function () {
    lastDsKeyRef.current = null;
    doFetch();
  }, 30000);
  return function () { clearInterval(iv); };
}, [dataSource]);
```

Helper (same as data_list):

```javascript
function getStableDsKey(ds) {
  if (!ds) return '';
  if (Array.isArray(ds)) return ds.map(function (d) {
    return [d.source || '', d.mode || d.type || '', d.id || d.sourceId || '', d.field || ''].join('|');
  }).join('||');
  return [ds.source || '', ds.mode || ds.type || '', ds.id || ds.sourceId || '', ds.field || ''].join('|');
}
```

- [ ] **Step 1: Add state variables after `var dataSource = props.dataSource;`**

```javascript
var dataSt = React.useState([]);
var values = dataSt[0], setValues = dataSt[1];
var loadSt = React.useState(true);
var loading = loadSt[0], setLoading = loadSt[1];
var errSt = React.useState(null);
var error = errSt[0], setError = errSt[1];

var fetchDataRef = React.useRef(fetchData);
fetchDataRef.current = fetchData;
var configRef = React.useRef(config);
configRef.current = config;
var fetchIdRef = React.useRef(0);
var lastDsKeyRef = React.useRef(null);
```

- [ ] **Step 2: Add doFetch, effects, and helper before the return statements**

Insert the `getStableDsKey` function inside the IIFE but outside the component. Insert `doFetch` and effects inside the component after the state declarations.

- [ ] **Step 3: Verify syntax**

```bash
node -c components/metric_card/bundle.js
```

- [ ] **Step 4: Commit**

```bash
git add components/metric_card/bundle.js
git commit -m "feat(metric_card): add data fetching with auto-refresh"
```

---

### Task 4: Add adaptive layout logic and metric cells

**Files:**
- Modify: `components/metric_card/bundle.js`

This is the core visual task. Add:

1. **Container measurement** — `useRef` + `useEffect` with `ResizeObserver` to track container width/height
2. **Layout decision function** — determines `single` / `columns` / `grid` and column count
3. **Font size function** — returns Tailwind class based on metric count
4. **MetricCell component** — renders one metric (label, value, unit) with left-aligned hierarchy
5. **Main render** — glass card wrapping the grid of MetricCells

#### Container measurement

```javascript
var sizeSt = React.useState({ w: 0, h: 0 });
var containerSize = sizeSt[0], setContainerSize = sizeSt[1];
var containerRef = React.useRef(null);

React.useEffect(function () {
  var el = containerRef.current;
  if (!el) return;
  var ro = new ResizeObserver(function (entries) {
    var rect = entries[0].contentRect;
    setContainerSize({ w: rect.width, h: rect.height });
  });
  ro.observe(el);
  return function () { ro.disconnect(); };
}, []);
```

#### Layout decision

```javascript
function getLayout(count, aspectRatio) {
  if (count <= 1) return { type: 'single', cols: 1 };
  if (aspectRatio >= 1.2) return { type: 'columns', cols: count };
  // tall/narrow → grid
  var cols;
  if (count <= 2) cols = 2;
  else if (count <= 6) cols = 2;
  else cols = 4;
  return { type: 'grid', cols: cols };
}
```

#### Font size

```javascript
function getValueClass(count) {
  if (count <= 1) return 'text-4xl';
  if (count === 2) return 'text-3xl';
  if (count === 3) return 'text-2xl';
  if (count <= 6) return 'text-xl';
  return 'text-base';
}
```

#### MetricCell component

```javascript
function MetricCell(props) {
  var label = props.label;
  var value = props.value;
  var unit = props.unit;
  var valueClass = props.valueClass;
  var showBorderLeft = props.showBorderLeft;
  var showBorderBottom = props.showBorderBottom;
  var loading = props.loading;

  var displayValue = loading ? '--' : (value != null ? String(value) : '--');
  var valueColor = (loading || value == null) ? 'text-muted-foreground' : 'text-foreground';

  return jsxs('div', {
    className: 'p-2' +
      (showBorderLeft ? ' border-l border-glass-border' : '') +
      (showBorderBottom ? ' border-b border-glass-border' : ''),
    style: { borderColor: showBorderLeft || showBorderBottom ? undefined : 'transparent' },
    children: [
      jsx('div', { className: 'text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1', children: label }),
      jsxs('div', { className: 'flex items-baseline gap-1',
        children: [
          jsx('span', { className: 'font-bold font-mono tabular-nums ' + valueClass + ' ' + valueColor, children: displayValue }),
          unit ? jsx('span', { className: 'text-xs text-muted-foreground', children: unit }) : null
        ]
      })
    ]
  });
}
```

#### Main render logic

After the data-fetching section, replace the placeholder return with:

```javascript
var metrics = config.metrics || [];
var dsList = Array.isArray(dataSource) ? dataSource : (dataSource ? [dataSource] : []);
var count = dsList.length || metrics.length;

// Build merged metric info: config label/unit → fallback to dataSource labels
var slots = [];
for (var i = 0; i < count; i++) {
  var cfg = metrics[i] || {};
  slots.push({
    label: cfg.label || ('Value ' + (i + 1)),
    unit: cfg.unit || '',
    decimalPlaces: cfg.decimalPlaces != null ? cfg.decimalPlaces : 1,
    value: values[i] != null ? (function () {
      var v = values[i];
      var dp = cfg.decimalPlaces != null ? cfg.decimalPlaces : 1;
      return typeof v === 'number' ? v.toFixed(dp) : v;
    })() : null
  });
}

if (count === 0) {
  return jsx('div', { /* ...same empty state wrapper... */ });
}

var aspectRatio = containerSize.w && containerSize.h ? containerSize.w / containerSize.h : 2;
var layout = getLayout(count, aspectRatio);
var valueClass = getValueClass(count);
```

Then the JSX render — a glass card container with a CSS grid inside:

- `single`: single MetricCell centered with `flex items-center justify-center`
- `columns`: `grid-template-columns: repeat(count, 1fr)` in a single row
- `grid`: `grid-template-columns: repeat(cols, 1fr)` with wrapping

Each cell gets `showBorderLeft = (i % cols > 0)` and `showBorderBottom = (i < count - cols)`.

The outer container:

```javascript
return jsx('div', {
  ref: containerRef,
  className: 'flex flex-col h-full w-full p-3',
  children: jsx('div', {
    className: 'bg-card border border-glass-border rounded-xl flex-1 overflow-hidden',
    style: { backdropFilter: 'blur(20px)', boxShadow: '0 4px 30px oklch(0.18 0.02 270 / 10%)' },
    children: layout.type === 'single'
      ? jsx('div', { className: 'flex items-center justify-center h-full', children: renderCell(0) })
      : jsx('div', {
          style: { display: 'grid', gridTemplateColumns: 'repeat(' + layout.cols + ', 1fr)' },
          className: 'h-full',
          children: slots.map(function (_, i) { return renderCell(i); })
        })
  })
});
```

Where `renderCell(i)` creates a `MetricCell` with the appropriate borders and props. Define `renderCell` as an inner function inside the component:

```javascript
function renderCell(i) {
  var slot = slots[i];
  var isFirstInRow = (i % layout.cols === 0);
  var isLastRow = (i >= count - (count % layout.cols || layout.cols));
  return jsx(MetricCell, {
    key: 'metric-' + i,
    label: slot.label,
    value: slot.value,
    unit: slot.unit,
    valueClass: valueClass,
    showBorderLeft: !isFirstInRow,
    showBorderBottom: !isLastRow,
    loading: loading && !hasDataRef.current
  });
}
```

The `key` prop is set inside `renderCell` to satisfy React's list rendering requirements.

- [ ] **Step 1: Add container measurement, layout functions, and MetricCell inside the IIFE**

Place `getLayout`, `getValueClass`, and `MetricCell` outside the component function but inside the IIFE. Place measurement hooks and render logic inside the component.

- [ ] **Step 2: Verify syntax**

```bash
node -c components/metric_card/bundle.js
```

- [ ] **Step 3: Commit**

```bash
git add components/metric_card/bundle.js
git commit -m "feat(metric_card): add adaptive layout and metric cell rendering"
```

---

### Task 5: Handle loading and error states in cells

**Files:**
- Modify: `components/metric_card/bundle.js`

Enhance per-cell state handling:

1. During initial load (before any data arrives), show all cells with `--` and label "Loading..."
2. After first fetch, each cell shows its value or `--` independently
3. On fetch error, show a subtle retry indicator

The `MetricCell` already handles `loading` and null values via the `displayValue` logic. The main change is:
- Track whether we've ever received data: `var hasDataRef = React.useRef(false);`
- Set it to `true` after first successful fetch
- Pass `loading && !hasDataRef.current` to MetricCell as the `loading` prop

For error state, add a small retry text at the bottom of the glass card when `error === 'fetch'`:

```javascript
error ? jsx('div', {
  className: 'text-xs text-muted-foreground text-center py-1 cursor-pointer',
  onClick: function () { lastDsKeyRef.current = null; doFetch(); },
  children: 'Retry'
}) : null
```

- [ ] **Step 1: Add hasDataRef and error UI**

- [ ] **Step 2: Verify syntax**

```bash
node -c components/metric_card/bundle.js
```

- [ ] **Step 3: Commit**

```bash
git add components/metric_card/bundle.js
git commit -m "feat(metric_card): add loading/error states and retry"
```

---

### Task 6: Register in index.json

**Files:**
- Modify: `index.json`

- [ ] **Step 1: Add metric_card entry to the `components` array**

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
  "size_constraints": { "min_w": 2, "min_h": 2, "default_w": 3, "default_h": 2, "max_w": 6, "max_h": 4 },
  "has_data_source": true,
  "max_data_sources": 12,
  "has_display_config": true,
  "has_actions": false,
  "manifest_url": "https://raw.githubusercontent.com/camthink-ai/NeoMind-Dashboard-Components/main/components/metric_card/manifest.json",
  "bundle_url": "https://raw.githubusercontent.com/camthink-ai/NeoMind-Dashboard-Components/main/components/metric_card/bundle.js"
}
```

- [ ] **Step 2: Validate JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('index.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add index.json
git commit -m "feat(metric_card): register in index.json"
```

---

### Task 7: Final review and syntax validation

**Files:**
- Review: `components/metric_card/manifest.json`
- Review: `components/metric_card/bundle.js`
- Review: `index.json`

- [ ] **Step 1: Verify all files parse correctly**

```bash
node -c components/metric_card/bundle.js && node -e "JSON.parse(require('fs').readFileSync('components/metric_card/manifest.json','utf8')); console.log('manifest OK')" && node -e "JSON.parse(require('fs').readFileSync('index.json','utf8')); console.log('index OK')"
```

- [ ] **Step 2: Verify manifest matches index.json entry**

Check that `id`, `version`, `size_constraints`, `max_data_sources` match between manifest.json and index.json.

- [ ] **Step 3: Verify bundle returns correct global name**

```bash
node -e "eval(require('fs').readFileSync('components/metric_card/bundle.js','utf8')); console.log(typeof NeoMind_MetricCard, Object.keys(NeoMind_MetricCard))"
```

Expected: `object default,MetricCard`

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix(metric_card): final adjustments"
```
