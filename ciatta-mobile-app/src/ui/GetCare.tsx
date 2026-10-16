// Get care, as Lotus sets it: View all, then a row of round buttons, an
// icon in a ring over its name. Each opens a sheet that slides up, as
// Profile's details do, with real choices, endometriosis first and then
// the whole body; choosing one asks Ciatta in the chat. View all opens the
// five as a list. A back arrow always leads back.

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { askCare } from '../lib/careHandoff';
import { type CareChoice, GET_CARE, type GetCareItem } from '../lib/getCare';
import { useNav } from '../navigation';
import { font, GUTTER } from '../theme';
import { Ground } from './Ground';
import { Icon } from './icons';
import { G } from './scheme';
import { HUE, SPACE } from './surface';

// What the sheet shows: the list of all five, or one category. from says
// where back leads.
type Step = { at: 'all' } | { at: 'category'; item: GetCareItem; from: 'all' | 'row' };

export function GetCare() {
  const nav = useNav();
  const [step, setStep] = useState<Step | null>(null);
  const choose = (choice: CareChoice) => {
    setStep(null);
    askCare(choice.ask);
    nav.push('ciatta');
  };
  const back = () => {
    if (step?.at === 'category' && step.from === 'all') setStep({ at: 'all' });
    else setStep(null);
  };
  return (
    <View>
      <View style={g.head}>
        <Pressable onPress={() => setStep({ at: 'all' })} accessibilityRole="button" accessibilityLabel="View all ways to get care" hitSlop={8} style={g.all}>
          <Text style={[font('body', 'semibold'), g.allText]}>View all</Text>
          <Icon name="chevronRight" size={16} color={G.meta} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={g.rowWrap} contentContainerStyle={g.row}>
        {GET_CARE.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setStep({ at: 'category', item, from: 'row' })}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityHint="Shows the choices, each asked of Ciatta in the chat"
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

      <Modal visible={step !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={back}>
        <Ground>
          <View style={g.sheetHead}>
            <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={g.backButton}>
              <Icon name="chevronLeft" size={22} color={G.ink} />
            </Pressable>
            <Text style={[font('headline'), g.sheetTitle]} accessibilityRole="header" numberOfLines={1}>
              {step?.at === 'category' ? step.item.label : 'Get care'}
            </Text>
            <View style={g.backButton} />
          </View>
          <ScrollView contentContainerStyle={g.sheetBody}>
            {step?.at === 'category' ? (
              step.item.groups.map((group) => (
                <View key={group.title} style={g.card}>
                  <Text style={[font('subhead', 'semibold'), g.cardTitle]}>{group.title}</Text>
                  {group.items.map((choice, n) => (
                    <Pressable
                      key={choice.label}
                      onPress={() => choose(choice)}
                      accessibilityRole="button"
                      accessibilityHint="Asks Ciatta in the chat"
                      style={({ pressed }) => [g.listRow, n > 0 && g.rule, pressed && g.pressed]}
                    >
                      <Text style={[font('body'), g.listText]}>{choice.label}</Text>
                      <Icon name="chevronRight" size={16} color={G.meta} />
                    </Pressable>
                  ))}
                </View>
              ))
            ) : (
              <View style={g.card}>
                {GET_CARE.map((item, n) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setStep({ at: 'category', item, from: 'all' })}
                    accessibilityRole="button"
                    style={({ pressed }) => [g.listRow, g.bigRow, n > 0 && g.rule, pressed && g.pressed]}
                  >
                    <Text style={[font('title3', 'semibold'), g.listText]}>{item.label}</Text>
                    <Icon name="chevronRight" size={18} color={G.ink} />
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </Ground>
      </Modal>
    </View>
  );
}

const g = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: SPACE.near },
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
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 14, paddingBottom: 6 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { color: G.ink, flex: 1, textAlign: 'center' },
  sheetBody: { paddingHorizontal: GUTTER, paddingBottom: 40, gap: SPACE.near },
  card: { padding: 18, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: G.rule },
  cardTitle: { color: G.meta, marginBottom: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50 },
  bigRow: { minHeight: 60 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: G.rule },
  listText: { color: G.ink, flex: 1 },
  pressed: { opacity: 0.6 },
});
