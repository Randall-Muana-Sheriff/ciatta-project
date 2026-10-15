// Plans & Protocols: what she could do today, each with its reason in her
// own numbers, ticked off as she goes. A place in the corner menu rather
// than a section of Today, so Today stays Ciatta and her day.
//
// Drawn as it was on Today: one card, a tick and a row per item, and a
// plain line when nothing is earned today.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PlanKey } from '../lib/actionPlan';
import { displayCopy } from '../lib/displayCopy';
import { useTodayPlan } from '../state/todayPlan';
import { font, GUTTER } from '../theme';
import { CardFill } from '../ui/cardFill';
import { LargeTitle } from '../ui/chrome';
import { Icon, type IconName } from '../ui/icons';
import { G } from '../ui/scheme';
import { L, NAV_CLEARANCE, TILE_RADIUS, BLEED } from '../ui/surface';

const PLAN_ICON: Record<PlanKey, IconName> = {
  visit: 'calendarPlus',
  prepare: 'stethoscope',
  flow: 'drop',
  period: 'drop',
  recover: 'heartPulse',
  sleep: 'sleep',
  walk: 'steps',
  watch: 'target',
  log: 'plus',
};

export function PlansScreen() {
  const { plan, done, toggle, doItem } = useTodayPlan();
  const finished = plan.filter((p) => done.includes(p.key)).length;
  return (
    <ScrollView style={p.fill} contentContainerStyle={p.body}>
      <LargeTitle title="Plans & Protocols" />
      <View style={p.pad}>
        <Text style={[font('subhead'), p.lede]}>
          {plan.length ? `Today, from your own readings. ${finished} of ${plan.length} done.` : 'Today, from your own readings.'}
        </Text>
        {plan.length ? (
          <View style={p.plan}>
            <CardFill />
            {plan.map((item, n) => {
              const ticked = done.includes(item.key);
              return (
                <View key={item.key} style={[p.row, n > 0 && p.rule]}>
                  <Pressable
                    onPress={() => toggle(item.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: ticked }}
                    accessibilityLabel={`Mark ${item.title} done`}
                    hitSlop={8}
                    style={[p.tick, ticked && p.tickOn]}
                  >
                    {ticked ? <Icon name="check" size={14} color={L.onPill} weight={2} /> : null}
                  </Pressable>
                  <Pressable onPress={() => doItem(item)} accessibilityRole="button" style={({ pressed }) => [p.itemBody, pressed && p.pressed]}>
                    <View style={p.titleRow}>
                      <Icon name={PLAN_ICON[item.key]} size={16} color={ticked ? L.meta : L.ink} />
                      <Text style={[font('subhead', 'semibold'), ticked ? p.titleDone : p.title]}>{displayCopy(item.title)}</Text>
                    </View>
                    <Text style={[font('footnote'), p.why]}>{displayCopy(item.why)}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[p.plan, p.empty]}>
            <CardFill />
            <Icon name="check" size={20} color={L.meta} />
            <Text style={[font('subhead', 'semibold'), p.title]}>Nothing needs doing today</Text>
            <Text style={[font('footnote'), p.why, { textAlign: 'center' }]}>
              Your plan is built each morning from your sleep, heart, cycle and what you tell Ciatta. New items appear here as readings arrive.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const p = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: NAV_CLEARANCE },
  pad: { paddingHorizontal: GUTTER, paddingTop: 4 },
  lede: { color: G.body, marginBottom: 16 },
  plan: { backgroundColor: L.glass, paddingHorizontal: 14, overflow: 'hidden', ...BLEED },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: L.rule },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: L.meta,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tickOn: { backgroundColor: L.ink, borderColor: L.ink },
  itemBody: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: L.ink },
  titleDone: { color: L.meta, textDecorationLine: 'line-through' },
  why: { color: L.body, lineHeight: 19 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 22 },
  pressed: { opacity: 0.55 },
});
