// A sheet over a screen, on the same ground as every screen: the Ground's
// wash, the same type and the same Done. Any sheet in the app opens through
// this, so none falls back to a flat dark page of its own.

import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { font, GUTTER } from '../theme';
import { Ground, type GroundHue } from './Ground';
import { HUE, L } from './surface';

export function Sheet({
  visible,
  title,
  sub,
  onDone,
  onShow,
  from = 'measured',
  to = 'timeDepth',
  children,
}: {
  visible: boolean;
  title: string;
  sub?: string;
  onDone: () => void;
  onShow?: () => void;
  from?: GroundHue;
  to?: GroundHue;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={onShow} onRequestClose={onDone}>
      <Ground from={from} to={to}>
        <View style={s.head}>
          <Text style={[font('headline'), s.title]} accessibilityRole="header">
            {title}
          </Text>
          <Pressable onPress={onDone} accessibilityRole="button" hitSlop={10}>
            <Text style={[font('body', 'semibold'), s.done]}>Done</Text>
          </Pressable>
        </View>
        {sub ? <Text style={[font('footnote'), s.sub]}>{sub}</Text> : null}
        <ScrollView contentContainerStyle={s.body}>{children}</ScrollView>
      </Ground>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 8 },
  title: { color: L.ink },
  done: { color: HUE.measured },
  sub: { color: L.meta, paddingHorizontal: GUTTER },
  body: { paddingHorizontal: GUTTER, paddingBottom: 40 },
});
