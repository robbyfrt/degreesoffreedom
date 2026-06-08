# Tracking Architecture and Geometry

## Landmark sources

| Role | Source | Notes |
|---|---|---|
| Atom A (terminal 1) | Left hand index fingertip (landmark 8) | Robust across orientations |
| Atom B (central) | Nose tip (face mesh landmark 4) | Stable, on-axis for the user |
| Atom C (terminal 2) | Right hand index fingertip (landmark 8) | Robust across orientations |
| Fallback (diatomic) | Nose + one hand | For N₂ mode |
| Fallback (monoatomic) | Nose tip only | For He mode |

For He and N₂, fewer landmarks are required; the molecule selector drives which landmarks are extracted.

---

## Coordinate system

1. All positions extracted as 2D normalized image coordinates (primary) from MediaPipe.
2. 3D / world coordinates used as a **secondary consistency check only** — not as primary signal due to depth estimation instability from a static camera.
3. After extraction, apply:
   - **Smoothing**: exponential moving average (α ≈ 0.3–0.4) per landmark per frame.
   - **Normalization**: translate so center-of-mass = (0,0); scale so max bond length = 1.

---

## Internal geometry descriptors

For triatomic A–B–C:

| Descriptor | Formula | Notes |
|---|---|---|
| r₁ | |BA| (normalized) | After scale normalization |
| r₂ | |BC| (normalized) | After scale normalization |
| θ | arccos(BÂ · BĈ) | Internal bond angle |
| Length symmetry | min(r₁,r₂) / max(r₁,r₂) | 1.0 = symmetric, <0.8 = asymmetric |
| Angle variance | Var(θ) over N frames | High = jittery, unreliable |
| 2D/3D agreement | |θ₂D - θ₃D| | High discrepancy = suspect rotation artifact |

Absolute distances are **not used** — only relative ratios and angles.

---

## Geometry classification (snap model)

The molecule type is either:
- **Selected manually** via UI toggle (preferred for teaching), or
- **Auto-classified** from the tracked geometry (useful for discovery mode).

For auto-classify, the linear/bent threshold uses hysteresis:

| State | Entry condition | Exit condition |
|---|---|---|
| Linear | θ > 168° for ≥8 consecutive frames | Leave only if θ < 158° |
| Bent | θ < 150° for ≥8 consecutive frames | Leave only if θ > 160° |
| Uncertain | Anything in between OR angle variance > threshold | Stay until one class is stable |

A confidence score is computed:
```
confidence = f(angle_variance, 2d_3d_agreement, landmark_visibility)
```
If confidence < 0.5, the UI shows a "hold still" prompt and no reclassification occurs.

---

## Rotation artifact mitigation

The main known failure mode is that out-of-plane user rotation can appear as a change in internal angle via perspective projection. Mitigations:

| Problem | Mitigation |
|---|---|
| User rotates whole triangle out of plane | Compare 2D angle with 3D angle estimate; if they disagree > 20°, lower confidence |
| One hand occludes face | Require visibility > 0.6 on all three landmarks |
| Sudden frame-to-frame jump | Reject frames where any landmark moves > 15% of image width in one step |
| Noisy depth | Use only 2D for classification; 3D only for consistency check |

---

## Motion classification (checklist scoring)

For each frame window (~30 frames / ~1 second), score each motion type:

| Motion | Dominant signal | Award checklist badge when |
|---|---|---|
| Translation | COM displacement > threshold; r₁, r₂, θ all stable | Dominant for ≥0.6 s |
| Rotation (in-plane) | Orientation angle of BA vector changes; r₁, r₂, θ stable | Dominant for ≥0.6 s |
| Symmetric stretch | r₁ and r₂ change with same sign and similar magnitude; θ stable | Dominant for ≥0.6 s |
| Asymmetric stretch | r₁ and r₂ change with opposite sign; θ stable | Dominant for ≥0.6 s |
| Bend | θ changes above threshold; r₁, r₂ roughly stable | Dominant for ≥0.6 s |

If no single motion is dominant (mixed motion), no badge is awarded but the top-3 scores are shown as a live bar.

**Wording rule:** Out-of-plane bend is equivalent to rotation for a 3-atom system — this is explicitly shown in the checklist as a teaching point: "For 3 atoms, bending out of plane is just another rotation. No new independent mode!"

---

## Center-of-mass removal

When the "remove translation" toggle is active:
- Subtract the COM from all atom positions each frame before rendering the normalized molecule.

When the "remove rotation" toggle is active:
- Align the principal axis of the molecule to a fixed screen axis each frame.
- This is implemented as a 2D rotation alignment (Procrustes-like) of the normalized shape.

These toggles are educational tools: they help the student see that translation and rotation are factored out to reveal pure internal motion.
