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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { respond, type Record as AgentRecord } from '../lib/agent/capabilities';
import { classify, mentionsLab } from '../lib/agent/classify';
import { wordOrFallback } from '../lib/agent/check';
import { capabilityCards } from '../lib/agent/readiness';
import { buildRecord } from '../lib/agent/record';
import { chooseReferral } from '../lib/agent/handoff';
import { interventions } from '../lib/agent/proactive';
import { chooseLab } from '../lib/labHandoff';
import { useAgentContext } from '../state/agentContext';
import { loadClinicalRecords } from '../data/providers';
import type { ClinicalRecord } from '../lib/providers/fhirMap';
import type { Fact, Suggestion, Turn } from '../lib/agent/types';
import { countedWindows, cycleToday, medianLength } from '../lib/cycleModel';
import { displayCopy } from '../lib/displayCopy';
import { type Screen, useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData, useRepo } from '../state/session';
import type { ReferenceRow, Reported } from '../data/repo';
import type { Attachment } from '../lib/attachments';
import { font, GUTTER } from '../theme';
import { Eyebrow } from '../ui/bento';
import { Composer } from '../ui/composer';
import { AgentAvatar } from '../ui/AgentAvatar';
import { Icon } from '../ui/icons';
import { HUE, L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';

// Said once, the first time she opens Care. Each line is a promise the
// code below keeps, which is the only reason it is allowed to be said.
// Said once, the first time, in one line. The rest of how it works is
// shown rather than told: sources under every answer, cards that prepare
// rather than act, and silence where her record is not enough.
const HOW_I_WORK = 'I work only from your record, show where every answer comes from, and never act without you.';

const INTRO_SEEN = 'ciatta.care.introSeen';
// Action cards she chose Not now on, by id, so each stays put away.
const DISMISSED = 'ciatta.care.dismissed';

// What she calls the agent. Three to choose from, the way a first meeting
// offers a name rather than asking her to invent one; Ciatta first, since
// it is the name she already knows. Kept on this phone.
const AGENT_NAME = 'ciatta.care.agentName';
const NAMES = ['Ciatta', 'Iris', 'Wren'] as const;

const DOT: Record<Fact['from'], string> = {
  measured: HUE.measured,
  reported: HUE.reported,
  derived: HUE.timeDepth,
  reference: HUE.evidence,
};

const FROM_LABEL: Record<Fact['from'], string> = {
  measured: 'Synced',
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
  // What her providers sent. Empty until a hospital is connected, and the
  // clinical capability abstains until then rather than implying she has
  // no results anywhere.
  const [clinical, setClinical] = useState<ClinicalRecord[]>([]);
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
    loadClinicalRecords()
      .then((rows) => {
        if (!ignore) setClinical(rows);
      })
      .catch(() => {
        // Left empty, so the clinical capability abstains.
      });
    return () => {
      ignore = true;
    };
  }, [repo]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  // The same box as Log Cycle Experience, which means the same plus and
  // the same four ways in.
  const [files, setFiles] = useState<Attachment[]>([]);
  const scroller = useRef<ScrollView | null>(null);
  // The list opens short. Seven boxed rows and an open box beneath them
  // filled the first screen edge to edge; one, the first that is ready,
  // shows what tapping does, and the rest are one tap away.
  // Whether she has had the introduction. Null until the read lands, so
  // the bullets never flash in for someone who has seen them.
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  // The name she chose, or null before she has chosen one. Until then the
  // agent goes by Ciatta and asks.
  const [agentName, setAgentName] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(INTRO_SEEN)
      .then((v) => setIntroSeen(v === '1'))
      .catch(() => setIntroSeen(false));
    AsyncStorage.getItem(AGENT_NAME)
      .then((v) => {
        if (v) setAgentName(v);
        else setNaming(true);
      })
      .catch(() => setNaming(true));
  }, []);
  const name = agentName ?? NAMES[0];
  const chooseName = (next: string) => {
    setAgentName(next);
    setNaming(false);
    AsyncStorage.setItem(AGENT_NAME, next).catch(() => {});
  };

  // Everything a capability may read, and nothing more. Assembled here so
  // the boundary is one object in one place rather than a set of imports
  // scattered through lib/agent.
  // useData().today is the written brief, not a row. The agent needs the
  // row, which is the same lookup Today does.
  // Everything else she has given Ciatta, read for every question.
  const { context } = useAgentContext();

  const todayRow = useMemo(() => {
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return days.find((x) => x.date === key) ?? null;
  }, [days]);

  const record: AgentRecord = useMemo(() => {
    const open = windows[windows.length - 1] ?? null;
    const predicted = lens.predicts ? medianLength(countedWindows(windows, profile)) : null;
    const now = cycleToday(open && !open.end ? open : null, predicted, new Date());
    const built = buildRecord({
      name: person?.firstName ?? null,
      today: todayRow,
      days,
      episodes,
      reported,
      insights: ranked,
      references,
      cycleDay: now?.day ?? null,
      cyclePhase: now?.phase ?? null,
      clinical,
    });
    return { ...built, context };
  }, [person, todayRow, days, episodes, reported, references, clinical, ranked, windows, lens, profile, context]);

  // What Ciatta raises on its own from her record, minus what she put away.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED)
      .then((v) => v && setDismissed(new Set(JSON.parse(v) as string[])))
      .catch(() => {});
  }, []);
  const actionCards = useMemo(() => interventions(context, new Date(), dismissed), [context, dismissed]);
  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    AsyncStorage.setItem(DISMISSED, JSON.stringify([...next])).catch(() => {});
  };
  const openSuggestion = (sug: { screen?: string; lab?: string; referral?: string; referralDraft?: string }) => {
    if (!sug.screen) return;
    if (sug.lab) chooseLab(sug.lab);
    if (sug.screen === 'referral') chooseReferral(sug.referral ?? null, sug.referralDraft ?? null);
    nav.push(sug.screen as Screen);
  };

  // Recomputed whenever her record changes, by running the capabilities.
  // Readiness held separately from the answer is readiness that can lie.
  const cards = useMemo(() => capabilityCards(record), [record]);
  const ready = useMemo(() => cards.filter((c) => c.ready), [cards]);

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message) return;
      const at = new Date().toISOString();
      // A test she has on record, named without the word lab, is a lab
      // question; a warning sign is always escalated first.
      const routed = classify(message);
      const capability =
        routed !== 'escalate' && mentionsLab(message, context.labs.map((l) => l.name)) ? 'labs' : routed;
      const answer = respond(message, record, capability);
      // No backend reached yet, so there is no rewrite to weigh and the
      // deterministic sentence stands. wordOrFallback is still the only
      // path to the text, so wiring the model later changes one argument
      // and nothing else.
      const { text: said, worded } = wordOrFallback(answer, null);

      setTurns((prev) => [
        ...prev,
        { id: `${at}-her`, role: 'her', text: message, at, attachments: files },
        { id: `${at}-ciatta`, role: 'ciatta', text: said, at, answer, worded },
      ]);
      setDraft('');
      setFiles([]);
      // Her first question is the moment the introduction has done its
      // job. Seen from then on, so the next visit opens on a greeting.
      if (introSeen === false) {
        setIntroSeen(true);
        AsyncStorage.setItem(INTRO_SEEN, '1').catch(() => {});
      }
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    },
    [record, files, introSeen, context],
  );

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroller} style={s.fill} contentContainerStyle={s.body} keyboardDismissMode="interactive">
        {/*
          The agent, centred, with the name she gave it. Tapping the name
          is how she changes it.
        */}
        <View style={s.intro}>
          <AgentAvatar size={72} />
          <Pressable
            onPress={() => setNaming((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${name}. Change name`}
            hitSlop={8}
            style={({ pressed }) => [s.namePill, pressed && s.pressed]}
          >
            <Text style={[font('subhead', 'semibold'), s.nameText]} accessibilityRole="header">
              {name}
            </Text>
          </Pressable>
        </View>

        {/*
          The opening, as Ciatta speaking rather than a page about Ciatta.
          The same shape a first conversation with any agent has: who it
          is, how it works, and where to start, then the box. How it works
          is said once, the first time; after that she knows, and the
          opening is a greeting and a place to begin.
        */}
        <View style={s.thread}>
          <View style={s.bubble}>
            <Text style={[font('body'), s.bubbleText]}>
              {displayCopy(
                `${person?.firstName ? `Hi ${person.firstName}, I` : 'Hi, I'}’m ${name}. I keep watch over your record and get things ready for you.`,
              )}
            </Text>
            {introSeen === false ? <Text style={[font('footnote'), s.howLine]}>{displayCopy(HOW_I_WORK)}</Text> : null}
          </View>

          {/* What Ciatta noticed in her record on its own, each card with
              the facts behind it and a next step she can take. */}
          {actionCards.map((card) => (
            <View key={card.id} style={[s.actionCard, card.tone === 'urgent' && s.actionUrgent]}>
              <Text style={[font('subhead', 'semibold'), s.bubbleText]}>{displayCopy(card.title)}</Text>
              <Text style={[font('footnote'), s.actionDetail]}>{displayCopy(card.detail)}</Text>
              <View style={s.suggestions}>
                {card.action ? (
                  <Pressable onPress={() => openSuggestion(card.action!)} accessibilityRole="button" style={({ pressed }) => [s.suggestion, pressed && s.pressed]}>
                    <Text style={[font('footnote', 'semibold'), s.suggestionText]}>{card.action.label}</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => dismiss(card.id)} accessibilityRole="button" accessibilityLabel={`Dismiss: ${card.title}`} hitSlop={6}>
                  <Text style={[font('footnote'), s.actionDetail]}>Not now</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {/* Where to start: what she can ask now, and the visit prep, as
              one row. The full list of what Ciatta can do stays out of the
              way; asking for anything still works. */}
          <View style={s.suggestions}>
            {ready.slice(0, 2).map((c) => (
              <Pressable key={c.id} onPress={() => send(c.ask)} accessibilityRole="button" style={({ pressed }) => [s.suggestion, pressed && s.pressed]}>
                <Text style={[font('footnote', 'semibold'), s.suggestionText]}>{c.title}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => nav.push('visitPrep')} accessibilityRole="button" style={({ pressed }) => [s.suggestion, pressed && s.pressed]}>
              <Text style={[font('footnote', 'semibold'), s.suggestionText]}>Visit prep</Text>
            </Pressable>
          </View>

          {naming ? (
            <View style={s.bubble}>
              <Text style={[font('body'), s.bubbleText]}>
                What would you like to call me? You can change this any time by tapping my name.
              </Text>
              <View style={s.names}>
                {NAMES.map((n) => {
                  const on = n === name;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => chooseName(n)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={({ pressed }) => [s.nameOption, on && s.nameOptionOn, pressed && s.pressed]}
                    >
                      <Text style={[font('body', on ? 'semibold' : 'regular'), s.bubbleText]}>{n}</Text>
                      {on ? <Icon name="check" size={16} color={L.ink} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

        </View>

        {turns.length ? (
          <View style={s.thread}>
            {turns.map((turn) =>
              turn.role === 'her' ? (
                <View key={turn.id} style={s.hers}>
                  <Text style={[font('subhead'), s.hersText]}>{turn.text}</Text>
                  {/*
                    Named, not opened. Ciatta does not read what is inside
                    a file, and the composer says so under the box.
                  */}
                  {turn.attachments?.length
                    ? turn.attachments.map((f) => (
                        <Text key={f.id} style={[font('caption1'), s.hersFile]} numberOfLines={1}>
                          {f.name}
                        </Text>
                      ))
                    : null}
                </View>
              ) : (
                <AnswerBlock key={turn.id} turn={turn} onOpen={openSuggestion} />
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
          attachments={files}
          onAttachments={setFiles}
          onSend={() => send(draft)}
        />
        {/*
          The disclaimer, last of everything and under the box it is about,
          so it is the final thing read before she asks rather than a
          paragraph between her and the screen.
        */}
        <Text style={[font('caption1'), s.limit]}>
          Not medical advice. Ciatta can make mistakes.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function AnswerBlock({ turn, onOpen }: { turn: Turn; onOpen: (sug: Suggestion) => void }) {
  const [sources, setSources] = useState(false);
  const a = turn.answer;
  if (!a) return null;
  const escalating = a.capability === 'escalate';
  return (
    <View style={[s.answer, escalating && s.answerUrgent]}>
      {escalating ? <Eyebrow>Worth getting seen</Eyebrow> : null}
      <Text style={[font('body'), s.answerText]}>{displayCopy(turn.text)}</Text>

      {/*
        What the sentence was built from, one tap away: a line with a dot
        for each kind of source, opening to the facts themselves. Every
        answer carries them; the screen just does not lead with them.
      */}
      {a.facts.length ? (
        <Pressable
          onPress={() => setSources((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: sources }}
          accessibilityLabel={`Sources, ${a.facts.length}`}
          hitSlop={6}
          style={s.sourcesToggle}
        >
          {[...new Set(a.facts.map((f) => f.from))].map((k) => (
            <View key={k} style={[s.dot, { backgroundColor: DOT[k] }]} />
          ))}
          <Text style={[font('caption1', 'semibold'), s.factText]}>{`Sources, ${a.facts.length}`}</Text>
          <Icon name={sources ? 'chevronDown' : 'chevronRight'} size={12} color={L.meta} />
        </Pressable>
      ) : null}
      {a.facts.length && sources ? (
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
              onPress={() => onOpen(sug)}
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
  howLine: { color: L.meta, marginTop: 8, lineHeight: 19 },
  sourcesToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32 },
  fill: { flex: 1 },
  body: { paddingBottom: SPACE.block },
  // The wordmark used to open this screen and its clear space was doing
  // the work of a top margin. Taken out, the title needs its own.
  intro: { alignItems: 'center', paddingHorizontal: GUTTER, paddingTop: SPACE.near },
  // The name sits just under the mark, clear of its line, so a hairline
  // circle is not cut by the pill.
  namePill: {
    marginTop: 6,
    // Translucent, as every other surface is, so Care's wash shows through
    // rather than a solid dark pill sitting on it.
    backgroundColor: L.recessed,
    borderRadius: 999,
    borderWidth: st,
    borderColor: L.rule,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  nameText: { color: L.ink },
  names: { gap: SPACE.tight, marginTop: 12 },
  nameOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: L.rule,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  nameOptionOn: { borderColor: L.ink, borderWidth: 1.5 },
  limit: { color: L.meta, lineHeight: 19, marginTop: SPACE.tight, textAlign: 'center' },

  // Ciatta's side of the conversation: her messages sit right on the
  // statement ground, Ciatta's on the left on the recessed one.
  thread: { paddingHorizontal: GUTTER, marginTop: SPACE.block },
  // One width for every message of Ciatta's, so the opening reads as a
  // column of cards rather than a ragged stack sized to each sentence.
  bubble: {
    alignSelf: 'flex-start',
    width: '90%',
    marginTop: SPACE.tight,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: L.rule,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bubbleText: { color: L.ink, lineHeight: 24 },

  flipped: { transform: [{ rotate: '180deg' }] },
  // Not disabled, only quieter. It still answers, by saying what is
  // missing, so it keeps its edge and loses its fill.

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
  hersFile: { color: L.meta, marginTop: 4 },

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

  suggestions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 },
  actionCard: {
    backgroundColor: L.recessed,
    borderRadius: 16,
    borderWidth: st,
    borderColor: L.rule,
    padding: 14,
  },
  actionUrgent: { borderColor: 'rgba(236, 93, 74, 0.6)', backgroundColor: 'rgba(236, 93, 74, 0.10)' },
  actionDetail: { color: L.meta, marginTop: 4, lineHeight: 18 },
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
