// Flat-color Norse palette, shared by canvas painters and (via CSS vars in
// style.css) the DOM chrome. Keep the two in sync by hand — it's ten colors.

export const PALETTE = {
  // Sea bands
  deepSea: '#16324a',
  sea: '#1e4666',
  coast: '#2a5d80',
  storm: '#3d4d63',
  ice: '#b9d4dd',
  // Land
  land: '#4a6741',
  landEdge: '#3a5334',
  mountain: '#6b705c',
  sand: '#c2a878',
  // Fog
  fogUndiscovered: '#0c1826',
  fogDim: 'rgba(12, 24, 38, 0.55)',
  // Accents
  ship: '#e8d5a3',
  shipHull: '#7a5230',
  gold: '#d9a441',
  blood: '#a63c32',
  parchment: '#e8dcc0',
  ink: '#1d1a14',
  runeGlow: '#8fd0c8',
  grid: 'rgba(232, 220, 192, 0.08)',
} as const;
