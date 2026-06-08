// equilibriumAngleDeg: the molecule's true bond angle at rest (null = not applicable)
// dipoleMagnitude: rough relative scale 0–1 for the permanent dipole arrow
export const MOLECULES = {
  He: {
    label: 'He', formula: 'He', geometry: 'Atom', pointGroup: 'K_h',
    totalDof: '3', translation: '3', rotation: '0', vibration: '0',
    equilibriumAngleDeg: null, dipoleMagnitude: 0,
    note: 'Single atom baseline. Translation only.',
    checklist: ['Move whole atom']
  },
  N2: {
    label: 'N₂', formula: 'N₂', geometry: 'Linear diatomic', pointGroup: 'D∞h',
    totalDof: '6', translation: '3', rotation: '2', vibration: '1',
    equilibriumAngleDeg: null, dipoleMagnitude: 0,
    note: 'Homonuclear diatomic. Stretch exists but IR-inactive — no dipole change.',
    checklist: ['Move whole molecule', 'Turn whole molecule', 'Stretch bond']
  },
  CO: {
    label: 'CO', formula: 'CO', geometry: 'Linear diatomic', pointGroup: 'C∞v',
    totalDof: '6', translation: '3', rotation: '2', vibration: '1',
    equilibriumAngleDeg: null, dipoleMagnitude: 0.35,
    note: 'Heteronuclear diatomic. Permanent dipole → stretch is IR-active.',
    checklist: ['Move whole molecule', 'Turn whole molecule', 'Stretch bond']
  },
  CO2: {
    label: 'CO₂', formula: 'CO₂', geometry: 'Linear triatomic', pointGroup: 'D∞h',
    totalDof: '9', translation: '3', rotation: '2', vibration: '4',
    equilibriumAngleDeg: 180, dipoleMagnitude: 0,
    note: 'Centrosymmetric triatomic. Symmetric stretch Raman-only; asym-stretch + bend IR-active. Mutual exclusion applies.',
    checklist: ['Move whole molecule', 'Turn whole molecule', 'Stretch both C–O together', 'Stretch C–O oppositely', 'Bend']
  },
  H2O: {
    label: 'H₂O', formula: 'H₂O', geometry: 'Bent triatomic', pointGroup: 'C₂v',
    totalDof: '9', translation: '3', rotation: '3', vibration: '3',
    equilibriumAngleDeg: 104.5, dipoleMagnitude: 0.85,
    note: 'Bent triatomic with permanent dipole. All 3 modes IR-active. Equilibrium angle ≈ 104.5°.',
    checklist: ['Move whole molecule', 'Turn whole molecule', 'Stretch both O–H together', 'Stretch O–H oppositely', 'Bend H–O–H angle']
  }
};
