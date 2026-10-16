// The ground every screen stands on, lit the way the cards are (see
// CardFill): the screen's first hue falling softly from the top into the
// dark, its second pooled at the top to one side, and the same fine grain
// over it. Small and smooth: the light ends well before the middle of the
// screen, so type sits on the dark. Every content card on a screen is lit
// in that pair too, so the ground and the cards read as one light.

import { createContext, type ReactNode, useContext, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { FOOT, GLOW_OF, mix, topFor } from './glow';

import { G } from './scheme';
import type { Meaning } from './surface';

export type GroundHue = Meaning;

type Pair = { from: GroundHue; to: GroundHue; next: () => number };
let loose = 0;
const PairContext = createContext<Pair>({ from: 'measured', to: 'timeDepth', next: () => loose++ });

// The hue pair of the screen a card sits on.
export const useGroundPair = () => useContext(PairContext);

export function Ground({
  children,
  // Sky into Lavender unless the screen says otherwise.
  from = 'measured',
  to = 'timeDepth',
  today = false,
  white = false,
}: {
  children?: ReactNode;
  from?: GroundHue;
  to?: GroundHue;
  // Today alone has its sky: #87CEFA and white, soft and grained.
  today?: boolean;
  // Plain white, for the body view on Today.
  white?: boolean;
}) {
  // Hands each card on this screen its own place in the photo pool, in the
  // order the cards mount, so no two cards on a screen share a background
  // and the same screen opens with the same ones.
  const count = useRef(0);
  const next = () => count.current++;
  return (
    <PairContext.Provider value={{ from, to, next }}>
      <View style={s.fill}>
        {/* On light every screen, Today too, is the flat #F1F0ED canvas. */}
        {G.mode === 'light' ? null : today && !white ? <TodaySky /> : <GroundGlow from={from} to={to} />}
        {children}
      </View>
    </PairContext.Provider>
  );
}

// The ground alone, filling whatever holds it, in the pair of the screen
// it sits on unless told otherwise.
export function GroundLayer({ from, to }: { from?: GroundHue; to?: GroundHue }) {
  const pair = useContext(PairContext);
  return (
    <View style={[StyleSheet.absoluteFill, s.flat]} pointerEvents="none">
      <GroundGlow from={from ?? pair.from} to={to ?? pair.to} />
    </View>
  );
}

const GRAIN = require('../../assets/images/grain.png');
let glowIds = 0;

// Where the light ends, as a share of the screen, and how strong it is
// against a card's: a screen is taller than a card, so the same light is
// held lower to stay small.
const SCREEN_LIGHT_END = 0.38;
const SCREEN_STRENGTH = 0.7;
const SCREEN_POOL = 0.22;

// Today's ground: sky blue and white, in soft bands as the reference has
// them, a light band crossing from the lower left to the top, the blue
// gathered at the corners, and a fine grain. On dark the same sky at dusk.
const SKY = '#87CEFA';
function TodaySky() {
  const [id] = useState(() => `sky${glowIds++}`);
  const dark = G.mode === 'dark';
  const base = dark ? mix(SKY, FOOT, 0.32) : SKY;
  const white = dark ? mix('#FFFFFF', FOOT, 0.22) : '#FFFFFF';
  return (
    <>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <LinearGradient id={`${id}band`} x1="0" y1="1" x2="0.9" y2="0">
            <Stop offset="0" stopColor={white} stopOpacity={0.55} />
            <Stop offset="0.38" stopColor={white} stopOpacity={0.9} />
            <Stop offset="0.6" stopColor={white} stopOpacity={0.35} />
            <Stop offset="0.82" stopColor={white} stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id={`${id}top`} cx="0.55" cy="0" rx="0.4" ry="0.22" fx="0.55" fy="0">
            <Stop offset="0" stopColor={white} stopOpacity={0.85} />
            <Stop offset="1" stopColor={white} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}left`} cx="0.05" cy="0.28" rx="0.45" ry="0.22" fx="0.05" fy="0.28">
            <Stop offset="0" stopColor={base} stopOpacity={0.9} />
            <Stop offset="1" stopColor={base} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}corner`} cx="1" cy="0.85" rx="0.55" ry="0.3" fx="1" fy="0.85">
            <Stop offset="0" stopColor={base} stopOpacity={0.95} />
            <Stop offset="1" stopColor={base} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={base} />
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}band)`} />
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}top)`} />
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}left)`} />
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}corner)`} />
      </Svg>
      <Image source={GRAIN} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} accessible={false} />
    </>
  );
}

function GroundGlow({ from, to }: { from: GroundHue; to: GroundHue }) {
  const [id] = useState(() => `ground${glowIds++}`);
  // On light, every screen but Today is the flat #F1F0ED.
  if (G.mode === 'light') return null;
  const first = GLOW_OF[from] ?? GLOW_OF.measured;
  const second = GLOW_OF[to] ?? GLOW_OF.timeDepth;
  const foot = FOOT;
  const top = topFor([first, second]) * SCREEN_STRENGTH;
  return (
    <>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <LinearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={mix(first, foot, top)} />
            <Stop offset={SCREEN_LIGHT_END * 0.5} stopColor={mix(first, foot, top * 0.45)} />
            <Stop offset={SCREEN_LIGHT_END} stopColor={mix(first, foot, top * 0.12)} />
            <Stop offset="1" stopColor={foot} />
          </LinearGradient>
          <RadialGradient id={`${id}r`} cx="0.85" cy="0" rx="0.8" ry="0.3" fx="0.85" fy="0">
            <Stop offset="0" stopColor={second} stopOpacity={SCREEN_POOL * top * 2} />
            <Stop offset="1" stopColor={second} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}l)`} />
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}r)`} />
      </Svg>
      <Image source={GRAIN} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} />
    </>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: G.mid },
  flat: { backgroundColor: G.mid },
});
