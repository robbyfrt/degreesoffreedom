export const MOLECULES = {
  He: {
    label: 'He',
    formula: 'He',
    geometry: 'Atom',
    pointGroup: 'K_h',
    totalDof: '3',
    translation: '3',
    rotation: '0',
    vibration: '0',
    note: 'Single atom baseline. Translation only in this toy model.',
    checklist: ['Move whole atom']
  },
  N2: {
    label: 'N₂',
    formula: 'N₂',
    geometry: 'Linear diatomic',
    pointGroup: 'D∞h',
    totalDof: '6',
    translation: '3',
    rotation: '2',
    vibration: '1',
    note: 'Homonuclear diatomic. The stretch vibration exists but is IR-inactive due to zero dipole change.',
    checklist: ['Move whole molecule', 'Turn whole molecule', 'Stretch bond']
  },
  CO: {
    label: 'CO',
    formula: 'CO',
    geometry: 'Linear diatomic',
    pointGroup: 'C∞v',
    totalDof: '6',
    translation: '3',
    rotation: '2',
    vibration: '1',
    note: 'Heteronuclear diatomic. Permanent dipole → stretch is IR-active.',
    checklist: ['Move whole molecule', 'Turn whole molecule', 'Stretch bond']
  },
  CO2: {
    label: 'CO₂',
    formula: 'CO₂',
    geometry: 'Linear triatomic',
    pointGroup: 'D∞h',
    totalDof: '9',
    translation: '3',
    rotation: '2',
    vibration: '4',
    note: 'Centrosymmetric triatomic. Symmetric stretch Raman-only; asymmetric stretch + bend are IR-active. Rule of mutual exclusion applies.',
    checklist: ['Move whole molecule', 'Turn whole molecule', 'Stretch both C–O together', 'Stretch C–O oppositely', 'Bend']
  },
  H2O: {
    label: 'H₂O',
    formula: 'H₂O',
    geometry: 'Bent triatomic',
    pointGroup: 'C₂v',
    totalDof: '9',
    translation: '3',
    rotation: '3',
    vibration: '3',
    note: 'Bent triatomic with permanent dipole. All 3 modes IR-active. Good case for angle intuition — angle ≈ 104.5°.',
    checklist: ['Move whole molecule', 'Turn whole molecule', 'Stretch both O–H together', 'Stretch O–H oppositely', 'Bend H–O–H angle']
  }
};
