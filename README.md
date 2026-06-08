# Degrees of Freedom

**An interactive educational app for molecular vibrations, symmetry, and spectroscopy — controlled by your webcam.**

> GitHub Pages hosted · HTML + JS · MediaPipe face and hand tracking · No backend

---

## What it does

You use your face and hands as atoms. The app tracks three points, classifies your motion in real time, and teaches you the connection between molecular geometry, degrees of freedom, point groups, and IR/Raman spectroscopy.

Target molecules: **He · N₂ · CO₂ · H₂O**

---

## Key features (planned)

- **Motion checklist** — physically perform translation, rotation, symmetric stretch, asymmetric stretch, and bending. Check them all off.
- **Normalized molecule widget** — see your motion decomposed into internal coordinates with translation/rotation optionally removed.
- **Dipole arrow** — live qualitative dipole vector that lights up IR activity.
- **Charge cloud** — stylized electron density blobs showing molecular polarity.
- **Point group and DOF table** — shows the symmetry and mode count per molecule.
- **Auto-snap or manual classify** — linear vs bent geometry either snapped from tracking or set manually.

---

## Docs / Spec

All design decisions from the initial planning conversation are documented in [`/docs`](./docs):

| File | Contents |
|---|---|
| [00-overview.md](docs/00-overview.md) | Project goals, scope, tech constraints |
| [01-molecule-specs.md](docs/01-molecule-specs.md) | He, N₂, CO₂, H₂O — DOF, modes, IR/Raman tables |
| [02-tracking-and-geometry.md](docs/02-tracking-and-geometry.md) | Landmark assignment, smoothing, angle classification, motion scoring |
| [03-dipole-and-visual-chemistry.md](docs/03-dipole-and-visual-chemistry.md) | Dipole proxy model, charge clouds, polarizability ellipse |
| [04-ui-and-layout.md](docs/04-ui-and-layout.md) | Layout spec, widget design, checklist, controls |
| [05-implementation-plan.md](docs/05-implementation-plan.md) | Tech stack, module architecture, build phases |
| [06-open-questions.md](docs/06-open-questions.md) | Decisions needed before coding |
| [07-spectroscopy-reference.md](docs/07-spectroscopy-reference.md) | Chemistry background, character tables, mode tables |

---

## Status

🟡 Pre-implementation — spec complete, awaiting clarification on open questions before Phase 0 begins.

---

## License

MIT
