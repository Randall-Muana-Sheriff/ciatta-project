// The one outline chip, as the body system cards set their topics: no
// fill, a hairline edge, white type. Used for every small control that
// sits inside a dark card (topics, sources, reactions) and as the edge of
// the metric tiles, so they all read as the same object.

import { StyleSheet } from 'react-native';

import { C } from '../theme';

export const chip = StyleSheet.create({
  // The pill.
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderSub },
  // A round one, for an icon alone.
  round: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderSub },
  // The same edge on a tile that holds more than a line.
  tile: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderSub },
  // Chosen: filled white, as a selected chip is everywhere in a card.
  on: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  text: { color: C.text },
});
