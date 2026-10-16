// Light, dark, or whatever the phone is set to.
//
// The app reads its colours from four token objects (C, M, L, HUE) that
// every StyleSheet captures when its module first loads. So the mode is
// resolved once, before any screen module loads, by writing the chosen
// palette into those objects in place (see Boot.tsx). Changing it later
// reloads the app, which is the only way every captured style sees it.
//
// Both modes are the same design: a ground of the semantic washes over a
// near neutral, translucent cards that take the colour of what is behind
// them, and hairline edges. Dark is Graphite pushed nearer black, moodier
// than before; light is the same washes over warm paper.

import { C, M } from '../theme';
import { HUE, L, type Meaning } from './surface';

export type Scheme = 'system' | 'light' | 'dark';
export type Mode = 'light' | 'dark';

export const SCHEMES: Scheme[] = ['system', 'light', 'dark'];
export const SCHEME_LABEL: Record<Scheme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export function resolveMode(scheme: Scheme, phone: string | null | undefined): Mode {
  if (scheme === 'system') return phone === 'light' ? 'light' : 'dark';
  return scheme;
}

// The ground, the floating bar and the status bar: the parts of the look
// that were constants rather than tokens.
export const G = {
  mode: 'dark' as Mode,
  top: '#0F1115',
  mid: '#08090B',
  foot: '#030405',
  // How strongly the two semantic hues wash the ground.
  washFrom: 0.22,
  washTo: 0.17,
  bar: 'rgba(14, 16, 20, 0.94)',
  shadow: '#000000',
  statusBar: 'light' as 'light' | 'dark',
  // Type and controls set straight on the ground, outside any card: a
  // screen's title, a section heading, a segmented control, a button. The
  // cards are the same dark object in both modes, so only these turn.
  ink: '#FFFFFF',
  body: '#D2D5DA',
  meta: '#A9AEB5',
  fill: 'rgba(255, 255, 255, 0.08)',
  fillSelected: 'rgba(255, 255, 255, 0.15)',
  rule: 'rgba(255, 255, 255, 0.1)',
  pill: '#FFFFFF',
  onPill: '#0C0E11',
  // A plain surface on the ground, for lists, the text box and rows: white
  // on light, a step below the ground on dark, with the ground's inks on it.
  card: '#0F0F0F',
};

type Palette = {
  C: Record<keyof typeof C, string>;
  M: Record<keyof typeof M, string>;
  L: Record<keyof typeof L, string>;
  HUE: Record<Meaning, string>;
  G: typeof G;
};

// White at low alpha on dark, near black at low alpha on light: the same
// lift, read the other way round.
const lift = (mode: Mode, a: number) => (mode === 'dark' ? `rgba(255, 255, 255, ${a})` : `rgba(12, 14, 17, ${a})`);
const tint = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;

// The eight at their Dark step, for Graphite.
const HUE_DARK: Record<Meaning, string> = {
  measured: '#789AF3',
  timeDepth: '#B188F3',
  reported: '#F46EB4',
  escalation: '#EC5D4A',
  change: '#EC9658',
  evidence: '#F2B863',
  uncertainty: '#E4C058',
  attention: '#CECB47',
};


// The third shade, on light: sky blue for what she can press or has
// chosen, buttons, selected pills and chips, with dark type on it for the
// contrast (10:1). The canvas is #F1F0ED and the cards white; colour is
// kept for this and for what means something.
const SKY = '#87CEFA';
const SKY_SELECTED = 'rgba(135, 206, 250, 0.45)';

function build(mode: Mode): Palette {
  // Each mode is whole now: on light the cards are light too, the same soft
  // glow in a lighter shade over #F1F0ED, with dark type; on dark they are
  // the dark object they always were.
  const onDark = mode === 'dark';
  const dark = onDark;
  // On light, each accent deepened just until it reads at 3:1 on a light
  // card, the floor Apple asks of graphics; on dark, as designed.
  const h = dark ? HUE_DARK : (Object.fromEntries(Object.entries(HUE_DARK).map(([k, v]) => [k, deepen(v, '#F6F5F2', 3)])) as Record<Meaning, string>);
  const ink = dark ? '#FFFFFF' : '#0C0E11';
  const body = dark ? '#D2D5DA' : '#373C44';
  const meta = dark ? '#A9AEB5' : '#454B54';
  const ground = (c: string) => ({ top: c, mid: c, foot: c, washFrom: 0, washTo: 0 });
  const g: typeof G = onDark
    ? { mode: 'dark', ...ground('#161616'), bar: 'rgba(14, 16, 20, 0.94)', shadow: '#000000', statusBar: 'light',
        ink: '#FFFFFF', body: '#D2D5DA', meta: '#A9AEB5', fill: 'rgba(255, 255, 255, 0.08)', fillSelected: 'rgba(255, 255, 255, 0.15)', rule: 'rgba(255, 255, 255, 0.1)', pill: '#FFFFFF', onPill: '#0C0E11', card: '#0F0F0F' }
    : { mode: 'light', ...ground('#F1F0ED'), bar: 'rgba(22, 22, 22, 0.94)', shadow: '#2A2520', statusBar: 'dark',
        ink: '#0C0E11', body: '#373C44', meta: '#454B54', fill: 'rgba(12, 14, 17, 0.06)', fillSelected: SKY_SELECTED, rule: 'rgba(12, 14, 17, 0.12)', pill: SKY, onPill: '#0C0E11', card: '#FFFFFF' };
  // A card on light is paper lifted toward white rather than darkened, so
  // it still reads as nearer than the ground.
  // Dark glass: a smoked fill over the blur, so a card is darker than the
  // glow behind it rather than lighter, and its crisp edge gives it shape.
  // Chips and the small cards inside a card: a flat lift, as the Add a
  // Lab Report button is drawn. No edge, no blur.
  const card = lift(mode, dark ? 0.08 : 0.05);
  const cardHi = lift(mode, dark ? 0.12 : 0.08);
  // The text box's field: darker than the ground on dark, whiter on light,
  // with a hairline. Lists and conversation take it.
  const field = dark ? '#0F0F0F' : '#FFFFFF';

  return {
    HUE: h,
    G: g,
    L: {
      canvas: g.mid,
      recessed: card,
      // Under a content card's rendered ground, for the moment before it
      // paints.
      glass: dark ? '#0B0B0C' : '#FBFAF8',
      field,
      rule: lift(mode, dark ? 0.1 : 0.09),
      statement: dark ? lift(mode, 0.085) : cardHi,
      fillSelected: dark ? lift(mode, 0.14) : SKY_SELECTED,
      edgeOn: lift(mode, dark ? 0.16 : 0.22),
      ink,
      body,
      meta,
      pill: dark ? ink : SKY,
      onPill: '#0C0E11',
    },
    M: {
      ...h,
      historical: meta,
      unlit: dark ? '#202328' : '#DCD8D3',
    },
    C: {
      bg: g.mid,
      card,
      cardHi,
      surface: card,
      fill: lift(mode, dark ? 0.08 : 0.05),
      fillSelected: dark ? lift(mode, 0.14) : SKY_SELECTED,
      border: lift(mode, dark ? 0.12 : 0.1),
      borderSub: lift(mode, dark ? 0.1 : 0.07),
      separator: lift(mode, dark ? 0.07 : 0.08),
      text: ink,
      secondary: body,
      muted: meta,
      tertiary: dark ? '#80858D' : '#7A8089',
      chevron: dark ? '#62676E' : '#9DA2A9',
      tint: ink,
      blueLink: h.measured,
      coral: h.reported,
      rose: h.reported,
      pink: h.reported,
      lavender: h.timeDepth,
      indigo: h.timeDepth,
      violet: h.timeDepth,
      blue: h.measured,
      mint: h.measured,
      sleepLine: h.measured,
      orange: h.change,
      orangeText: h.change,
      amber: h.evidence,
      gray: meta,
      red: h.escalation,
      pinkSevere: h.escalation,
      pinkMild: tint(h.reported, 0.14),
      amberBg: tint(h.evidence, 0.14),
      amberBorder: tint(h.evidence, 0.26),
      amberInk: h.evidence,
      lowBg: tint(h.uncertainty, 0.14),
      lowText: h.uncertainty,
      loggedBg: tint(h.reported, 0.14),
      loggedInk: h.reported,
      measuredBg: tint(h.measured, 0.14),
      measuredText: h.measured,
      labBg: tint(h.evidence, 0.14),
      labText: h.evidence,
      inBg: dark ? '#111316' : lift(mode, 0.05),
      inText: body,
      green: body,
      white: '#FFFFFF',
    },
  };
}

export const PALETTES: Record<Mode, Palette> = { light: build('light'), dark: build('dark') };

// Writes a palette into the live token objects. Must run before any screen
// module loads; Boot.tsx does that.
export function applyMode(mode: Mode) {
  const p = PALETTES[mode];
  Object.assign(C as Record<string, string>, p.C);
  Object.assign(M as Record<string, string>, p.M);
  Object.assign(L as Record<string, string>, p.L);
  Object.assign(HUE, p.HUE);
  Object.assign(G, p.G);
}

// A colour darkened in small steps until it reaches a contrast against a
// ground, or as given when it already does.
function deepen(hex: string, ground: string, ratio: number): string {
  let [r, g, b] = rgb(hex);
  const out = () => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  for (let i = 0; i < 40 && contrast(out(), ground) < ratio; i++) [r, g, b] = [r * 0.94, g * 0.94, b * 0.94];
  return out() === hex.toUpperCase() ? hex : out();
}

// WCAG contrast ratio between two colours, #RRGGBB or rgba() over white.
export function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = rgb(c).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgb(c: string): [number, number, number] {
  if (c.startsWith('#')) return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
  const [r, g, b] = c.replace(/[^\d.,]/g, '').split(',').map(Number);
  return [r, g, b];
}

// A chart or icon colour, as it should be drawn. Marks sit in cards, and
// cards are dark in both modes, so the pastel stands everywhere; the
// deepening is kept for a mark drawn straight on the light paper.
export function onGround(hex: string, onPaper = false): string {
  if (!onPaper || G.mode === 'dark') return hex;
  let [r, g, b] = rgb(hex);
  const out = () => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  for (let i = 0; i < 30 && contrast(out(), G.foot) < 3; i++) [r, g, b] = [r * 0.92, g * 0.92, b * 0.92];
  return keepGiven(out(), hex);
}

// Unchanged colours come back exactly as given.
const keepGiven = (made: string, given: string) => (made === given.toUpperCase() ? given : made);
