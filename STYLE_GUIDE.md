# NeoMind Dashboard Components — Style Guide

Community component visual standards. Follow these rules to ensure your component looks native in NeoMind dashboards.

> Synced from the main project's `web/DESIGN_SPEC.md`. When the main spec changes, update this file accordingly.

---

## 1. Color System

### Design Tokens

NeoMind uses OKLCH CSS variables mapped to Tailwind classes. **NEVER use hardcoded Tailwind palette colors**.

| Good | Bad |
|------|-----|
| `text-success` | `text-green-600` |
| `bg-error-light` | `bg-red-100` |
| `text-accent-orange` | `text-orange-500` |
| `bg-muted` | `bg-gray-100` |

### Semantic Colors

| Purpose | Text | Background | Light BG |
|---------|------|-----------|----------|
| Success | `text-success` | `bg-success` | `bg-success-light` |
| Warning | `text-warning` | `bg-warning` | `bg-warning-light` |
| Error | `text-error` | `bg-error` | `bg-error-light` |
| Info | `text-info` | `bg-info` | `bg-info-light` |

### Accent Colors

| Category | Text | Light BG |
|----------|------|----------|
| Purple | `text-accent-purple` | `bg-accent-purple-light` |
| Orange | `text-accent-orange` | `bg-accent-orange-light` |
| Cyan | `text-accent-cyan` | `bg-accent-cyan-light` |
| Emerald | `text-accent-emerald` | `bg-accent-emerald-light` |

### Chart Colors

Use `--chart-1` through `--chart-6` for chart series.

### Text on Colored Backgrounds

Always use `text-primary-foreground` for text/icons on colored backgrounds:

```javascript
jsx('span', { className: 'bg-success text-primary-foreground px-2 py-0.5 rounded-full', children: 'Active' })
```

### Opacity Limitation

CSS variable-based colors do NOT support Tailwind `/` opacity modifier. These **silently fail**:

```javascript
// BROKEN - no opacity applied
className: 'bg-primary/10'
className: 'bg-muted-foreground/20'
```

**Workarounds:**
- Pre-defined tokens: `bg-muted-20`, `bg-muted-30`, `bg-muted-50`
- Pre-defined light variants: `bg-success-light`, `bg-error-light`
- Inline styles: `style: { backgroundColor: 'oklch(0.18 0.02 270 / 10%)' }`

---

## 2. Typography

### Font Classes

| Class | Usage |
|-------|-------|
| `font-sans` (default) | All UI text |
| `font-mono` | Device IDs, code, numbers |
| `tabular-nums` | Numeric displays that must align |

### Size Scale

| Class | Size | Use Case |
|-------|------|----------|
| `text-[10px]` | 10px | Tiny metadata, timestamps |
| `text-xs` | 12px | Small labels, helper text |
| `text-sm` | 14px | Body text, descriptions |
| `text-base` | 16px | Standard content |
| `text-lg` | 18px | Component headings |
| `text-xl` — `text-3xl` | 20–30px | Large value displays |

### Font Weights

| Class | Use Case |
|-------|----------|
| `font-normal` | Body text |
| `font-medium` | Labels, emphasis |
| `font-semibold` | Section titles |
| `font-bold` | Key values, hero numbers |

---

## 3. Layout & Spacing

### Spacing

Use Tailwind standard spacing: `p-1` (4px), `p-2` (8px), `p-3` (12px), `p-4` (16px), `gap-2`, `gap-3`, etc.

### Border Radius

| Token | Class |
|-------|-------|
| sm | `rounded-sm` |
| md | `rounded-md` |
| lg | `rounded-lg` |
| xl | `rounded-xl` |
| full | `rounded-full` |

### Component Container

Your component receives `className="w-full h-full"` from the dashboard. Always fill your container:

```javascript
jsx('div', { className: 'flex flex-col h-full w-full p-3', children: [...] })
```

---

## 4. Surfaces & Glass

| Surface | Class | Use Case |
|---------|-------|----------|
| Card | `bg-card` | Content containers |
| Muted | `bg-muted` | Subtle backgrounds |
| Muted 30% | `bg-muted-30` | Very subtle fill |
| Border | `border` + `border-border` | Default borders |
| Glass border | `border-glass-border` | Subtle glass borders |

---

## 5. Status Colors

For device status and online/offline indicators:

| Status | Text | Background |
|--------|------|-----------|
| Online / Active | `text-success` | `bg-success-light` |
| Offline / Inactive | `text-muted-foreground` | `bg-muted` |
| Warning | `text-warning` | `bg-warning-light` |
| Error | `text-error` | `bg-error-light` |

### Status Dot Pattern

```javascript
jsx('div', {
  className: 'h-2 w-2 rounded-full ' + (online ? 'bg-success' : 'bg-muted-foreground'),
  style: online ? { boxShadow: '0 0 6px oklch(0.72 0.19 155)' } : {}
})
```

---

## 6. Animation

| Class | Use Case |
|-------|----------|
| `animate-pulse-slow` | Status indicators (3s) |
| `animate-spin` | Loading spinners |
| `transition-colors` | Color transitions |
| `transition-opacity` | Fade transitions |

Timing variables (use in inline styles):
- `--duration-fast`: 150ms (hover)
- `--duration-normal`: 200ms (general)
- `--duration-slow`: 300ms (layout)

---

## 7. Component Patterns

### Value Display (large number)

```javascript
jsxs('div', { className: 'flex flex-col items-center justify-center h-full', children: [
  jsx('span', { className: 'text-3xl font-bold text-foreground font-mono tabular-nums', children: value }),
  jsx('span', { className: 'text-xs text-muted-foreground mt-1', children: label })
]})
```

### Status Badge

```javascript
jsx('span', {
  className: 'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ' +
    (online ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'),
  children: online ? 'Online' : 'Offline'
})
```

### Progress Bar

```javascript
jsxs('div', { className: 'w-full', children: [
  jsxs('div', { className: 'flex justify-between text-xs mb-1', children: [
    jsx('span', { className: 'text-muted-foreground', children: 'Battery' }),
    jsx('span', { className: 'font-mono tabular-nums', children: level + '%' })
  ]}),
  jsx('div', { className: 'h-1.5 bg-muted-30 rounded-full overflow-hidden', children:
    jsx('div', {
      className: 'h-full rounded-full transition-all ' + colorClass,
      style: { width: level + '%' }
    })
  })
]})
```

### Empty / No Device State

When `deviceContext` is not available (device not bound), show a placeholder:

```javascript
jsx('div', { className: 'flex flex-col items-center justify-center h-full text-muted-foreground p-4', children: [
  jsx('div', { className: 'text-sm', children: 'No device bound' })
]})
```

---

## 8. Dark Mode

All design tokens automatically adapt to dark mode. Do NOT write dark-mode-specific styles. The CSS variables handle it:

- `text-foreground` → adapts to dark/light
- `bg-card` → adapts to dark/light
- `text-muted-foreground` → adapts to dark/light
- All semantic tokens (`text-success`, etc.) → adapt automatically

---

## 9. Do's and Don'ts

| Do | Don't |
|----|-------|
| Use `text-foreground` / `bg-card` | Use `text-black` / `bg-white` (except overlays) |
| Use `text-muted-foreground` for secondary text | Use `text-gray-500` |
| Use `bg-success-light` for subtle green | Use `bg-green-100` |
| Use `font-mono tabular-nums` for numbers | Use `font-mono` alone (missing tabular) |
| Use `bg-muted-30` for subtle backgrounds | Use `bg-muted/30` (broken opacity) |
| Use inline `style` for dynamic values | Use Tailwind for computed colors |
| Use `text-primary-foreground` on colored BGs | Use `text-white` on colored BGs |

---

## 10. Device Binding Props

Components with `has_device_binding: true` receive these additional props:

```javascript
{
  // Standard props
  config: { ... },           // From config_schema + user overrides
  title: "...",
  className: "...",
  style: {},

  // Device binding props (when device is bound)
  deviceContext: {
    device: {
      id: "ne101_abc123",
      name: "Front Door Camera",
      deviceType: "ne101_camera",
      status: "online",          // "online" | "offline"
      lastSeen: "2026-05-11T06:00:00Z",
      currentValues: {           // Latest telemetry values
        "ts": 1740640441620,
        "values.battery": 84,
        "values.devName": "NE101"
      }
    },
    deviceType: {                // Device type schema (if available)
      name: "CamThink Sensing Camera",
      deviceType: "ne101_camera",
      metrics: [
        { name: "ts", display_name: "Timestamp", data_type: "Integer" },
        { name: "values.battery", display_name: "Battery Level", data_type: "Integer", unit: "%" }
      ],
      commands: []               // Available commands
    }
  },
  sendDeviceCommand: async (command, params?) => boolean
}
```

### Accessing Device Values

```javascript
function MyComponent(props) {
  var device = props.deviceContext && props.deviceContext.device;
  var deviceType = props.deviceContext && props.deviceContext.deviceType;

  if (!device) {
    return jsx('div', { className: '...', children: 'No device bound' });
  }

  var values = device.currentValues || {};
  var battery = values['values.battery'] != null ? values['values.battery'] : (values['battery'] != null ? values['battery'] : '--');

  // ...
}
```

---

## 11. fetchData Prop

All community and extension components receive a `fetchData` prop for unified data access. Use it to fetch data from configured DataSource bindings without managing React hooks.

```javascript
// Basic usage
var result = await props.fetchData();
// result → { value: <any> } or { series: [<points>] } or null

// With options
var result = await props.fetchData({ timeRange: 24, limit: 200 });
```

| Mode | Returns | Description |
|------|---------|-------------|
| latest | `{ value: <any> }` | Single current value |
| timeseries | `{ series: [{ timestamp, value }] }` | Historical time-series data |
| info | `{ value: <string> }` | Device metadata |
| command | `{ value: undefined }` | No fetch available |

> Returns `null` if no dataSource is configured in the component.

---

## 12. React Key Rules

When rendering arrays of children with `jsxs()`, every element **must** have a `key` prop:

```javascript
// CORRECT
jsxs('div', { children: [
  jsx('span', { key: 'label', children: 'Status' }),
  jsx('span', { key: 'value', children: 'Online' })
]})

// WRONG — React will warn "Each child in a list should have a unique key prop"
jsxs('div', { children: [
  jsx('span', { children: 'Status' }),
  jsx('span', { children: 'Online' })
]})
```

### Rules

1. Use `jsxs` (not `jsx`) when children is an array of 2+ elements
2. Every element in a `jsxs` children array needs a unique `key`
3. For `.map()` results, use a unique property as key: `key: item.id`
4. Single-child renders can use `jsx` without keys
