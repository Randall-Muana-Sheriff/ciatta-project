// The card glow: coloured light at the top of a card, fading into a dark
// foot, the way WHOOP lights its cards, but soft and blurred rather than a
// flat fill. Two hues per card: the first lights the top edge, the second
// pools beside it so the light has a shape. Each card on a screen takes a
// different pair, in the order it mounts.
//
// Pure colour arithmetic, kept apart from the component so the contrast of
// card type on the brightest part of every glow is tested, not trusted.

import { contrast } from './scheme';

// The hues at their Base step, from the semantic eight.
const SKY = '#486FE9';
const LAVENDER = '#915ADB';
const ROSE = '#CD4290';
const EMBER = '#C7702A';
const AMBER = '#CD9132';
const FLARE = '#C52D1E';

export const GLOWS: [string, string][] = [
  [SKY, LAVENDER],
  [ROSE, EMBER],
  [LAVENDER, ROSE],
  [AMBER, EMBER],
  [SKY, ROSE],
  [EMBER, LAVENDER],
  [LAVENDER, SKY],
  [FLARE, AMBER],
  [ROSE, LAVENDER],
  [EMBER, ROSE],
];

// The dark the light fades into.
export const FOOT = '#0A0A0C';
// How much of the hue reaches the top edge at most, and how much is left
// at the middle. A bright hue like Amber is held lower than Sky, so every
// glow is as bright as muted type allows (4.6:1) and they read as one
// family rather than some glaring.
export const TOP = 0.5;
export const MID = 0.12;
// The second hue's pool, at its centre.
export const POOL = 0.3;

const META = '#A9AEB5';

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
export const mix = (a: string, b: string, t: number) => hex(rgb(a).map((v, i) => v * t + rgb(b)[i] * (1 - t)));

// The colour of the gradient at t (0 top, 1 foot), with the second hue's
// pool at full strength on top of it: the brightest the card gets there.
export function glowAt(pair: [string, string], t: number, top = topFor(pair)): string {
  const [first, second] = pair;
  const strength = t <= 0.5 ? top + (MID - top) * (t / 0.5) : MID * (1 - (t - 0.5) / 0.5);
  const base = mix(first, FOOT, strength);
  return t === 0 ? mix(second, base, POOL * top) : base;
}

// The brightest top this pair can take with muted type still reading.
export function topFor(pair: [string, string]): number {
  let top = TOP;
  while (top > MID && contrast(META, glowAt(pair, 0, top)) < 4.6) top -= 0.01;
  return Math.round(top * 100) / 100;
}

export const glowFor = (n: number) => GLOWS[n % GLOWS.length];
