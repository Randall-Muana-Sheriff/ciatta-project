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
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { onCareAsk, openRequest, takeCareAsk } from '../lib/careHandoff';
import { CareHub } from '../ui/CareHub';
import { ScreenHeader } from '../ui/kit';
import { groupItems, mergeItems, offerLine, turnPlan } from '../lib/agent/logOffer';
import { isLoggable } from '../../supabase/functions/_shared/checkIn';
import { readCategories } from '../lib/quickLog';
import { readLog } from '../data/logRead';
import { useQuickLogSave } from '../state/quickLogSave';
import { takeCheckIn } from '../lib/checkInHandoff';
import { progressSteps, revealWords } from '../lib/agent/progress';
import { CONNECT_SYMPTOMS } from '../lib/agent/connect';
import type { RequestKind } from '../lib/care';
import { Icon } from '../ui/icons';
import { HUE, L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';
import { G } from '../ui/scheme';

// Said once, the first time she opens Care. Each line is a promise the
// code below keeps, which is the only reason it is allowed to be said.

const INTRO_SEEN = 'ciatta.care.introSeen';
// Action cards she chose Not now on, by id, so each stays put away.
const DISMISSED = 'ciatta.care.dismissed';

// The agent is Ciatta, the name she already knows. There is no other.
const name = 'Ciatta';

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
  const [turns, setTurns] = useState<Turn[]>(() => {
    // A check in handed over from Today, asked here in words.
    const c = takeCheckIn();
    if (!c) return [];
    const at = new Date().toISOString();
    return [{ id: `${at}-checkin`, role: 'ciatta', text: `${c.line} ${c.question}`, at }];
  });
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
  useEffect(() => {
    AsyncStorage.getItem(INTRO_SEEN)
      .then((v) => setIntroSeen(v === '1'))
      .catch(() => setIntroSeen(false));
  }, []);

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
  const openSuggestion = (sug: { screen?: string; lab?: string; referral?: string; referralDraft?: string; requestDraft?: string; requestKind?: string; requestFor?: string }) => {
    if (!sug.screen) return;
    if (sug.lab) chooseLab(sug.lab);
    if (sug.screen === 'referral') chooseReferral(sug.referral ?? null, sug.referralDraft ?? null);
    if (sug.requestDraft) openRequest({ draft: { kind: 'labs', tests: sug.requestDraft.split('|') } });
    else if (sug.requestKind) openRequest({ draft: { kind: sug.requestKind as RequestKind, medication: sug.requestFor } });
    nav.push(sug.screen as Screen);
  };

  // Recomputed whenever her record changes, by running the capabilities.
  // Readiness held separately from the answer is readiness that can lie.
  const cards = useMemo(() => capabilityCards(record), [record]);
  const ready = useMemo(() => cards.filter((c) => c.ready), [cards]);

  const saveLog = useQuickLogSave();
  const setOffer = useCallback((id: string, state: NonNullable<Turn['offer']>['state']) => {
    setTurns((prev) => prev.map((t) => (t.id === id && t.offer ? { ...t, offer: { ...t.offer, state } } : t)));
  }, []);
  // Add: saved through the same path every log takes, each word under the
  // category the record keeps it in, and her own words kept as the note.
  const addOffer = useCallback(
    async (id: string) => {
      const turn = turns.find((t) => t.id === id);
      if (!turn?.offer || (turn.offer.state !== 'offered' && turn.offer.state !== 'failed')) return;
      try {
        const ok = await saveLog({
          text: turn.offer.text,
          key: 'symptoms',
          tapped: turn.offer.items,
          byCategory: groupItems(turn.offer.items),
          files: [...(turn.offer.files ?? [])],
        });
        setOffer(id, ok ? 'added' : 'failed');
      } catch {
        setOffer(id, 'failed');
      }
    },
    [turns, saveLog, setOffer],
  );
  // Keeps the newest words in view while an answer is written out.
  const grow = useCallback(() => scroller.current?.scrollToEnd({ animated: true }), []);

  const send = useCallback(
    (text: string, sentFiles?: readonly Attachment[]) => {
      const message = text.trim();
      if (!message) return;
      // Files sent with a message from Today's box come with it.
      const files_ = sentFiles ? [...sentFiles] : files;
      const at = new Date().toISOString();
      // A test she has on record, named without the word lab, is a lab
      // question; a warning sign is always escalated first.
      const routed = classify(message);
      const capability =
        routed !== 'escalate' && mentionsLab(message, context.labs.map((l) => l.name)) ? 'labs' : routed;
      const plan = turnPlan(capability, []);
      const answer = respond(message, record, capability);
      // No backend reached yet, so there is no rewrite to weigh and the
      // deterministic sentence stands. wordOrFallback is still the only
      // path to the text, so wiring the model later changes one argument
      // and nothing else.
      const { text: said, worded } = wordOrFallback(answer, null);

      // Said, not asked: read for what could go on her timeline, by the
      // server's reader and the phone's own, and offered rather than saved.
      const loggable = isLoggable(message) && capability !== 'escalate';
      const local = loggable ? Object.values(readCategories(message)).flat() : [];
      setTurns((prev) => [
        ...prev,
        { id: `${at}-her`, role: 'her', text: message, at, attachments: files_ },
        ...(plan.answer && !(loggable && capability === 'decline')
          ? [{ id: `${at}-ciatta`, role: 'ciatta' as const, text: said, at, answer, worded, fresh: true }]
          : []),
      ]);
      if (loggable) {
        const attached = files_;
        void readLog(message).then((read) => {
          const items = mergeItems(read?.items ?? null, local);
          const next = turnPlan(capability, items);
          setTurns((prev) => {
            const out = [...prev];
            // A statement Ciatta could not answer and nothing to add: the
            // plain answer after all, so she is never left without a reply.
            if (!next.offer) {
              if (capability === 'decline') out.push({ id: `${at}-ciatta`, role: 'ciatta', text: said, at, answer, worded, fresh: true });
              return out;
            }
            out.push({
              id: `${at}-offer`,
              role: 'ciatta',
              text: offerLine(items),
              at,
              offer: { items, text: message, daysAgo: read?.daysAgo ?? 0, state: 'offered', files: attached },
            });
            return out;
          });
          requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
        });
      }
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

  // A question handed over from elsewhere, such as Explore on a body
  // system: asked as if she had typed it.
  useEffect(() => {
    const waiting = takeCareAsk();
    if (waiting) send(waiting.prompt, waiting.files);
    return onCareAsk((prompt, sent) => send(prompt, sent));
  }, [send]);

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Close chat, as the reference sets it: back to the chat card on
          Today, whatever she was doing. */}
      <View style={s.closeRow}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Close chat" hitSlop={8} style={({ pressed }) => [s.closePill, pressed && s.pressed]}>
          <Icon name="xmark" size={13} color={G.ink} />
          <Text style={[font('footnote', 'medium'), { color: G.ink }]}>Close chat</Text>
        </Pressable>
      </View>
      <ScrollView ref={scroller} style={s.fill} contentContainerStyle={s.body} keyboardDismissMode="interactive">
        {/*
          No avatar, no name, no suggestions: the conversation alone. What
          Ciatta can do and what it noticed are still worked out above
          (capabilityCards, interventions) and answer when she asks.
        */}
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
              ) : turn.offer ? (
                <OfferBlock key={turn.id} turn={turn} onAdd={() => void addOffer(turn.id)} onDecline={() => setOffer(turn.id, 'declined')} />
              ) : (
                <AnswerBlock
                  key={turn.id}
                  turn={turn}
                  onOpen={openSuggestion}
                  onGrow={grow}
                />
              ),
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={s.composer}>
        <Composer
          value={draft}
          onChange={setDraft}
          // An example of what she might ask, in her own voice.
          placeholder="Ask Ciatta"
          label="Ask Ciatta, or tell it how you feel"
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

// Ciatta's offer to add what she said to her timeline. Add saves it;
// Not this leaves it unsaved. Once answered, the card says what happened.
function OfferBlock({ turn, onAdd, onDecline }: { turn: Turn; onAdd: () => void; onDecline: () => void }) {
  const o = turn.offer!;
  return (
    <View style={s.actionCard}>
      <Text style={[font('subhead'), s.bubbleText]}>{displayCopy(turn.text)}</Text>
      {o.state === 'failed' ? (
        <Text style={[font('footnote'), s.actionDetail]}>That did not save. Nothing was added.</Text>
      ) : null}
      {o.state === 'offered' || o.state === 'failed' ? (
        <View style={s.suggestions}>
          <Pressable onPress={onAdd} accessibilityRole="button" style={({ pressed }) => [s.actionButton, pressed && s.pressed]}>
            <Text style={[font('footnote', 'semibold'), s.actionButtonText]}>{o.state === 'failed' ? 'Try again' : 'Add'}</Text>
          </Pressable>
          <Pressable onPress={onDecline} accessibilityRole="button" hitSlop={6}>
            <Text style={[font('footnote'), s.actionDetail]}>Not this</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[font('footnote'), s.actionDetail]}>
          {o.state === 'added' ? 'Added to your timeline.' : 'Not added.'}
        </Text>
      )}
    </View>
  );
}

// Three dots breathing in turn: the agent at work.
function Thinking() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 3, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={s.dots}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            s.thinkDot,
            { opacity: v.interpolate({ inputRange: [0, i, i + 0.5, i + 1, 3], outputRange: [0.25, 0.25, 1, 0.25, 0.25], extrapolate: 'clamp' }) },
          ]}
        />
      ))}
    </View>
  );
}

// How long each step shows, and how fast the answer is written out.
const STEP_MS = 520;
const WORDS_PER_TICK = 2;
const TICK_MS = 45;

function AnswerBlock({ turn, onOpen, onGrow }: { turn: Turn; onOpen: (sug: Suggestion) => void; onGrow: () => void }) {
  const [sources, setSources] = useState(false);
  const a = turn.answer;
  // Worked, then written: the steps this answer took, one after another,
  // then its words a few at a time. A turn from earlier, or Reduce
  // Motion, shows whole.
  const steps = useMemo(() => (a ? progressSteps(a) : []), [a]);
  const total = turn.text.split(' ').length;
  const [step, setStep] = useState(turn.fresh ? 0 : steps.length);
  const [words, setWords] = useState(turn.fresh ? 0 : total);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce && !cancelled) {
        setStep(steps.length);
        setWords(total);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [steps.length, total]);
  useEffect(() => {
    if (step < steps.length) {
      const t = setTimeout(() => setStep((n) => n + 1), STEP_MS);
      return () => clearTimeout(t);
    }
    if (words < total) {
      const t = setTimeout(() => {
        setWords((n) => Math.min(total, n + WORDS_PER_TICK));
        onGrow();
      }, TICK_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [step, words, steps.length, total, onGrow]);
  const working = step < steps.length;
  const writing = !working && words < total;
  if (!a) return null;
  if (working) {
    return (
      <View style={s.answer} accessibilityLiveRegion="polite" accessibilityLabel={`${steps[step]}`}>
        {steps.slice(0, step + 1).map((label, n) => (
          <View key={label} style={s.stepRow}>
            {n < step ? <Icon name="check" size={13} color={G.meta} /> : <Thinking />}
            <Text style={[font('footnote', n === step ? 'semibold' : 'regular'), n === step ? s.stepNow : s.stepDone]}>{label}</Text>
          </View>
        ))}
      </View>
    );
  }
  const escalating = a.capability === 'escalate';
  return (
    <View style={[s.answer, escalating && s.answerUrgent]}>
      {escalating ? <Eyebrow>Worth getting seen</Eyebrow> : null}
      <Text style={[font('body'), s.answerText]}>
        {displayCopy(revealWords(turn.text, words))}
        {writing ? <Text style={s.caret}>{' ▍'}</Text> : null}
      </Text>

      {/*
        What the sentence was built from, one tap away: a line with a dot
        for each kind of source, opening to the facts themselves. Every
        answer carries them; the screen just does not lead with them.
      */}
      {!writing && a.facts.length ? (
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
          <Icon name={sources ? 'chevronDown' : 'chevronRight'} size={12} color={G.meta} />
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

      {!writing && a.abstained ? (
        <Text style={[font('caption1'), s.abstained]}>
          {a.abstained === 'no_data'
            ? 'Not enough in your record yet.'
            : a.abstained === 'no_citations'
              ? 'No reviewed sources on this yet.'
              : 'Outside what Ciatta answers.'}
        </Text>
      ) : null}

      {!writing && a.suggestions.length ? (
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

const WHITE = '#FFFFFF';
const ON_WHITE = '#0C0E11';
const ON_WHITE_META = '#59606A';

const s = StyleSheet.create({
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
  stepNow: { color: G.ink },
  stepDone: { color: G.meta },
  dots: { flexDirection: 'row', gap: 3, width: 13, alignItems: 'center' },
  thinkDot: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: G.ink },
  caret: { color: G.meta },
  sourcesToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32 },
  fill: { flex: 1 },
  body: { paddingBottom: SPACE.block },
  switch: { paddingHorizontal: GUTTER, marginTop: SPACE.near },
  hub: { paddingHorizontal: GUTTER, paddingBottom: NAV_CLEARANCE },
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
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  nameText: { color: G.ink },
  names: { gap: SPACE.tight, marginTop: 12 },
  nameOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: 'rgba(12, 14, 17, 0.18)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  nameOptionOn: { borderColor: ON_WHITE, borderWidth: 1.5 },
  limit: { color: G.meta, lineHeight: 19, marginTop: SPACE.tight, textAlign: 'center' },

  // Ciatta's side of the conversation: her messages sit right on the
  // statement ground, Ciatta's on the left on the recessed one.
  thread: { paddingHorizontal: GUTTER, marginTop: SPACE.block },
  // One width for every message of Ciatta's, so the opening reads as a
  // column of cards rather than a ragged stack sized to each sentence.
  // Concierge sets its own side in white, the secondary colour here, with
  // near black type: the same in light and dark.
  bubble: {
    alignSelf: 'flex-start',
    width: '90%',
    marginTop: SPACE.tight,
    backgroundColor: WHITE,
    borderRadius: TILE_RADIUS,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bubbleText: { color: ON_WHITE, lineHeight: 24 },

  flipped: { transform: [{ rotate: '180deg' }] },
  // Not disabled, only quieter. It still answers, by saying what is
  // missing, so it keeps its edge and loses its fill.

  hers: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    marginTop: SPACE.near,
    backgroundColor: G.fillSelected,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: G.rule,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  hersText: { color: G.ink },
  hersFile: { color: G.meta, marginTop: 4 },

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
  answerText: { color: G.ink, lineHeight: 25 },

  facts: { marginTop: 12, gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  factText: { color: G.meta, flex: 1 },

  abstained: { color: G.meta, marginTop: 10, lineHeight: 18 },

  suggestions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 },
  actionCard: {
    backgroundColor: WHITE,
    borderRadius: TILE_RADIUS,
    padding: 14,
    borderWidth: 1,
    borderColor: WHITE,
  },
  actionUrgent: { borderColor: '#C52D1E' },
  actionDetail: { color: ON_WHITE_META, marginTop: 4, lineHeight: 18 },
  // The one action in a white card: a solid pill, the inverse of the card.
  actionButton: { backgroundColor: '#161616', borderRadius: 999, minHeight: 36, paddingHorizontal: 16, justifyContent: 'center' },
  actionButtonText: { color: WHITE },
  suggestion: {
    backgroundColor: WHITE,
    borderRadius: 999,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  suggestionText: { color: ON_WHITE },
  pressed: { opacity: 0.55 },

  closeRow: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  closePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  composer: { paddingHorizontal: GUTTER, paddingBottom: NAV_CLEARANCE },
});
