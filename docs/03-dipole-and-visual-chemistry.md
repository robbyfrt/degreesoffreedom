# Dipole Moment and Visual Chemistry

## Guiding principle

No ab-initio calculation is done. All chemical visualizations are **qualitative proxy models** designed to communicate correct conceptual relationships, not exact values.

---

## Partial charge model

Each molecule uses fixed hardcoded partial charges (in arbitrary units) assigned to each atom:

| Molecule | Atom charges (arbitrary) | Rationale |
|---|---|---|
| He | He: 0 | No bond polarity |
| N₂ | N: 0, N: 0 | Homonuclear, symmetric |
| CO₂ | O: -0.5, C: +1.0, O: -0.5 | Oxygen more electronegative |
| H₂O | O: -0.66, H: +0.33, H: +0.33 | Oxygen most electronegative |

These values are not real partial charges; they are chosen to correctly reproduce the qualitative IR activity stories.

---

## Dipole vector computation

For tracked positions rᵢ (in normalized, COM-centered coordinates):

```
μ = Σᵢ qᵢ · rᵢ
```

This is a 2D vector in screen space. Display as:
- An arrow from molecular center in direction of μ, with length proportional to |μ|.
- A sparkline of |μ(t)| over the last 3 seconds.
- When |Δμ/Δt| is high, show a glowing "IR active" indicator.
- When |μ| is near-constant but the shape is changing (e.g., CO₂ symmetric stretch), show a "Raman active" indicator.

---

## IR / Raman activity indicators

| Indicator | Trigger | Color |
|---|---|---|
| IR ACTIVE | d|μ|/dt > threshold OR direction changes | Warm amber/orange |
| IR SILENT | |μ| near-zero and stable | Gray |
| RAMAN ACTIVE | Shape change without significant dipole change | Cool blue/teal |
| RAMAN SILENT | No shape change | Gray |

For Raman, use a simple proxy: if the "polarizability ellipse" (see below) deforms during the motion, flag as Raman active.

---

## Electron density / charge cloud

Use a **stylized Gaussian blob model** — not real electron density:

- Each atom gets a soft circular Gaussian drawn on canvas.
- Blob radius proportional to "electron cloud size" (O > C > H).
- Blob color encodes partial charge:
  - Blue-purple: electron-rich (negative partial charge)
  - Red-orange: electron-poor (positive partial charge)
  - Gray/green: neutral
- Blobs are composited with additive or screen blending to show shared electron regions.

When dipole changes strongly during a mode:
- Pulse the blob colors rhythmically.
- Shift the center of the negative blob slightly toward the electropositive end.

---

## Polarizability ellipse (Raman proxy)

- Draw a semi-transparent ellipse around the whole molecule.
- At equilibrium, it is circular (or matches a preset aspect ratio per molecule).
- During a symmetric stretch, the ellipse elongates along the bond axis → Raman active visualization.
- During an asymmetric stretch or bend, the change is smaller or asymmetric.
- The ellipse does not deform for translation or rotation (pure rigid-body motion).

This is a metaphor for "how easily the electron cloud deforms," which is the intuitive definition of polarizability.

---

## Dipole arrow behavior per molecule

| Molecule | Equilibrium μ | Symmetric stretch | Asymmetric stretch | Bend |
|---|---|---|---|---|
| He | Zero, no arrow | N/A | N/A | N/A |
| N₂ | Zero | No change (Raman active, not IR) | N/A | N/A |
| CO₂ | Zero (cancels) | No change → IR silent | Arrow appears/oscillates | Arrow appears perpendicular |
| H₂O | Non-zero arrow along bisector | Arrow length changes | Arrow direction wobbles | Arrow direction changes |

This table should be rendered in the UI as part of the molecule info panel, not computed dynamically (except for live updates to the arrow).
