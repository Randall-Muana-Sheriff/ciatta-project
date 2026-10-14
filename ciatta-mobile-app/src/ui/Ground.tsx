// The ground every screen stands on: flat, #161616 on dark and #F1F0ED on
// light. The mood moved into the cards. A screen still names its two hues,
// and every content card on it is lit in that pair (see CardFill), so a
// screen keeps its colour without the ground fighting what sits on it.

import { createContext, type ReactNode, useContext, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

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
      <View style={s.fill}>{children}</View>
    </PairContext.Provider>
  );
}

// The ground alone, filling whatever holds it.
export function GroundLayer(_: { from?: GroundHue; to?: GroundHue }) {
  return <View style={[StyleSheet.absoluteFill, s.flat]} pointerEvents="none" />;
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: G.mid },
  flat: { backgroundColor: G.mid },
});
