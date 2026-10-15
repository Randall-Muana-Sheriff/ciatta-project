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
  pill: '#0C0E11',
  onPill: '#FFFFFF',
  // The text box on paper: a soft grey well, so it reads as a place to write.
  card: '#F2F2F0',
} as const;
