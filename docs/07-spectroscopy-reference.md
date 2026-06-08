# Spectroscopy and Symmetry Reference

This document contains the chemistry background used as the basis for the app's teaching content.

---

## Degrees of freedom rule

For a molecule with N atoms:

| Molecule type | Translational DOF | Rotational DOF | Vibrational DOF |
|---|---|---|---|
| Linear | 3 | 2 | 3N − 5 |
| Non-linear | 3 | 3 | 3N − 6 |

Rationale:
- Every atom has 3 translational DOF → total 3N.
- 3 are always used for whole-molecule translation.
- Linear molecules have only 2 independent rotation axes (rotation around the bond axis has no physical effect for a linear molecule).
- All remaining DOF are vibrational.

---

## Point groups of the target molecules

| Molecule | Point group | Key symmetry elements |
|---|---|---|
| He | Kh | All rotations and reflections (spherical) |
| N₂ | D∞h | C∞, σh, i (center of inversion) |
| CO₂ | D∞h | C∞, σh, i (center of inversion) |
| H₂O | C₂v | C₂, 2σv planes |

---

## IR activity rule
A vibrational mode is IR active if and only if it results in a change in the dipole moment of the molecule.

This means the mode must belong to the same irreducible representation as x, y, or z (translational coordinates) in the character table.

---

## Raman activity rule
A vibrational mode is Raman active if and only if it results in a change in the polarizability of the molecule.

This means the mode must belong to the same irreducible representation as a quadratic function (x², y², z², xy, xz, yz) in the character table.

---

## Mutual exclusion rule
For molecules with a center of inversion (like N₂ and CO₂):
- Modes that are IR active (ungerade, u) are Raman inactive.
- Modes that are Raman active (gerade, g) are IR inactive.
- No mode can be simultaneously IR and Raman active.

H₂O has no center of inversion (C₂v), so all three normal modes are both IR and Raman active.

---

## Normal modes summary

### N₂ (D∞h, 1 vibrational mode)
| Mode | Symmetry | IR | Raman |
|---|---|---|---|
| Stretch (ν₁) | Σg+ | Inactive | Active |

### CO₂ (D∞h, 4 vibrational modes)
| Mode | Symmetry | IR | Raman | Description |
|---|---|---|---|---|
| ν₁ (sym stretch) | Σg+ | Inactive | Active | Both O move away from C together |
| ν₂ (degenerate bend) | Πu | Active | Inactive | O–C–O angle bends (2 degenerate directions) |
| ν₃ (asym stretch) | Σu+ | Active | Inactive | One O moves in while other moves out |

### H₂O (C₂v, 3 vibrational modes)
| Mode | Symmetry (Γ) | IR | Raman | Description |
|---|---|---|---|---|
| ν₁ (sym stretch) | A₁ | Active | Active | Both H move away from O together |
| ν₂ (bend) | A₁ | Active | Active | H–O–H angle changes |
| ν₃ (asym stretch) | B₁ | Active | Active | One H moves in while other moves out |

---

## Dipole moment change per mode (qualitative)

| Molecule | Mode | Δμ direction | IR? |
|---|---|---|---|
| CO₂ | Sym stretch | Cancels by symmetry | No |
| CO₂ | Asym stretch | Along bond axis | Yes |
| CO₂ | Bend | Perpendicular to axis | Yes |
| H₂O | Sym stretch | Along C₂ axis | Yes |
| H₂O | Bend | Along C₂ axis | Yes |
| H₂O | Asym stretch | Perpendicular to C₂ | Yes |

---

## Sources and further reading

- Atkins, Physical Chemistry — molecular vibrations and group theory chapters
- Purdue Jmol vibrational mode visualizations: https://www.chem.purdue.edu/jmol/vibs/co2.html and /h2o.html
- LibreTexts: Number of Vibrational Modes — https://chem.libretexts.org
- LibreTexts: Identifying IR- and Raman-active modes — https://chem.libretexts.org
