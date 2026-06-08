# Degrees of Freedom — Project Overview

## What is this?

An educational, GitHub Pages-hosted single-HTML web app that teaches molecular vibrations, degrees of freedom, point groups, symmetry, IR/Raman activity, translation, rotation, and dipole moment — through a **live webcam interaction** where the user controls atom positions with their face and hands.

## Core idea

- A static webcam detects face + hand landmarks in the browser (MediaPipe).
- Three tracked points serve as the three atoms of a triatomic molecule.
- The app classifies the user's live motion into: translation, rotation, symmetric stretch, asymmetric stretch, or bending.
- A checklist lets students "cross off" each motion type as they physically perform it.
- A normalized molecule widget shows the idealized atomic geometry with chemistry overlays (dipole vector, partial-charge cloud, IR/Raman activity indicator).

## Target molecules

| Molecule | Type | Key teaching point |
|---|---|---|
| He | Monoatomic | No bond, translation only, no vibrational degrees of freedom |
| N₂ | Homonuclear diatomic | One vibrational mode, no permanent dipole, stretch IR-inactive |
| CO₂ | Linear triatomic | 4 vib modes (3N-5), centrosymmetry, IR/Raman mutual exclusion |
| H₂O | Bent triatomic | 3 vib modes (3N-6), permanent dipole, all modes IR+Raman active |

## Pedagogical goals

1. Understand that any molecular motion decomposes into translation + rotation + vibration.
2. See that the *number* of vibrational modes follows from N and linearity.
3. Connect geometry (point group / symmetry) to spectroscopic activity.
4. Understand qualitatively why some vibrations are IR active (change dipole moment) and others are Raman active (change polarizability).
5. Experience this through embodied interaction — not just passive reading.

## Tech constraints

- Hosted on GitHub Pages: static HTML + JS only, no backend.
- All computation in-browser (MediaPipe WASM, Canvas, no build step required).
- WASM optional: Rust/WASM layer could be added later for geometry math, but JS is sufficient for V1.
- No npm/bundler required for V1; CDN imports only.
