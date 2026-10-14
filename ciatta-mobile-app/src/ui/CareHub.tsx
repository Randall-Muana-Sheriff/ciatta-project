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
import { Eyebrow } from './bento';
import { Icon, type IconName } from './icons';
import { images } from './images';
import { PhotoCard } from './PhotoCard';
import { L, SPACE, TILE_RADIUS } from './surface';
import { GlassFill } from './frosted';

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
      {/* Open plan: the hero of Your Care, as Lotus sets its plan. The
          first step as a statement, the white pill to start it, and the
          rest beneath; or, with nothing open, all caught up. */}
      <View style={s.section}>
        <PhotoCard source={images.carePlan} style={{ minHeight: 300 }}>
          <Icon name="sparkle" size={20} color="#FFFFFF" />
          <View style={{ flex: 1, minHeight: 60 }} />
          {hub.plan.length ? (
            <>
              <Text style={[font('footnote', 'semibold'), s.whiteMeta]}>{`Open plan · ${hub.plan.length} ${hub.plan.length === 1 ? 'step' : 'steps'}`}</Text>
              <Text style={[font('title2', 'semibold'), s.white, s.statement]}>{displayCopy(hub.plan[0].title)}</Text>
              {hub.plan[0].sub ? <Text style={[font('subhead'), s.whiteMeta]}>{displayCopy(hub.plan[0].sub)}</Text> : null}
              <WhiteButton label="Open plan" onPress={() => go(hub.plan[0])} />
              {hub.plan.slice(1).map((p) => (
                <Pressable key={p.id} onPress={() => go(p)} accessibilityRole="button" style={({ pressed }) => [s.planStep, pressed && s.pressed]}>
                  <Text style={[font('subhead'), s.white, { flex: 1 }]} numberOfLines={2}>
                    {displayCopy(p.title)}
                  </Text>
                  <Icon name="chevronRight" size={14} color="rgba(255,255,255,0.7)" />
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Text style={[font('title2', 'semibold'), s.white, s.statement]}>You are all caught up</Text>
              <Text style={[font('subhead'), s.whiteMeta]}>Next steps needing your attention will appear here as your record changes.</Text>
            </>
          )}
        </PhotoCard>
      </View>

      {/* Open requests */}
      <Section title="Open requests" action={{ label: choosing ? 'Close' : 'New', onPress: () => setChoosing((v) => !v) }}>
        {choosing ? (
          <View style={s.kinds}>
            {NEW_KINDS.map((k) => (
              <Pressable key={k.kind} onPress={() => draft(k.kind)} accessibilityRole="button" style={({ pressed }) => [s.kind, pressed && s.pressed]}>
                <Text style={[font('footnote', 'semibold'), s.ink]}>{k.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {hub.open.length ? (
          hub.open.map((r, n) => (
            <Row
              key={r.id}
              first={n === 0 && !choosing}
              icon={r.status === 'sent' ? 'send' : 'doc'}
              title={r.title}
              sub={r.clinician}
              pill={STATUS_LABEL[r.status]}
              onPress={() => {
                openRequest({ id: r.id });
                nav.push('careRequest');
              }}
            />
          ))
        ) : !choosing ? (
          <Empty text="Ask your clinician for a refill, labs, your records or a referral. Ciatta drafts it; you send it." />
        ) : null}
      </Section>

      {/* Prescriptions, as Lotus sets it: on a photograph, what is on
          file, and a line that asks the concierge. */}
      <View style={s.section}>
        <PhotoCard source={images.careRx}>
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
        </PhotoCard>
      </View>

      {/* Labs */}
      <View style={s.section}>
        <PhotoCard source={images.careLabs}>
          <Text style={[font('headline'), s.white]}>Labs</Text>
          <Text style={[font('footnote'), s.whiteMeta]}>From your providers and your reports</Text>
          <Pressable onPress={() => (hub.latestDraw ? nav.push('healthrecords') : undefined)} disabled={!hub.latestDraw}>
            <Text style={[font('title3', 'semibold'), s.white, s.statement]}>
              {displayCopy(
                hub.latestDraw
                  ? `${hub.latestDraw.results.length} results ${labDay(hub.latestDraw.on).toLowerCase().startsWith('on') ? '' : 'from '}${labDay(hub.latestDraw.on)}. ${hub.latestDraw.outside ? `${hub.latestDraw.outside} outside range.` : 'All within range.'}`
                  : 'No labs yet. Ask your concierge which are worth asking your clinician for.',
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
        </PhotoCard>
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
              <PhotoCard source={TEAM_PHOTOS[n % TEAM_PHOTOS.length]} style={s.member} shade={0.72}>
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
              </PhotoCard>
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
            <GlassFill />
            <Icon name="plus" size={26} color={L.ink} />
            <Text style={[font('headline'), s.ink]}>Add a clinician</Text>
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
      <Text style={[font('subhead', 'semibold'), { color: '#0C0E11' }]}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.head}>
        <Eyebrow>{title}</Eyebrow>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8}>
            <Text style={[font('footnote', 'semibold'), s.body]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={s.card}><GlassFill />{children}</View>
    </View>
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
        <Text style={[font('subhead'), s.ink]} numberOfLines={2}>
          {displayCopy(title)}
        </Text>
        {sub ? (
          <Text style={[font('caption1'), s.meta]} numberOfLines={1}>
            {displayCopy(sub)}
          </Text>
        ) : null}
      </View>
      {pill ? (
        <View style={s.pill}>
          <Text style={[font('caption2', 'semibold'), s.ink]}>{pill}</Text>
        </View>
      ) : null}
      {right ? <Text style={[font('caption1'), s.meta]}>{right}</Text> : null}
      {onPress ? <Icon name="chevronRight" size={14} color={L.meta} /> : null}
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={[font('subhead'), s.empty]}>{text}</Text>;
}


const st = StyleSheet.hairlineWidth;
const s = StyleSheet.create({
  stack: { gap: 0 },
  section: { marginTop: SPACE.block },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, borderRadius: TILE_RADIUS, borderWidth: st, borderColor: L.rule, paddingHorizontal: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rule: { borderTopWidth: st, borderTopColor: L.rule },
  ink: { color: L.ink },
  body: { color: L.body },
  meta: { color: L.meta },
  note: { color: L.meta, paddingBottom: 12 },
  empty: { color: L.body, lineHeight: 21, paddingVertical: 14 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: L.statement },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 },
  kind: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: st, borderColor: L.rule, backgroundColor: L.statement },
  ask: { flexDirection: 'row', gap: 8, paddingVertical: 12, borderTopWidth: st, borderTopColor: L.rule },
  team: { gap: 12, paddingVertical: 14 },
  member: { width: 172, height: 232 },
  addMember: { borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: L.meta, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: L.glass, overflow: 'hidden' },
  pressed: { opacity: 0.6 },
  planStep: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)' },
  white: { color: '#FFFFFF' },
  whiteMeta: { color: 'rgba(255,255,255,0.72)' },
  statement: { marginTop: 6, lineHeight: 28 },
  askLine: { flexDirection: 'row', gap: 8, marginTop: 4 },
  inner: { marginTop: 8, padding: 14, gap: 6, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  whiteButton: { marginTop: 8, minHeight: 46, borderRadius: 999, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  teamLede: { color: L.body, marginTop: 8, lineHeight: 22 },
  initials: { color: 'rgba(255,255,255,0.9)', fontSize: 44, fontWeight: '300', letterSpacing: 2 },
  memberFill: { flex: 1, minHeight: 120, justifyContent: 'center' },
});
