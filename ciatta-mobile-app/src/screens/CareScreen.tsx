// Care: the agent, as a surface.
//
// Everything that decides what is said lives in lib/agent and is pure.
// This file renders turns, assembles the Record a capability is allowed to
// read, and nothing else. If a sentence appears here that lib/agent did not
// write, that is a bug.
//
// Two things the interface owes her that the logic cannot:
//
//   Say where a sentence came from. A fact she reported and a fact an
//   instrument measured are different, and the dots under each answer say
//   which, rather than leaving her to assume.
//
//   Say when Ciatta did not answer. An abstention renders as an abstention
//   and not as a reply, because "there is not enough yet" reads very
//   differently from a confident sentence of the same length.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { respond, type Record as AgentRecord } from '../lib/agent/capabilities';
import { classify } from '../lib/agent/classify';
import { wordOrFallback } from '../lib/agent/check';
import { buildRecord } from '../lib/agent/record';
import type { Fact, Turn } from '../lib/agent/types';
import { countedWindows, cycleToday, medianLength } from '../lib/cycleModel';
import { displayCopy } from '../lib/displayCopy';
import { type Screen, useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData, useRepo } from '../state/session';
import type { Reported } from '../data/repo';
import { font, GUTTER } from '../theme';
import { Eyebrow } from '../ui/bento';
import { Composer } from '../ui/composer';
import { Wordmark } from '../ui/Wordmark';
import { HUE, L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';

// What she can ask, shown rather than described. A chat box with no
// suggestions is a test she has to pass before the thing is useful, and the
// honest set is also the clearest statement of what this does.
const OPENERS = [
  'What is in my record today?',
  'Has anything changed?',
  'What should I ask my doctor?',
  'Who should I see about this?',
];

const DOT: Record<Fact['from'], string> = {
  measured: HUE.measured,
  reported: HUE.reported,
  derived: HUE.timeDepth,
  reference: HUE.evidence,
};

const FROM_LABEL: Record<Fact['from'], string> = {
  measured: 'Measured',
  reported: 'You said',
  derived: 'Counted',
  reference: 'Source',
};

export function CareScreen() {
  const nav = useNav();
  const { person, days } = useData();
  const { episodes } = useCycle();
  const { windows, lens, profile } = useCycleInsights();
  // Already ranked and already gated. The agent speaks about these; it
  // never finds one of its own.
  const { ranked } = useInsights();
  const repo = useRepo();

  // What she told Ciatta at onboarding. Null until the read lands, which
  // buildRecord treats as unknown rather than as an empty history.
  const [reported, setReported] = useState<Reported | null>(null);
  useEffect(() => {
    let ignore = false;
    repo
      .loadReported()
      .then((r) => {
        if (!ignore) setReported(r);
      })
      .catch(() => {
        // Left null. The capabilities abstain, which is the honest state
        // when the read failed: Ciatta does not know, rather than knows
        // there is nothing.
      });
    return () => {
      ignore = true;
    };
  }, [repo]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollView | null>(null);

  // Everything a capability may read, and nothing more. Assembled here so
  // the boundary is one object in one place rather than a set of imports
  // scattered through lib/agent.
  // useData().today is the written brief, not a row. The agent needs the
  // row, which is the same lookup Today does.
  const todayRow = useMemo(() => {
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return days.find((x) => x.date === key) ?? null;
  }, [days]);

  const record: AgentRecord = useMemo(() => {
    const open = windows[windows.length - 1] ?? null;
    const predicted = lens.predicts ? medianLength(countedWindows(windows, profile)) : null;
    const now = cycleToday(open && !open.end ? open : null, predicted, new Date());
    return buildRecord({
      name: person?.firstName ?? null,
      today: todayRow,
      days,
      episodes,
      reported,
      insights: ranked,
      // Empty until research_refs holds reviewed rows. Context abstains.
      references: [],
      cycleDay: now?.day ?? null,
      cyclePhase: now?.phase ?? null,
    });
  }, [person, todayRow, days, episodes, reported, ranked, windows, lens, profile]);

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message) return;
      const at = new Date().toISOString();
      const capability = classify(message);
      const answer = respond(message, record, capability);
      // No backend reached yet, so there is no rewrite to weigh and the
      // deterministic sentence stands. wordOrFallback is still the only
      // path to the text, so wiring the model later changes one argument
      // and nothing else.
      const { text: said, worded } = wordOrFallback(answer, null);

      setTurns((prev) => [
        ...prev,
        { id: `${at}-her`, role: 'her', text: message, at },
        { id: `${at}-ciatta`, role: 'ciatta', text: said, at, answer, worded },
      ]);
      setDraft('');
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    },
    [record],
  );

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroller} style={s.fill} contentContainerStyle={s.body} keyboardDismissMode="interactive">
        <View style={s.head}>
          <Wordmark />
        </View>

        {turns.length === 0 ? <Opening onPick={send} name={person?.firstName ?? null} /> : null}

        {turns.map((turn) =>
          turn.role === 'her' ? (
            <View key={turn.id} style={s.hers}>
              <Text style={[font('body'), s.hersText]}>{turn.text}</Text>
            </View>
          ) : (
            <AnswerBlock key={turn.id} turn={turn} onOpen={(screen) => nav.push(screen as Screen)} />
          ),
        )}
      </ScrollView>

      <View style={s.composer}>
        <Composer
          value={draft}
          onChange={setDraft}
          placeholder="Ask about your record"
          label="Ask Ciatta"
          onSend={() => send(draft)}
          minHeight={92}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Opening({ name, onPick }: { name: string | null; onPick: (text: string) => void }) {
  return (
    <View style={s.opening}>
      <Text style={[font('title2'), s.greet]} accessibilityRole="header">
        {displayCopy(name ? `${name}, what would you like to know?` : 'What would you like to know?')}
      </Text>
      <Text style={[font('body'), s.lede]}>
        Ciatta answers from your own record and says so when there is not enough in it yet. It does not practise
        medicine, and it will not tell you what is wrong with you.
      </Text>
      <View style={s.openers}>
        {OPENERS.map((o) => (
          <Pressable
            key={o}
            onPress={() => onPick(o)}
            accessibilityRole="button"
            style={({ pressed }) => [s.opener, pressed && s.pressed]}
          >
            <Text style={[font('subhead'), s.openerText]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function AnswerBlock({ turn, onOpen }: { turn: Turn; onOpen: (screen: string) => void }) {
  const a = turn.answer;
  if (!a) return null;
  const escalating = a.capability === 'escalate';
  return (
    <View style={[s.answer, escalating && s.answerUrgent]}>
      {escalating ? <Eyebrow>Worth getting seen</Eyebrow> : null}
      <Text style={[font('body'), s.answerText]}>{displayCopy(turn.text)}</Text>

      {/*
        What the sentence was built from. Shown, not hidden behind a
        disclosure, because the provenance is the product: an answer whose
        sources she has to go looking for is an answer she has to trust.
      */}
      {a.facts.length ? (
        <View style={s.facts}>
          {a.facts.map((f) => (
            <View key={`${f.label}-${f.value}`} style={s.fact}>
              <View style={[s.dot, { backgroundColor: DOT[f.from] }]} />
              <Text style={[font('caption1'), s.factText]} numberOfLines={2}>
                {displayCopy(`${FROM_LABEL[f.from]}: ${f.label}, ${f.value}`)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {a.abstained ? (
        <Text style={[font('caption1'), s.abstained]}>
          {a.abstained === 'no_data'
            ? 'Not enough in your record yet.'
            : a.abstained === 'no_citations'
              ? 'No reviewed sources on this yet.'
              : 'Outside what Ciatta answers.'}
        </Text>
      ) : null}

      {a.suggestions.length ? (
        <View style={s.suggestions}>
          {a.suggestions.map((sug) => (
            <Pressable
              key={sug.label}
              onPress={() => sug.screen && onOpen(sug.screen)}
              accessibilityRole="button"
              style={({ pressed }) => [s.suggestion, pressed && s.pressed]}
            >
              <Text style={[font('footnote', 'semibold'), s.suggestionText]}>{sug.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.hairlineWidth;

const s = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: SPACE.block },
  head: { alignItems: 'center' },

  opening: { paddingHorizontal: GUTTER, marginTop: SPACE.near },
  greet: { color: L.ink, letterSpacing: -0.4 },
  lede: { color: L.body, lineHeight: 24, marginTop: 12 },
  openers: { marginTop: SPACE.block, gap: 8 },
  opener: {
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: L.rule,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  openerText: { color: L.ink },

  // Hers sits right and tighter; Ciatta's runs full width, because one is
  // a question and the other is a document.
  hers: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    marginTop: SPACE.block,
    marginRight: GUTTER,
    backgroundColor: L.statement,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: L.rule,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  hersText: { color: L.ink },

  answer: { marginTop: SPACE.near, marginHorizontal: GUTTER },
  // Escalation is the one case that takes a hue, and it takes Flare, which
  // the system gates and never spends casually.
  answerUrgent: {
    backgroundColor: 'rgba(236, 93, 74, 0.10)',
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: HUE.escalation,
    padding: 16,
  },
  answerText: { color: L.ink, lineHeight: 25 },

  facts: { marginTop: 12, gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  factText: { color: L.meta, flex: 1 },

  abstained: { color: L.meta, marginTop: 10, fontStyle: 'italic' },

  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  suggestion: {
    backgroundColor: L.recessed,
    borderRadius: 999,
    borderWidth: st,
    borderColor: L.rule,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  suggestionText: { color: L.body },
  pressed: { opacity: 0.55 },

  composer: { paddingHorizontal: GUTTER, paddingBottom: NAV_CLEARANCE },
});
