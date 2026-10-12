// Care: the agent, as a surface.
//
// The first version of this screen was a greeting, four suggestion chips
// and a text box, which is the chatbot pattern exactly. That was wrong,
// and wrong in a way that misrepresented the thing underneath: a blank box
// says "ask me anything", a promise no health intelligence can keep and
// this one is built specifically not to make.
//
// What makes this not a chatbot is a fixed set of capabilities, a record
// that either supports one or does not, and a source shown under every
// sentence. All three were hidden behind the box. So the capabilities are
// the interface now: each is named, each says whether it can answer from
// her record right now, and tapping one runs it. The box stays, beneath
// them, for the question the list did not anticipate.
//
// Everything that decides what is said still lives in lib/agent and is
// pure. This file renders, and assembles the Record a capability may read.
// A sentence appearing here that lib/agent did not write is a bug.
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
import { capabilityCards, type CapabilityCard, readinessLine } from '../lib/agent/readiness';
import { buildRecord } from '../lib/agent/record';
import type { Fact, Turn } from '../lib/agent/types';
import { countedWindows, cycleToday, medianLength } from '../lib/cycleModel';
import { displayCopy } from '../lib/displayCopy';
import { type Screen, useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData, useRepo } from '../state/session';
import type { ReferenceRow, Reported } from '../data/repo';
import { font, GUTTER } from '../theme';
import { Eyebrow } from '../ui/bento';
import { Composer } from '../ui/composer';
import { Icon } from '../ui/icons';
import { HUE, L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';

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
  // Reviewed references, which are the only thing context may quote. An
  // empty list is the honest state until the seed migration is applied.
  const [references, setReferences] = useState<ReferenceRow[]>([]);
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
    repo
      .loadReferences()
      .then((rows) => {
        if (!ignore) setReferences(rows);
      })
      .catch(() => {
        // Left empty, so context abstains. Better than quoting from a
        // read that did not land.
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
      references,
      cycleDay: now?.day ?? null,
      cyclePhase: now?.phase ?? null,
    });
  }, [person, todayRow, days, episodes, reported, references, ranked, windows, lens, profile]);

  // Recomputed whenever her record changes, by running the capabilities.
  // Readiness held separately from the answer is readiness that can lie.
  const cards = useMemo(() => capabilityCards(record), [record]);

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
        <View style={s.intro}>
          <Text style={[font('title2'), s.title]} accessibilityRole="header">
            Care
          </Text>
          {/*
            One sentence, and the boundary is the whole of it. The earlier
            version also counted the capabilities and promised it would say
            when it could not answer, but the list below counts itself and
            every row states its own readiness, so saying it here was the
            screen explaining what it was about to show.
          */}
          <Text style={[font('body'), s.lede]}>It answers from your record and nowhere else.</Text>
          <Text style={[font('caption1'), s.limit]}>
            Ciatta can make mistakes and responses are not meant for medical advice. Always consult a healthcare
            professional.
          </Text>
        </View>

        {/*
          The capability list, which is the interface rather than a menu
          beside it. Ready first: the ones she can use now are the point,
          and a list led by what is unavailable reads as a broken product.
        */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Eyebrow>What it can do</Eyebrow>
            <Text style={[font('caption1'), s.count]}>{displayCopy(readinessLine(cards))}</Text>
          </View>
          {[...cards]
            .sort((a, b) => Number(b.ready) - Number(a.ready))
            .map((c) => (
              <CapabilityRow key={c.id} card={c} onRun={() => send(c.ask)} />
            ))}
        </View>

        {turns.length ? (
          <View style={s.section}>
            <Eyebrow>This session</Eyebrow>
            {turns.map((turn) =>
              turn.role === 'her' ? (
                <View key={turn.id} style={s.hers}>
                  <Text style={[font('subhead'), s.hersText]}>{turn.text}</Text>
                </View>
              ) : (
                <AnswerBlock key={turn.id} turn={turn} onOpen={(screen) => nav.push(screen as Screen)} />
              ),
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={s.composer}>
        <Composer
          value={draft}
          onChange={setDraft}
          placeholder="Or ask in your own words"
          label="Ask Ciatta about your record"
          onSend={() => send(draft)}
          minHeight={86}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// One capability, with whether it can answer from her record right now.
//
// A blocked row is still tappable. Tapping it answers by saying exactly
// what is missing, which is more use than a disabled row that says nothing
// and cannot be asked why.
function CapabilityRow({ card, onRun }: { card: CapabilityCard; onRun: () => void }) {
  return (
    <Pressable
      onPress={onRun}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.ready ? 'Ready' : card.blocked}`}
      style={({ pressed }) => [s.cap, !card.ready && s.capBlocked, pressed && s.pressed]}
    >
      <View style={s.capLeft}>
        <Text style={[font('subhead', 'semibold'), s.capTitle]}>{card.title}</Text>
        <Text style={[font('caption1'), s.capWhat]}>
          {displayCopy(card.ready ? card.what : (card.blocked as string))}
        </Text>
      </View>
      {/*
        A filled pip when ready, a hollow ring when not, so the state
        survives being read without colour.
      */}
      <View style={[s.pip, card.ready ? s.pipOn : s.pipOff]} />
      <Icon name="chevronRight" size={15} color={L.meta} />
    </Pressable>
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
  // The wordmark used to open this screen and its clear space was doing
  // the work of a top margin. Taken out, the title needs its own.
  intro: { paddingHorizontal: GUTTER, paddingTop: SPACE.near },
  title: { color: L.ink, letterSpacing: -0.4 },
  lede: { color: L.body, lineHeight: 24, marginTop: 10 },
  limit: { color: L.meta, lineHeight: 19, marginTop: 12 },

  section: { marginTop: SPACE.section, paddingHorizontal: GUTTER },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.tight,
  },
  count: { color: L.meta },

  cap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: L.rule,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: SPACE.grid,
  },
  // Not disabled, only quieter. It still answers, by saying what is
  // missing, so it keeps its edge and loses its fill.
  capBlocked: { backgroundColor: 'transparent' },
  capLeft: { flex: 1 },
  capTitle: { color: L.ink },
  capWhat: { color: L.meta, marginTop: 3, lineHeight: 18 },
  pip: { width: 9, height: 9, borderRadius: 5 },
  pipOn: { backgroundColor: HUE.measured },
  pipOff: { borderWidth: 1.5, borderColor: L.meta },

  hers: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    marginTop: SPACE.near,
    backgroundColor: L.statement,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: L.rule,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  hersText: { color: L.ink },

  answer: { marginTop: SPACE.near },
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

  abstained: { color: L.meta, marginTop: 10, lineHeight: 18 },

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
