// The chat, resting at the foot of Today: the box she talks to Ciatta in,
// a short card rather than a page. Tapping it, or the microphone, opens
// the chat over the whole screen; closing it brings her back here.

import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, GUTTER } from '../theme';
import { CardFill } from './cardFill';
import { Icon } from './icons';
import { G } from './scheme';

// Half the height the Pattern Insights sheet rested at.
export const CHAT_CARD_SHARE = 0.22;

export function ChatCard({ onOpen }: { onOpen: () => void }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel="Open the chat with Ciatta"
      style={[c.card, { height: Math.round(height * CHAT_CARD_SHARE), paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <CardFill />
      <Text style={[font('body'), c.placeholder]}>Ask Ciatta</Text>
      <View style={{ flex: 1 }} />
      <View style={c.foot}>
        <View style={c.round}>
          <Icon name="plus" size={18} color={G.body} />
        </View>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Talk to Ciatta" hitSlop={8} style={c.mic}>
          <Icon name="mic" size={20} color={G.onPill} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const c = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: 18,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  placeholder: { color: G.meta },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  mic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: G.pill },
});
