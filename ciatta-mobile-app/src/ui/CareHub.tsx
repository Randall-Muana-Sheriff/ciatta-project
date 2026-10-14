// Your Care: what is open in her plan, what happened lately, the requests
// she is making of her clinicians, her prescriptions, her labs, and her
// care team. Each section is a short card; each row opens where the work
// is done. Ciatta drafts and keeps track; she sends.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { askCare, openClinician, openRequest } from '../lib/careHandoff';
import { type RequestKind, STATUS_LABEL } from '../lib/care';
import { displayCopy } from '../lib/displayCopy';
import { SUGGEST_LABS } from '../lib/agent/labSuggest';
import { labDay } from '../lib/labs';
import { chooseLab } from '../lib/labHandoff';
import { chooseReferral } from '../lib/agent/handoff';
import { type Screen, useNav } from '../navigation';
import { useCareHub } from '../state/careHub';
import { font } from '../theme';
import { Eyebrow } from './bento';
import { Icon, type IconName } from './icons';
import { HUE, L, SPACE, TILE_RADIUS } from './surface';

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
  const draft = (kind: RequestKind, extra: { medication?: string; clinician?: string | null } = {}) => {
    openRequest({ draft: { kind, ...extra } });
    nav.push('careRequest');
  };

  return (
    <View style={s.stack}>
      {/* Open plan */}
      <Section title="Open plan">
        {hub.plan.length ? (
          hub.plan.map((p, n) => (
            <Row
              key={p.id}
              first={n === 0}
              icon="target"
              title={p.title}
              sub={p.sub}
              onPress={() => {
                if (p.id === 'requests' && hub.open[0]) {
                  openRequest({ id: hub.open[0].id });
                  return nav.push('careRequest');
                }
                if (p.lab) chooseLab(p.lab);
                if (p.referral) chooseReferral(p.referral, null);
                nav.push(p.screen as Screen);
              }}
            />
          ))
        ) : (
          <Empty text="Nothing open. Ciatta adds the next steps here as your record changes." />
        )}
      </Section>

      {/* Latest activity */}
      <Section title="Latest activity">
        {hub.activity.length ? (
          hub.activity.map((a, n) => <Row key={`${a.title}${a.at}`} first={n === 0} icon={a.icon as IconName} title={a.title} right={a.when} />)
        ) : (
          <Empty text="What you log, and what your providers send, shows here as it happens." />
        )}
      </Section>

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

      {/* Prescriptions */}
      <Section title="Prescriptions">
        {hub.rx.items.length ? (
          <>
            {hub.rx.items.map((m, n) => (
              <Row
                key={m.name}
                first={n === 0}
                icon="pill"
                title={m.name}
                sub={`${m.from === 'Provider' ? 'From your provider' : 'You added'}${m.last ? ` · last taken ${m.last}` : ''}`}
                right="Refill"
                onPress={() => draft('refill', { medication: m.name })}
              />
            ))}
            {hub.rx.missed ? <Text style={[font('footnote'), s.note]}>{`${hub.rx.missed} missed ${hub.rx.missed === 1 ? 'dose' : 'doses'} logged in the last 30 days.`}</Text> : null}
          </>
        ) : (
          <Empty text="Your medications show here, from your providers and your profile." />
        )}
      </Section>

      {/* Labs */}
      <Section title="Labs">
        {hub.latestDraw ? (
          <Row
            first
            icon="flask"
            title={`${hub.latestDraw.results.length} results, ${labDay(hub.latestDraw.on)}`}
            sub={hub.latestDraw.outside ? `${hub.latestDraw.outside} outside range` : 'All within range'}
            onPress={() => nav.push('healthrecords')}
          />
        ) : (
          <Empty text="No labs yet. Connect a provider or add a report." />
        )}
        <Pressable
          onPress={() => {
            askCare(SUGGEST_LABS);
            onAsk();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [s.ask, pressed && s.pressed]}
        >
          <Text style={[font('subhead'), s.meta]}>{'↳'}</Text>
          <Text style={[font('subhead', 'semibold'), s.ink, { flex: 1 }]}>Suggest the next labs worth asking about, based on my health data</Text>
        </Pressable>
        <View style={s.buttons}>
          <Small label="Add a Lab Report" onPress={() => nav.push('addLabs')} />
          {!hub.insurance ? <Small label="Add Insurance" onPress={() => nav.push('insurance')} /> : null}
        </View>
      </Section>

      {/* Your care team */}
      <Section title="Your care team">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.team}>
          {hub.team.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                openClinician(c.source === 'added' ? c.id : null);
                if (c.source !== 'added') openRequest({ draft: { kind: 'question', clinician: c.name } });
                nav.push(c.source === 'added' ? 'clinician' : 'careRequest');
              }}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}${c.role ? `, ${c.role}` : ''}`}
              style={({ pressed }) => [s.member, pressed && s.pressed]}
            >
              <View style={s.avatar}>
                <Text style={[font('headline'), s.ink]}>{c.initials}</Text>
              </View>
              <Text style={[font('subhead', 'semibold'), s.ink]} numberOfLines={1}>
                {displayCopy(c.name)}
              </Text>
              <Text style={[font('caption1'), s.meta]} numberOfLines={1}>
                {displayCopy(c.role ?? c.organization ?? 'From your calendar')}
              </Text>
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
            <View style={[s.avatar, s.addAvatar]}>
              <Icon name="plus" size={20} color={L.ink} />
            </View>
            <Text style={[font('subhead', 'semibold'), s.ink]}>Add</Text>
            <Text style={[font('caption1'), s.meta]}>A clinician</Text>
          </Pressable>
        </ScrollView>
      </Section>
    </View>
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
      <View style={s.card}>{children}</View>
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

function Small({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.small, pressed && s.pressed]}>
      <Text style={[font('footnote', 'semibold'), s.ink]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.hairlineWidth;
const s = StyleSheet.create({
  stack: { gap: 0 },
  section: { marginTop: SPACE.block },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { marginTop: SPACE.tight, backgroundColor: L.recessed, borderRadius: TILE_RADIUS, borderWidth: st, borderColor: L.rule, paddingHorizontal: 14 },
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
  buttons: { flexDirection: 'row', gap: 8, paddingBottom: 14 },
  small: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 999, backgroundColor: L.statement },
  team: { gap: 10, paddingVertical: 14 },
  member: { width: 124, gap: 4 },
  addMember: {},
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: L.statement, marginBottom: 6, borderWidth: st, borderColor: HUE.timeDepth },
  addAvatar: { borderStyle: 'dashed', borderColor: L.meta },
  pressed: { opacity: 0.6 },
});
