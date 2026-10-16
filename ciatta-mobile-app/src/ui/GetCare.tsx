// Get care, as Lotus sets it: the heading with View all, then a row of
// round buttons, an icon in a ring over its name. View all opens the same
// five as a list on a card. Every one opens the chat with Ciatta.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { askCare, greetCare } from '../lib/careHandoff';
import { GET_CARE, type GetCareItem } from '../lib/getCare';
import { useNav } from '../navigation';
import { font, GUTTER } from '../theme';
import { Icon } from './icons';
import { G } from './scheme';
import { Sheet } from './Sheet';
import { HUE, SPACE } from './surface';

export function GetCare() {
  const nav = useNav();
  const [all, setAll] = useState(false);
  const go = (item: GetCareItem) => {
    setAll(false);
    if (item.opener) greetCare(item.opener);
    else if (item.ask) askCare(item.ask);
    nav.push('ciatta');
  };
  return (
    <View>
      <View style={g.head}>
        <Text style={[font('title3', 'semibold'), g.title]} accessibilityRole="header">
          Get care
        </Text>
        <Pressable onPress={() => setAll(true)} accessibilityRole="button" accessibilityLabel="View all ways to get care" hitSlop={8} style={g.all}>
          <Text style={[font('body', 'semibold'), g.allText]}>View all</Text>
          <Icon name="chevronRight" size={16} color={G.meta} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={g.rowWrap} contentContainerStyle={g.row}>
        {GET_CARE.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => go(item)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityHint="Opens the chat with Ciatta"
            style={({ pressed }) => [g.item, pressed && g.pressed]}
          >
            <View style={g.ring}>
              <Icon name={item.icon} size={24} color={G.ink} />
            </View>
            <Text style={[font('subhead', 'semibold'), g.label]} numberOfLines={2}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Sheet visible={all} title="Get care" onDone={() => setAll(false)}>
        <View style={g.card}>
          <Text style={[font('title3', 'semibold'), g.cardTitle]}>Get care</Text>
          {GET_CARE.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => go(item)}
              accessibilityRole="button"
              accessibilityHint="Opens the chat with Ciatta"
              style={({ pressed }) => [g.listRow, pressed && g.pressed]}
            >
              <Text style={[font('title3', 'semibold'), g.listText]}>{item.label}</Text>
              <Icon name="chevronRight" size={18} color={G.ink} />
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const g = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.near },
  title: { color: G.meta },
  all: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allText: { color: G.meta },
  rowWrap: { marginHorizontal: -GUTTER },
  row: { gap: 6, paddingHorizontal: GUTTER },
  item: { width: 96, alignItems: 'center', gap: 10 },
  // The ring: an icon in a circle, edged in Rose as the reference edges it.
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: HUE.reported,
    backgroundColor: '#FFFFFF',
  },
  label: { color: G.ink, textAlign: 'center', lineHeight: 19 },
  card: { marginTop: SPACE.near, padding: 20, borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: G.rule },
  cardTitle: { color: G.meta, marginBottom: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  listText: { color: G.ink, flex: 1 },
  pressed: { opacity: 0.6 },
});
