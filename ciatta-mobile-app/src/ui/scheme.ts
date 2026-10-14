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

// The eight a step deeper than Base, for paper: Base itself sits under
// 4.5:1 on a light ground for half of them, and these are text too.
const HUE_LIGHT: Record<Meaning, string> = {
  measured: '#3456C8',
  timeDepth: '#7440BE',
  reported: '#B02D76',
  escalation: '#AE2617',
  change: '#8F4A14',
  evidence: '#7A560C',
  uncertainty: '#8A6C12',
  attention: '#77740F',
};

function build(mode: Mode): Palette {
  const dark = mode === 'dark';
  const h = dark ? HUE_DARK : HUE_LIGHT;
  const ink = dark ? '#FFFFFF' : '#0C0E11';
  const body = dark ? '#D2D5DA' : '#373C44';
  const meta = dark ? '#A9AEB5' : '#59606A';
  const g: typeof G = dark
    ? { mode, top: '#0F1115', mid: '#08090B', foot: '#030405', washFrom: 0.22, washTo: 0.17, bar: 'rgba(14, 16, 20, 0.94)', shadow: '#000000', statusBar: 'light' }
    : { mode, top: '#F8F6F3', mid: '#F1EEEA', foot: '#E8E4DF', washFrom: 0.13, washTo: 0.1, bar: 'rgba(250, 248, 245, 0.94)', shadow: '#2A2520', statusBar: 'dark' };
  // A card on light is paper lifted toward white rather than darkened, so
  // it still reads as nearer than the ground.
  // Dark glass: a smoked fill over the blur, so a card is darker than the
  // glow behind it rather than lighter, and its crisp edge gives it shape.
  const card = dark ? 'rgba(14, 16, 21, 0.38)' : 'rgba(255, 255, 255, 0.62)';
  const cardHi = dark ? 'rgba(24, 27, 34, 0.52)' : 'rgba(255, 255, 255, 0.82)';

  return {
    HUE: h,
    G: g,
    L: {
      canvas: g.mid,
      recessed: card,
      glass: card,
      rule: lift(mode, dark ? 0.1 : 0.09),
      statement: dark ? lift(mode, 0.085) : cardHi,
      fillSelected: lift(mode, dark ? 0.14 : 0.08),
      edgeOn: lift(mode, dark ? 0.16 : 0.22),
      ink,
      body,
      meta,
      pill: ink,
      onPill: dark ? '#0C0E11' : '#FFFFFF',
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
      fillSelected: lift(mode, dark ? 0.14 : 0.09),
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
export function applyMode(mode: Mode, liquidGlass = false) {
  const p = PALETTES[mode];
  Object.assign(C as Record<string, string>, p.C);
  Object.assign(M as Record<string, string>, p.M);
  Object.assign(L as Record<string, string>, p.L);
  Object.assign(HUE, p.HUE);
  Object.assign(G, p.G);
  // Liquid Glass brings its own material, as the tab bar does, so a card
  // drawn in it adds no fill of its own.
  if (liquidGlass) (L as Record<string, string>).glass = 'transparent';
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

// A chart or icon colour, as it should be drawn on the current ground.
// Dark keeps the pastel; light deepens it, keeping its hue, until it clears
// 3:1 against the darkest part of the paper, which is the bar for marks.
export function onGround(hex: string): string {
  if (G.mode === 'dark') return hex;
  let [r, g, b] = rgb(hex);
  const out = () => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  for (let i = 0; i < 30 && contrast(out(), G.foot) < 3; i++) [r, g, b] = [r * 0.92, g * 0.92, b * 0.92];
  return keepGiven(out(), hex);
}

// Unchanged colours come back exactly as given.
const keepGiven = (made: string, given: string) => (made === given.toUpperCase() ? given : made);
