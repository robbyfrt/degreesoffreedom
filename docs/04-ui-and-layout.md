# UI Layout and Interaction Design

## Layout

Single-page app. Two main panels:

```
┌──────────────────────────────────────────────────┐
│  HEADER: Molecule selector  |  Mode toggles  |  ☀️ │
├──────────────────┬───────────────────────────────┤
│                  │                               │
│  CAMERA PANEL    │   MOLECULE WIDGET             │
│                  │                               │
│  Live webcam     │   Normalized atomic display   │
│  + tracked dots  │   + dipole arrow              │
│                  │   + charge clouds             │
│                  │   + mode arrows               │
│                  │                               │
├──────────────────┴───────────────────────────────┤
│  CHECKLIST PANEL (horizontal scroll on mobile)   │
├──────────────────────────────────────────────────┤
│  INFO PANEL: Symmetry, point group, DOF table    │
└──────────────────────────────────────────────────┘
```

On mobile: stack vertically. Camera on top, molecule widget below.

---

## Molecule selector

Four buttons: `He` | `N₂` | `CO₂` | `H₂O`

Changing molecule:
- Updates tracked landmarks (1, 2, or 3 points).
- Resets checklist.
- Updates info panel.
- Applies the correct partial-charge model.

---

## Molecule widget (normalized view)

This is NOT the camera overlay. It is a separate canvas offset from the video that shows:

| Element | Description |
|---|---|
| Atom circles | Sized by atomic radius proxy; colored by partial charge |
| Bond lines | Drawn between connected atoms |
| Charge cloud | Gaussian blobs per atom, color-coded by polarity |
| Polarizability ellipse | Semi-transparent ellipse around molecule |
| Dipole arrow | Vector μ from center; updates live |
| Mode arrows | Small velocity arrows on each atom when a mode is being performed |
| IR/Raman badge | Glow or label when activity is detected |

**Toggles above widget:**
- `Remove translation` — COM-centered coordinates
- `Remove rotation` — principal-axis aligned
- `Freeze frame` — locks geometry for inspection while motion info remains live

---

## Motion checklist

Shown as a horizontal row of cards (or vertical list on mobile):

| Card | Motion | Student-facing label |
|---|---|---|
| 🔵 | Translation | Move the whole molecule |
| 🔄 | Rotation | Turn the whole molecule |
| ↔️ | Symmetric stretch | Stretch both bonds together |
| ↕️ | Asymmetric stretch | Stretch one in, one out |
| ∠ | Bend | Open or close the angle |

Linear molecules (CO₂, N₂): checklist shows rotation as "2 rotations (in-plane + tilt)" with a note: "out-of-plane bend = rotation for a linear molecule!"

Non-linear (H₂O): shows all 5 types; note: "out-of-plane bend is a rotation here too — giving 3 independent rotations for bent molecules."

Each card:
- Grayed out until completed.
- Shows a pulsing green border when currently being performed.
- Shows a ✓ and turns solid when the motion has been sustained.
- Has a tooltip/expand with the chemistry meaning.

A live **motion confidence bar** shows top-3 current scores (translation, rotation, best vib mode) even while no badge is being awarded.

---

## Info panel

Shows the following for the selected molecule:

| Field | Example (CO₂) |
|---|---|
| Formula | CO₂ |
| Point group | D∞h |
| Geometry | Linear |
| Total DOF | 3N = 9 |
| Translation | 3 |
| Rotation | 2 |
| Vibration | 4 |
| Rule used | 3N − 5 (linear) |
| Normal modes table | ν₁, ν₂, ν₃ with IR/Raman columns |
| Dipole moment (equilibrium) | 0 D (centrosymmetric) |

---

## Theme and style notes

- Dark mode default (fits glowing chemistry overlays better).
- Teal primary accent (Nexus design system tokens).
- Canvas rendering for all chemistry overlays.
- Font: Satoshi (Fontshare) body + display.
- Minimum text size: 12px; body: 16px.
- Touch targets: ≥44px (for tablet/classroom use).
- Respect `prefers-reduced-motion`.

---

## Controls summary

| Control | Function |
|---|---|
| Molecule selector | Switch active molecule |
| Remove translation toggle | Subtract COM from normalized view |
| Remove rotation toggle | Align principal axis to fixed direction |
| Freeze frame | Lock geometry for inspection |
| Auto-classify / Manual toggle | Snap or manually set linear/bent |
| Linear / Bent toggle | Only shown when manual mode is active |
| Start/stop webcam | Privacy control |
| Dark/light mode | Theme toggle |
