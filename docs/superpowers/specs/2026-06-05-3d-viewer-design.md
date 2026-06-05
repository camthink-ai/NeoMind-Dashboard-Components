# 3D Viewer Component Design Spec

## Overview

A NeoMind Dashboard component that renders 3D model files (GLTF/GLB) with interactive marker pins. Pins anchor to the model surface in 3D space and display associated data — metrics, device status, annotations, or commands — via minimal HTML floating panels.

OBJ/STL/FBX support is a potential future extension. The initial implementation targets GLTF/GLB only, with a loader architecture that makes adding formats straightforward.

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
│   ├── ModelRenderer           — GLTF loader
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
      metric  → fetchData() for latest value
      device  → window.neomind.fetchDeviceValues(deviceId)
      command → window.neomind.callExtension() or platform command API
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

The `normal` field is used for two purposes:
1. **Pin orientation** — the anchor mesh (small sphere) is offset slightly along the normal vector so it sits "above" the model surface rather than clipping into it
2. **Occlusion hint** — when doing raycaster occlusion checks, the normal helps define the ray origin point (pin position + normal * epsilon) to avoid self-intersection

## Pin Types

| Type | Color Token | Anchor Icon | Panel Content |
|------|-------------|-------------|---------------|
| Metric | `text-success` / `bg-success` | Line chart SVG | Large value + unit, label |
| Device | `text-info` / `bg-info` | Monitor SVG | Device name, status dot, key metric |
| Annotation | `text-warning` / `bg-warning` | Note SVG | Title + short text |
| Command | `text-accent-purple` / `bg-accent-purple-light` | Chevron SVG | Title + execute button |

All colors use NeoMind design tokens (CSS variables), not hardcoded hex values. All icons are inline SVG — no emoji or character icons.

## Interaction Design

### Two Modes

**View Mode (default):**
- Drag → rotate (OrbitControls)
- Scroll → zoom
- Right-drag → pan
- Click pin anchor → expand detail card
- Long-press pin → reposition (OrbitControls disabled during drag, re-enabled on release)

**Edit Mode (enter via toolbar):**
1. Select pin type from toolbar
2. Cursor becomes crosshair
3. Click model surface → Raycaster picks hit point → place pin
4. Configuration popover appears → bind data source
5. Exit edit → save pins to component config, return to view mode

### Long-press Repositioning

To avoid conflict with OrbitControls drag-to-rotate:
- On pointerdown on a pin: start a 300ms timer
- If pointer moves > 5px before timer fires → treat as scene drag (OrbitControls handles it)
- If timer fires without movement → enter pin drag mode: disable OrbitControls, pin follows pointer via raycasting onto model surface
- On pointerup: re-enable OrbitControls, save new pin position

### Detail Cards (4:3 Minimal)

Each card follows the same layout:
- Aspect ratio 4:3
- Background: `bg-muted-30` with `border border-muted`
- Top: label (small, `text-muted-foreground`) + type indicator dot (top-right, using semantic color token)
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
  "id": "model_3d_viewer",
  "name": { "en": "3D Viewer", "zh": "3D 查看器" },
  "description": {
    "en": "Interactive 3D model viewer with marker pins for metrics, devices, annotations, and commands",
    "zh": "交互式 3D 模型查看器，支持指标、设备、注释和指令标记点"
  },
  "icon": "Box",
  "category": "visualization",
  "version": "1.0.0",
  "author": "NeoMind Team",
  "size_constraints": {
    "min_w": 2, "min_h": 2,
    "default_w": 3, "default_h": 3,
    "max_w": 6, "max_h": 6
  },
  "has_data_source": false,
  "has_device_binding": false,
  "has_display_config": true,
  "has_actions": false,
  "config_schema": {
    "type": "object",
    "properties": {
      "modelUrl": {
        "type": "string",
        "default": "",
        "title": "Model File URL"
      },
      "pins": {
        "type": "array",
        "default": [],
        "title": "Marker Pins"
      },
      "autoRotate": {
        "type": "boolean",
        "default": false,
        "title": "Auto Rotate"
      },
      "backgroundColor": {
        "type": "string",
        "default": "var(--color-muted)",
        "title": "Scene Background"
      }
    }
  },
  "default_config": {
    "modelUrl": "",
    "pins": [],
    "autoRotate": false,
    "backgroundColor": "var(--color-muted)"
  },
  "global_name": "Model3DViewer",
  "export_name": "Model3DViewer"
}
```

`has_device_binding` is false — the component is not bound to a single device type. Each pin independently references its data source via `metricRef`/`deviceRef`/`commandRef`.

### Data Access Strategy

Since the component is not device-bound, it does not receive `deviceContext` or `sendDeviceCommand` props. Data access uses:

**Reading metric/device values:**
- `window.neomind.fetchDeviceValues(deviceId)` — one-time fetch for device data
- For live updates: periodic re-fetch with a timestamp-based change detection pattern (same as the NE101 camera component's WS+REST hybrid pattern). The component monitors `device.currentValues` timestamps via platform WebSocket to trigger targeted fetches only when data changes.

**Executing commands:**
- `window.neomind.callExtension(extensionId, command, args)` — for extension-based commands
- For direct device commands without a device binding: the pin's `commandRef` stores the target device ID, and the component uses the platform's command API

### Persistence

Pins are stored in the `pins` config array. On component unmount, current pins are saved. On mount, pins are restored and re-attached to the loaded model.

**Model replacement:** When `modelUrl` changes, all existing pins are cleared. Pin coordinates are model-specific and cannot be reused across different models. A confirmation prompt appears before clearing pins if any exist.

## Technical Details

### Three.js Bundle Strategy

IIFE bundle includes only required Three.js modules:
- Core: Scene, PerspectiveCamera, WebGLRenderer, Mesh, SphereGeometry, MeshBasicMaterial, Raycaster, Vector3, Box3, Color
- Loaders: GLTFLoader
- Controls: OrbitControls

Not included: Animation, Audio, VR, Post-processing, CSS2DRenderer (we manage DOM positioning manually).

Additional format loaders (OBJLoader, STLLoader, FBXLoader) can be added as separate lazy-loaded chunks in future iterations.

Estimated bundle size: 200-300KB minified (~70KB gzipped).

### Raycasting

```
click event → NDC coords from mouse position
→ Raycaster.setFromCamera(ndc, camera)
→ intersectObjects(model.children, recursive=true)
→ First hit: { point, face.normal }
→ Pin placed at point + normal * 0.01 (slight offset above surface)
→ Normal stored for orientation and occlusion checks
```

### Screen-Space Projection

Per-frame update for each pin. PinPopups are absolutely positioned within the component's root container (which is positioned relative). The container fills the dashboard grid cell.

```
screenPos = pin.position.clone().project(camera)
// screenPos.x ∈ [-1, 1], screenPos.y ∈ [-1, 1]
cssLeft = (screenPos.x + 1) / 2 * container.offsetWidth
cssTop  = (-screenPos.y + 1) / 2 * container.offsetHeight
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

### Lifecycle & Cleanup

The component must properly clean up Three.js resources on unmount:
- Cancel `requestAnimationFrame` loop (store frame ID, call `cancelAnimationFrame`)
- Call `renderer.dispose()` to release WebGL context
- Dispose all geometries and materials in the scene
- Remove all event listeners (resize, pointer, keyboard)
- Remove the renderer's DOM element from the container

```javascript
React.useEffect(function () {
  // ... setup scene, start render loop ...

  return function cleanup() {
    cancelAnimationFrame(frameId);
    renderer.dispose();
    scene.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(function (m) { m.dispose(); });
        else obj.material.dispose();
      }
    });
    container.removeChild(renderer.domElement);
  };
}, []);
```

## Error Handling

| Scenario | Response |
|----------|----------|
| Model load failure | Dark placeholder + error message + retry |
| Unsupported format | Message: "Supported formats: GLTF, GLB" |
| Corrupted pin data | Skip invalid pins, log warning |
| Device offline | Status dot uses `text-muted-foreground`, shows "offline" |
| Command failure | Button shows error state briefly (using `bg-error`), auto-recovers after 3s |
| Upload > 50MB | Reject with size limit message |

## Responsive Sizing

The component receives `width` and `height` props (grid units 1-6) and adapts:
- Small (2x2): hide detail panels, show only anchor dots. On hover over anchor, raycasting on mousemove shows a compact tooltip with label only
- Medium (3x3+): show floating summary panels normally
- Fullscreen: full toolbar + detail cards

Size detection: a `ResizeObserver` on the container element triggers layout adjustments.

## Performance

- `requestAnimationFrame` render loop, only re-render on change (dirty flag: camera moved, pin added/removed, data updated)
- 50+ pins: only render panels for pins with screen coordinates within the viewport
- 1M+ face models: prompt user to simplify, or use low-detail fallback
