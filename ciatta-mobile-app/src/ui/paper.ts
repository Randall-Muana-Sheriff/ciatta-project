// Paper: the chat's own white surface, on Today and open over the whole
// screen. Near black type on white for the strongest contrast, with the
// same roles the dark palette has, so a component can take either.

export const PAPER = {
  bg: '#FFFFFF',
  ink: '#0C0E11',
  body: '#373C44',
  meta: '#59606A',
  fill: 'rgba(12, 14, 17, 0.06)',
  fillSelected: 'rgba(12, 14, 17, 0.10)',
  rule: 'rgba(12, 14, 17, 0.12)',
  // The third shade: sky blue, with dark type on it.
  pill: '#87CEFA',
  onPill: '#0C0E11',
  // The text box on paper: the paper itself, flat white with no edge.
  card: '#FFFFFF',
} as const;
