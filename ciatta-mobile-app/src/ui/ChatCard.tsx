// The chat, resting at the foot of Today: the same box the chat uses, live
// right here. She types, speaks or attaches without leaving Today; only
// when she sends does the chat open over the whole screen, with what she
// sent already in it. Closing the chat brings her back here.
//
// It rises with the keyboard, so the box stays in view while she writes.

import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Attachment } from '../lib/attachments';
import { askCare } from '../lib/careHandoff';
import { GUTTER } from '../theme';
import { CardFill } from './cardFill';
import { Composer } from './composer';

// Half the height the Pattern Insights sheet rested at.
export const CHAT_CARD_SHARE = 0.22;

export function ChatCard({ onSent }: { onSent: () => void }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      Animated.timing(lift, { toValue: e.endCoordinates.height - insets.bottom, duration: e.duration || 220, useNativeDriver: true }).start();
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      Animated.timing(lift, { toValue: 0, duration: e?.duration || 220, useNativeDriver: true }).start();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [lift, insets.bottom]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    askCare(text, files);
    setDraft('');
    setFiles([]);
    Keyboard.dismiss();
    onSent();
  };

  return (
    <Animated.View
      style={[
        c.card,
        {
          minHeight: Math.round(height * CHAT_CARD_SHARE),
          paddingBottom: Math.max(insets.bottom, 12),
          transform: [{ translateY: Animated.multiply(lift, -1) }],
        },
      ]}
    >
      <CardFill />
      <Composer
        value={draft}
        onChange={setDraft}
        placeholder="Ask Ciatta"
        label="Ask Ciatta, or tell it how you feel"
        attachments={files}
        onAttachments={setFiles}
        onSend={send}
      />
    </Animated.View>
  );
}

const c = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
});
