# 3D Viewer Component Design Spec

## Overview

A NeoMind Dashboard component that renders 3D model files (GLTF/GLB primary, extensible to OBJ/STL/FBX) with interactive marker pins. Pins anchor to the model surface in 3D space and display associated data — metrics, device status, annotations, or commands — via minimal HTML floating panels.

### Goals

- Render 3D models in the NeoMind Dashboard grid with rotate/zoom/pan
- Allow users to place marker pins on the model surface by clicking
- Bind pins to platform data sources (metrics, devices, commands) or freeform annotations
- Persist pin configuration across sessions via component config

### Non-Goals

- Model authoring or editing
- AR/VR integration
- Animation playback controls
- Multi-model scenes

## Architecture

### Approach: Hybrid 3D Anchors + HTML Floating Panels

Pins exist as Three.js mesh objects in 3D space (correct occlusion, spatial positioning) while detail content renders as HTML DOM elements positioned via screen-space projection (flexible React rendering, full CSS styling).

### Component Tree

```
NeoMind3DViewer (root)
├── Scene3D                     — Three.js scene management
│   ├── ModelRenderer           — GLTF/OBJ loader
│   ├── OrbitControls           — rotate/zoom/pan
│   ├── Raycaster               — click-to-place ray picking
│   └── Pin3D[]                 — anchor meshes (small spheres/icons)
│
├── PinOverlayManager           — HTML panel coordinator
│   └── PinPopup[]              — one panel per anchor
│       ├── MetricPopup         — live metric value
│       ├── DevicePopup         — device status
│       ├── AnnotationPopup     — text note
│       └── CommandPopup        — execute button
│
├── Toolbar                     — mode & type selectors
│
└── ConfigPanel (optional)      — model URL, pin import/export, display settings
```

### Data Flow

```
User clicks model surface
  → Raycaster: hit point (x,y,z) + face normal
  → Create Pin3D mesh at hit point
  → PinOverlayManager: project 3D coords to screen coords
  → Render PinPopup HTML at screen position
  → Bind data source per pin type:
      metric  → deviceType + metricKey via WebSocket
      device  → deviceType + deviceId via deviceContext
      command → deviceType + commandKey via sendDeviceCommand
      annotation → static text in config

Render loop (each frame):
  For each pin:
    screenPos = pin.position.project(camera)
    Update PinPopup DOM left/top
    Hide if screenPos.z > 1 (behind camera)
    Optionally hide if occluded by model geometry
```

## Pin Data Model

```typescript
interface Pin {
  id: string
  position: { x: number; y: number; z: number }
  normal: { x: number; y: number; z: number }
  type: 'metric' | 'device' | 'annotation' | 'command'
  label: string

  // Data bindings per type
  metricRef?: {
    deviceType: string
    metricKey: string
  }
  deviceRef?: {
    deviceType: string
    deviceId?: string
  }
  annotationText?: string
  annotationColor?: string
  commandRef?: {
    deviceType: string
    commandKey: string
    params?: Record<string, any>
  }
}
```

## Pin Types

| Type | Color | Anchor Icon | Panel Content |
|------|-------|-------------|---------------|
| Metric | Green `#34d399` | Line chart SVG | Large value + unit, label |
| Device | Blue `#60a5fa` | Monitor SVG | Device name, status dot, key metric |
| Annotation | Yellow `#fbbf24` | Note SVG | Title + short text |
| Command | Pink `#f472b6` | Chevron SVG | Title + execute button |

All icons are inline SVG — no emoji or character icons.

## Interaction Design

### Two Modes

**View Mode (default):**
- Drag → rotate (OrbitControls)
- Scroll → zoom
- Right-drag → pan
- Click pin anchor → expand detail card
- Long-press pin → drag to reposition

**Edit Mode (enter via toolbar):**
1. Select pin type from toolbar
2. Cursor becomes crosshair
3. Click model surface → Raycaster picks hit point → place pin
4. Configuration popover appears → bind data source
5. Exit edit → save pins to component config, return to view mode

### Detail Cards (4:3 Minimal)

Each card follows the same layout:
- Aspect ratio 4:3
- Dark background `#111827` with subtle border
- Top: label (small, muted) + type indicator dot (top-right)
- Bottom: core content only (one large value / status line / text / button)
- No charts, no lists, no dense data

### Toolbar

Inline SVG icons, no emoji. Horizontal bar at bottom of the component:
- View mode: reset camera, fullscreen
- Edit mode: pin type selectors (metric/device/annotation/command), delete tool

## Component Configuration

### manifest.json

```json
{
  "name": "3D Viewer",
  "version": "1.0.0",
  "category": "visualization",
  "has_device_binding": false,
  "config": {
    "modelUrl": {
      "type": "string",
      "title": "Model File URL",
      "default": ""
    },
    "pins": {
      "type": "array",
      "title": "Marker Pins",
      "default": []
    },
    "autoRotate": {
      "type": "boolean",
      "title": "Auto Rotate",
      "default": false
    },
    "backgroundColor": {
      "type": "string",
      "title": "Scene Background",
      "default": "#0f172a"
    }
  }
}
```

`has_device_binding` is false — the component is not bound to a single device type. Each pin independently references its data source via `metricRef`/`deviceRef`/`commandRef`.

### Persistence

Pins are stored in the `pins` config array. On component unmount, current pins are saved. On mount, pins are restored and re-attached to the loaded model.

## Technical Details

### Three.js Bundle Strategy

IIFE bundle includes only required Three.js modules:
- Core: Scene, PerspectiveCamera, WebGLRenderer, Mesh, SphereGeometry, MeshBasicMaterial, Raycaster, Vector3
- Loaders: GLTFLoader
- Controls: OrbitControls

Not included: Animation, Audio, VR, Post-processing, CSS2DRenderer (we manage DOM positioning manually).

Estimated bundle size: 200-300KB minified (~70KB gzipped).

### Raycasting

```
click event → NDC coords from mouse position
→ Raycaster.setFromCamera(ndc, camera)
→ intersectObjects(model.children, recursive=true)
→ First hit: { point, face.normal }
→ Pin placed at point, orientation aligned to face.normal
```

### Screen-Space Projection

Per-frame update for each pin:
```
screenPos = pin.position.clone().project(camera)
// screenPos.x ∈ [-1, 1], screenPos.y ∈ [-1, 1]
cssLeft = (screenPos.x + 1) / 2 * containerWidth
cssTop  = (-screenPos.y + 1) / 2 * containerHeight
visibility:
  - screenPos.z > 1 → behind camera, hide
  - optional: raycaster occlusion check from camera to pin
```

### Model Loading

- Source: URL string or File (drag-drop / file picker)
- Parser: `GLTFLoader.load(url)` or `GLTFLoader.parse(arrayBuffer)`
- On load: compute BoundingBox → auto-position camera to fit model centered
- Loading state: progress bar with rotation animation
- Error state: message + retry button

### Data Updates

```
window.neomind.onMetricUpdate(callback)
  → iterate all type=metric pins
  → match deviceType + metricKey
  → update PinPopup display value
```

## Error Handling

| Scenario | Response |
|----------|----------|
| Model load failure | Dark placeholder + error message + retry |
| Unsupported format | Message listing supported formats |
| Corrupted pin data | Skip invalid pins, log warning |
| Device offline | Status dot turns gray, shows "offline" |
| Command failure | Button turns red briefly, auto-recovers |
| Upload > 50MB | Reject with size limit message |

## Responsive Sizing

The component adapts to its grid cell size:
- Small (2x2): hide detail panels, show only anchor dots, tooltip on hover
- Medium (3x3+): show floating summary panels normally
- Fullscreen: full toolbar + detail cards

## Performance

- `requestAnimationFrame` render loop, only re-render on change
- 50+ pins: only render panels for pins in viewport
- 1M+ face models: prompt user to simplify, or use low-detail fallback
