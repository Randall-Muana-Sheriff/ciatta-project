// Your Care: what is open in her plan, what happened lately, the requests
// she is making of her clinicians, her prescriptions, her labs, and her
// care team. Each section is a short card; each row opens where the work
// is done. Ciatta drafts and keeps track; she sends.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { askCare, openClinician, openRequest } from '../lib/careHandoff';
import { type PlanStep, type RequestKind, STATUS_LABEL } from '../lib/care';
import { displayCopy } from '../lib/displayCopy';
import { SUGGEST_LABS } from '../lib/agent/labSuggest';
import { REFILL } from '../lib/agent/connect';
import { labDay } from '../lib/labs';
import { chooseLab } from '../lib/labHandoff';
import { chooseReferral } from '../lib/agent/handoff';
import { type Screen, useNav } from '../navigation';
import { useCareHub } from '../state/careHub';
import { font } from '../theme';
import { Icon, type IconName } from './icons';
import { images } from './images';
import { CardFill } from './cardFill';
import { L, SPACE, TILE_RADIUS } from './surface';
import { G } from './scheme';

const NEW_KINDS: { kind: RequestKind; label: string }[] = [
  { kind: 'refill', label: 'Refill' },
  { kind: 'labs', label: 'Labs' },
  { kind: 'records', label: 'Records' },
  { kind: 'referral', label: 'Referral' },
  { kind: 'question', label: 'Question' },
];

export function CareHub({ onAsk }: { onAsk: () => void }) {
  const nav = useNav();
  const hub = useCareHub();
  const [choosing, setChoosing] = useState(false);
  // Where a plan step is done.
  const go = (p: PlanStep) => {
    if (p.id === 'requests' && hub.open[0]) {
      openRequest({ id: hub.open[0].id });
      return nav.push('careRequest');
    }
    if (p.lab) chooseLab(p.lab);
    if (p.referral) chooseReferral(p.referral, null);
    nav.push(p.screen as Screen);
  };
  const draft = (kind: RequestKind, extra: { medication?: string; clinician?: string | null } = {}) => {
    openRequest({ draft: { kind, ...extra } });
    nav.push('careRequest');
  };

  return (
    <View style={s.stack}>
      {/* Prescriptions, as Lotus sets it: on a photograph, what is on
          file, and a line that asks the concierge. */}
      <View style={s.section}>
        <View style={s.glow}>
          <CardFill />
          <Text style={[font('headline'), s.white]}>Prescriptions</Text>
          <Text style={[font('footnote'), s.whiteMeta]}>From your providers and your profile</Text>
          <Text style={[font('title3', 'semibold'), s.white, s.statement]}>
            {displayCopy(
              hub.rx.items.length
                ? `${listNames(hub.rx.items.map((m) => m.name))} on file.${hub.rx.items[0].last ? ` Last taken ${hub.rx.items[0].last}.` : ''}`
                : 'No prescriptions on file yet. Refill or ask about one by simply asking.',
            )}
          </Text>
          <AskLine
            text="Refill an existing prescription or ask about a new one"
            onPress={() => {
              askCare(REFILL);
              onAsk();
            }}
          />
          {hub.rx.missed ? <Text style={[font('footnote'), s.whiteMeta]}>{`${hub.rx.missed} missed ${hub.rx.missed === 1 ? 'dose' : 'doses'} logged in the last 30 days.`}</Text> : null}
        </View>
      </View>

      {/* Labs */}
      <View style={s.section}>
        <View style={s.glow}>
          <CardFill />
          <Text style={[font('headline'), s.white]}>Labs</Text>
          <Text style={[font('footnote'), s.whiteMeta]}>From your providers and your reports</Text>
          <Pressable onPress={() => (hub.latestDraw ? nav.push('healthrecords') : undefined)} disabled={!hub.latestDraw} accessibilityRole="button" accessibilityHint="Opens your lab results">
            <Text style={[font('title3', 'semibold'), s.white, s.statement]}>
              {displayCopy(
                hub.latestDraw
                  ? `${hub.latestDraw.results.length} results ${labDay(hub.latestDraw.on).toLowerCase().startsWith('on') ? '' : 'from '}${labDay(hub.latestDraw.on)}. ${hub.latestDraw.outside ? `${hub.latestDraw.outside} outside range.` : 'All within range.'}`
                  : 'No labs yet. Ask Ciatta which are worth asking your clinician for.',
              )}
            </Text>
          </Pressable>
          <AskLine
            text="Suggest the next labs worth asking about, based on my health data"
            onPress={() => {
              askCare(SUGGEST_LABS);
              onAsk();
            }}
          />
          <View style={s.inner}>
            {hub.insurance ? (
              <>
                <Text style={[font('subhead', 'semibold'), s.white]}>Have a report?</Text>
                <Text style={[font('footnote'), s.whiteMeta]}>Add a photo or PDF, and Ciatta reads it into your record.</Text>
                <WhiteButton label="Add a lab report" onPress={() => nav.push('addLabs')} />
              </>
            ) : (
              <>
                <Text style={[font('subhead', 'semibold'), s.white]}>Please add an insurance plan</Text>
                <Text style={[font('footnote'), s.whiteMeta]}>So a lab request can name your plan.</Text>
                <WhiteButton label="Add insurance" onPress={() => nav.push('insurance')} />
              </>
            )}
          </View>
        </View>
      </View>

      {/* Your care team, as Lotus sets it: the heading, a line, and tall
          cards with the name across the foot. Her own clinicians. */}
      <View style={s.section}>
        <Text style={[font('title3', 'semibold'), s.ink]} accessibilityRole="header">
          Meet your care team
        </Text>
        <Text style={[font('subhead', 'semibold'), s.teamLede]}>
          The clinicians in your record, from your providers, referrals and visits. Ciatta gets each request ready, and you send it.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.team}>
          {hub.team.map((c, n) => (
            <Pressable
              key={c.id}
              onPress={() => {
                openClinician(c.source === 'added' ? c.id : null);
                if (c.source !== 'added') openRequest({ draft: { kind: 'question', clinician: c.name } });
                nav.push(c.source === 'added' ? 'clinician' : 'careRequest');
              }}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}${c.role ? `, ${c.role}` : ''}`}
              style={({ pressed }) => [pressed && s.pressed]}
            >
              <View style={[s.glow, s.member]}>
                <CardFill />
                <View style={s.memberFill}>
                  <Text style={[s.initials]}>{c.initials}</Text>
                </View>
                {/* First and last name, then specialty, as Lotus names its
                    clinicians; where they practise below. */}
                <Text style={[font('headline'), s.white]} numberOfLines={2}>
                  {displayCopy(c.name)}
                </Text>
                <Text style={[font('footnote', 'semibold'), s.whiteMeta]} numberOfLines={1}>
                  {displayCopy(c.source === 'provider' ? 'Your provider' : (c.role ?? 'Specialty not added'))}
                </Text>
                {c.organization && c.organization !== c.name ? (
                  <Text style={[font('caption1'), s.whiteMeta]} numberOfLines={1}>
                    {displayCopy(c.organization)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              openClinician(null);
              nav.push('clinician');
            }}
            accessibilityRole="button"
            accessibilityLabel="Add a clinician"
            style={({ pressed }) => [s.member, s.addMember, pressed && s.pressed]}
          >
            <CardFill />
            <Icon name="plus" size={26} color={L.ink} />
            <Text style={[font('headline'), s.cardInk]}>Add a clinician</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const TEAM_PHOTOS = [images.team1, images.team2, images.team3, images.team4];
const listNames = (xs: string[]) => (xs.length < 2 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs[0]}, ${xs[1]} and ${xs.length - 2} more`);

// The line under a card that asks the concierge, as Lotus marks it.
function AskLine({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.askLine, pressed && s.pressed]}>
      <Text style={[font('subhead'), s.whiteMeta]}>{'\u21B3'}</Text>
      <Text style={[font('subhead', 'semibold'), s.white, { flex: 1 }]}>{text}</Text>
    </Pressable>
  );
}

function WhiteButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.whiteButton, pressed && s.pressed]}>
      <Text style={[font('subhead', 'semibold'), { color: L.onPill }]}>{label}</Text>
    </Pressable>
  );
}


function Row({
  icon,
  title,
  sub,
  right,
  pill,
  first,
  onPress,
}: {
  icon: IconName;
  title: string;
  sub?: string | null;
  right?: string;
  pill?: string;
  first?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [s.row, !first && s.rule, pressed && onPress && s.pressed]}>
      <Icon name={icon} size={18} color={L.body} />
      <View style={{ flex: 1 }}>
        <Text style={[font('subhead', 'semibold'), s.white]} numberOfLines={2}>
          {displayCopy(title)}
        </Text>
        {sub ? (
          <Text style={[font('footnote'), s.whiteMeta]} numberOfLines={1}>
            {displayCopy(sub)}
          </Text>
        ) : null}
      </View>
      {pill ? (
        <View style={s.pill}>
          <Text style={[font('caption2', 'semibold'), s.white]}>{pill}</Text>
        </View>
      ) : null}
      {right ? <Text style={[font('caption1'), s.whiteMeta]}>{right}</Text> : null}
      {onPress ? <Icon name="chevronRight" size={14} color={L.meta} /> : null}
    </Pressable>
  );
}



const st = StyleSheet.hairlineWidth;
const s = StyleSheet.create({
  stack: { gap: 0 },
  // The cards as Labs and every other card are drawn: the soft glow, in
  // the mode's shade, rounded, with a hairline.
  glow: { borderRadius: TILE_RADIUS, overflow: 'hidden', padding: 18, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule },
  section: { marginTop: SPACE.block },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, paddingHorizontal: 14, overflow: 'hidden', borderRadius: TILE_RADIUS },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rule: { borderTopWidth: st, borderTopColor: L.rule },
  ink: { color: G.ink },
  cardInk: { color: L.ink },
  body: { color: G.body },
  meta: { color: G.meta },
  note: { color: L.meta, paddingBottom: 12 },
  empty: { color: G.body, lineHeight: 21, paddingVertical: 14 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: L.recessed },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 },
  kind: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  smallWhite: { backgroundColor: '#FFFFFF', borderRadius: 999, minHeight: 32, paddingHorizontal: 14, justifyContent: 'center' },
  ask: { flexDirection: 'row', gap: 8, paddingVertical: 12, borderTopWidth: st, borderTopColor: L.rule },
  team: { gap: 12, paddingVertical: 14 },
  member: { width: 172, height: 232 },
  addMember: { borderRadius: TILE_RADIUS, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: L.glass, overflow: 'hidden' },
  pressed: { opacity: 0.6 },
  planStep: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)' },
  // Type on the glow cards, which follow the mode: dark on light, light
  // on dark.
  white: { color: L.ink },
  whiteMeta: { color: L.body },
  statement: { marginTop: 6, lineHeight: 28 },
  askLine: { flexDirection: 'row', gap: 8, marginTop: 4 },
  inner: { marginTop: 8, padding: 14, gap: 6, borderRadius: 18, backgroundColor: L.recessed, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule },
  // The one button in a card: the card's pill, solid, the inverse of it.
  whiteButton: { marginTop: 8, minHeight: 46, borderRadius: 999, backgroundColor: L.pill, alignItems: 'center', justifyContent: 'center' },
  teamLede: { color: G.body, marginTop: 8, lineHeight: 22 },
  initials: { color: L.meta, fontSize: 44, fontWeight: '300', letterSpacing: 2 },
  memberFill: { flex: 1, minHeight: 120, justifyContent: 'center' },
});
