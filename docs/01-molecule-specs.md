# Molecule Specifications

## Target set

Four molecules covering the key spectroscopic cases:

```
He → N₂ → CO₂ → H₂O
 (atom)  (diatomic)  (linear triatomic)  (bent triatomic)
```

---

## He — Monoatomic

| Property | Value |
|---|---|
| Atoms N | 1 |
| Translational DOF | 3 |
| Rotational DOF | 0 |
| Vibrational DOF | 0 |
| Permanent dipole | None |
| Point group | K_h (spherical) |
| IR active modes | 0 |
| Raman active modes | 0 |
| Webcam representation | Single tracked point (nose tip) |

**Teaching message:** A single atom has only translation. There are no bonds to vibrate and no axis to rotate around. Nothing to observe in IR or Raman spectroscopy.

---

## N₂ — Homonuclear diatomic

| Property | Value |
|---|---|
| Atoms N | 2 |
| Translational DOF | 3 |
| Rotational DOF | 2 (linear) |
| Vibrational DOF | 1 (3N-5 = 1) |
| Permanent dipole | None |
| Point group | D∞h |
| IR active modes | 0 (symmetric: no dipole change) |
| Raman active modes | 1 (stretch changes polarizability) |
| Webcam representation | Nose tip + one hand index tip |

**Teaching message:** The stretch vibration exists but does not change the dipole moment (symmetric, homonuclear). IR silent. Raman active because the electron cloud is squashed and stretched.

---

## CO₂ — Linear triatomic (centrosymmetric)

| Property | Value |
|---|---|
| Atoms N | 3 |
| Translational DOF | 3 |
| Rotational DOF | 2 (linear) |
| Vibrational DOF | 4 (3N-5 = 4) |
| Permanent dipole | None (centrosymmetric) |
| Point group | D∞h |

### Normal modes

| Mode | Label | IR active | Raman active | Why |
|---|---|---|---|---|
| Symmetric stretch (ν₁) | Σg+ | No | Yes | No dipole change; polarizability changes |
| Antisymmetric stretch (ν₃) | Σu+ | Yes | No | Dipole changes; mutual exclusion |
| Bending (ν₂, doubly degenerate) | Πu | Yes | No | Dipole change perpendicular to axis |

**Key teaching point:** Mutual exclusion rule — in a centrosymmetric molecule, a mode cannot be both IR and Raman active. This is the CO₂ story.

**Webcam representation:** Nose tip (C, central atom) + left index tip (O₁) + right index tip (O₂). Angle snapped to linear (>165°).

---

## H₂O — Bent triatomic

| Property | Value |
|---|---|
| Atoms N | 3 |
| Translational DOF | 3 |
| Rotational DOF | 3 (non-linear) |
| Vibrational DOF | 3 (3N-6 = 3) |
| Permanent dipole | Yes (~1.85 D, along C₂ axis) |
| Point group | C₂v |
| Bond angle (equilibrium) | ~104.5° |
| Γ_vib | 2A₁ + B₁ |

### Normal modes

| Mode | Label | IR active | Raman active | Why |
|---|---|---|---|---|
| Symmetric stretch (ν₁) | A₁ | Yes | Yes | Dipole magnitude changes; polarizability changes |
| Bending (ν₂) | A₁ | Yes | Yes | Dipole direction+magnitude changes |
| Antisymmetric stretch (ν₃) | B₁ | Yes | Yes | Dipole changes; no center of inversion |

**Key teaching point:** No center of inversion → no mutual exclusion. All three modes are both IR and Raman active. Permanent dipole means bend directly visible as dipole oscillation.

**Webcam representation:** Nose tip (O, central atom) + left index tip (H₁) + right index tip (H₂). Angle snapped to bent (<150°, idealized to ~104°).

---

## Extension notes (post-V1)

- NH₃ (C₃v, pyramidal) — would require 4 tracked points
- CH₄ (Td, tetrahedral) — would require 5 tracked points
- These are explicitly out of scope for V1; the teaching value of the 4-molecule set is self-contained.
