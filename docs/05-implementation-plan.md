# Implementation Plan

## Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Hosting | GitHub Pages | Static, free, no backend needed |
| HTML/CSS | Single HTML file | No build step; easy GitHub Pages deploy |
| JS | Vanilla ES modules via CDN | No npm/bundler for V1 |
| Tracking | MediaPipe Tasks (Vision WASM) via CDN | Face Landmarker + Hand Landmarker |
| Rendering | 2D Canvas (two canvases: video overlay + molecule widget) | Sufficient for V1 |
| 3D (optional) | Three.js via CDN (future) | Could upgrade molecule widget to 3D in V2 |
| WASM (optional) | Rust/WASM for geometry math (future) | JS is sufficient for V1; WASM makes sense for heavier normal mode animation |

## CDN imports needed

```html
<!-- MediaPipe Tasks Vision -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js"></script>

<!-- Fontshare -->
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
```

---

## Module architecture

```
index.html
├── style.css (inline or <style>)
├── src/
│   ├── tracking.js       — MediaPipe init, landmark extraction, smoothing
│   ├── geometry.js       — Internal coordinate computation, motion scoring
│   ├── molecules.js      — Molecule definitions (charges, modes, labels)
│   ├── render.js         — Canvas rendering (video overlay + widget)
│   ├── dipole.js         — Dipole vector computation, sparkline
│   ├── checklist.js      — Motion badge state machine
│   └── ui.js             — DOM controls, panel logic
```

For GitHub Pages (pure static), all files live in the repo root or a `/src` subfolder. The `index.html` loads modules via `<script type="module">`.

---

## Build phases

### Phase 0 — Skeleton
- `index.html` with layout, CSS variables, dark mode toggle
- Molecule selector (He, N₂, CO₂, H₂O) — static info panel only
- No webcam yet

### Phase 1 — Tracking
- MediaPipe Face Landmarker + Hand Landmarker
- Extract nose tip + index fingertips
- Smooth landmarks; draw as dots on video canvas
- Show raw r₁, r₂, θ values for debugging

### Phase 2 — Geometry engine
- Normalize coordinates
- Classify linear vs bent with hysteresis
- Score motion types (translation, rotation, stretch, bend)
- Live motion confidence bars

### Phase 3 — Molecule widget
- Normalized molecule canvas
- Atom circles + bond lines
- Gaussian charge clouds
- Remove-translation / remove-rotation toggles

### Phase 4 — Chemistry overlays
- Dipole arrow + sparkline
- Polarizability ellipse
- IR/Raman activity badges

### Phase 5 — Checklist
- Motion badge state machine
- Checklist UI with cross-off
- Per-molecule checklist items
- Tooltips with chemistry meaning

### Phase 6 — Polish
- Info panel (full DOF table, normal modes table)
- Mobile layout
- Accessibility audit
- Performance check

---

## Open questions / needs clarification

See `docs/06-open-questions.md`
