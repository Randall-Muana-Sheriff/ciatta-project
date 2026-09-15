import { ActionSheetIOS, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { healthCards } from '../data/sample';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { C, font, GUTTER, RADIUS } from '../theme';
import { LargeTitle, ListGroup, ListRow, SyncStatus, ToolbarButton } from '../ui/chrome';
import { Icon } from '../ui/icons';
import { images } from '../ui/images';
import { ChevronRight } from '../ui/kit';

const TONE = { coral: C.coral, mint: C.mint, lavender: C.lavender } as const;

export function MyHealthScreen() {
  const nav = useNav();
  const { startDraft } = useCycle();

  const logCycle = () => {
    startDraft();
    nav.push('cycleLog');
  };
  // Add to the record: a cycle experience or a note.
  const teach = () => {
    if (Platform.OS !== 'ios') return logCycle();
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Add to Your Record', options: ['Log Cycle Experience', 'Add a Note', 'Cancel'], cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) logCycle();
        if (i === 1) nav.push('journal');
      },
    );
  };

  return (
    <ScrollView style={h.fill} contentContainerStyle={h.body}>
      <LargeTitle
        title="Health"
        trailing={
          <>
            <SyncStatus />
            <ToolbarButton icon="plus" label="Add to Your Record" onPress={teach} />
          </>
        }
      />

      <View style={h.pad}>
        <Text style={[font('subhead'), { color: C.secondary, marginBottom: 20 }]}>
          Everything about your health, in one place.
        </Text>

        {healthCards.map((card) => (
          <Pressable
            key={card.screen}
            onPress={() => nav.push(card.screen)}
            accessibilityRole="button"
            style={({ pressed }) => [h.card, pressed && h.pressed]}
          >
            <Image source={images[card.image]} style={h.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
            <View style={h.cardText}>
              <Text style={[font('headline'), { color: C.text }]}>{displayCopy(card.title)}</Text>
              <Text style={[font('subhead'), { color: C.text, marginTop: 2 }]}>{displayCopy(card.value)}</Text>
              <Text style={[font('footnote'), { color: C.secondary }]}>{displayCopy(card.period)}</Text>
              <View style={h.meta}>
                <Icon name={card.metaIcon} size={14} color={TONE[card.tone]} weight={1.8} />
                <Text style={[font('caption1'), { color: C.secondary, flex: 1 }]} numberOfLines={2}>
                  {displayCopy(card.meta)}
                </Text>
              </View>
            </View>
            <ChevronRight />
          </Pressable>
        ))}

        <ListGroup style={{ marginTop: 16 }}>
          <ListRow
            first
            icon="layers"
            tint={C.indigo}
            title="Connected Sources"
            sub="Apple Health · Lab Records · Manual Entries"
            value="3"
            onPress={() => nav.goTab('profile')}
          />
        </ListGroup>
      </View>
    </ScrollView>
  );
}

const h = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: 32 },
  pad: { paddingHorizontal: GUTTER, paddingTop: 4 },
  pressed: { opacity: 0.55 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: RADIUS,
    padding: 12,
    paddingRight: 16,
    marginBottom: 12,
  },
  photo: { width: 88, height: 88, borderRadius: 8 },
  cardText: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
});
