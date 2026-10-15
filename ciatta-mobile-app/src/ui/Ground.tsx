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
}: {
  children?: ReactNode;
  from?: GroundHue;
  to?: GroundHue;
}) {
  // Hands each card on this screen its own place in the photo pool, in the
  // order the cards mount, so no two cards on a screen share a background
  // and the same screen opens with the same ones.
  const count = useRef(0);
  const next = () => count.current++;
  return (
    <PairContext.Provider value={{ from, to, next }}>
      <View style={s.fill}>
        <GroundGlow from={from} to={to} />
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

function GroundGlow({ from, to }: { from: GroundHue; to: GroundHue }) {
  const [id] = useState(() => `ground${glowIds++}`);
  const first = GLOW_OF[from] ?? GLOW_OF.measured;
  const second = GLOW_OF[to] ?? GLOW_OF.timeDepth;
  // On light, the same light over paper: the hue tints the top and fades
  // into the light ground, so dark type keeps its contrast. On dark, it
  // falls into the dark.
  const light = G.mode === 'light';
  const foot = light ? G.mid : FOOT;
  const top = light ? 0.16 : topFor([first, second]) * SCREEN_STRENGTH;
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
      {light ? null : <Image source={GRAIN} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} />}
    </>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: G.mid },
  flat: { backgroundColor: G.mid },
});
