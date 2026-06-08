# Open Questions and Clarifications Needed

These are the items that need a decision before or during implementation.

---

## HIGH PRIORITY — Needed before writing any code

### Q1: Landmark assignment for diatomics
For N₂ (2 atoms), the current plan uses nose tip + one index finger.
- Do you want to require one specific hand, or use whichever hand is visible?
- Should the app work with one hand + face, or two hands + face?

### Q2: Manual vs auto-classify default
Should the default be auto-classify (snap to nearest linear/bent based on tracked angle), or should the molecule be fixed by explicit selector?
- Suggested default: **explicit selector** (molecule picker sets the chemistry; camera only controls geometry within that frame).
- Confirm or override this.

### Q3: Camera overlay vs pure offset widget
The current plan shows the molecule widget in a **separate panel offset from the video** rather than as an AR overlay on the person's face/hands.
- Do you want both: the molecule rendered as an overlay AND a separate normalized view?
- Or just one of these?

### Q4: Checklist reset behavior
When does the checklist reset?
- On molecule change: always reset. ✓ (assumed)
- On page reload: reset. ✓ (assumed)
- Manual "reset" button: needed?
- Session persistence (via in-memory only, no localStorage): ✓ (assumed)

---

## MEDIUM PRIORITY — Can be deferred to implementation phase

### Q5: Raman activity visualization depth
The polarizability ellipse is a simplified metaphor. Is this sufficient, or do you want a more explicit "Raman" panel explaining the mechanism separately?

### Q6: Normal mode animation
Should the molecule widget animate the selected normal mode (like Jmol does), independent of the user's webcam input?
- This would be a useful "reference" mode: press "show mode" → watch the atoms oscillate in the correct pattern → then try to replicate it.
- WASM or simple JS sinusoidal animation is sufficient.

### Q7: Molecule geometry reference angle
For H₂O in the widget, should the angle snap to exactly 104.5° when frozen/locked, or just keep whatever the user's tracked angle is?
- For teaching it may be more honest to show the actual tracked angle, with a reference marker at 104.5°.

### Q8: Sound / haptic feedback
Any interest in playing a tone when a checklist item is completed? Or on IR activity detection?

### Q9: Classroom / sharing mode
Should there be a "teacher mode" that freezes the camera for explanation, or a QR code / link to share the current state?

---

## LOW PRIORITY — V2 / future

### Q10: WASM layer
You mentioned WASM would be a nice exercise. The natural place for a Rust/WASM module would be:
- Geometry math (landmark processing, coordinate transforms, motion scoring)
- Normal mode animation math
This could be added in V2 without changing the JS interface, since the module boundary is clean.

### Q11: Beyond 3 atoms
NH₃ (4 tracked points: nose + 3 fingertips) and CH₄ (5 points) are explicitly out of scope for V1 but architecturally possible. The molecule definition format in `molecules.js` should be designed with extensibility in mind.

### Q12: 3D molecule widget
V1 uses a 2D canvas for the molecule widget. A Three.js 3D upgrade in V2 would allow showing out-of-plane modes correctly and add depth to the charge cloud visualization.
