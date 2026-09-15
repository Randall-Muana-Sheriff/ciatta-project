import { type ReactNode, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ACUTE,
  AFFECT,
  CHANGES,
  CONTEXT,
  DAY_IMPACT,
  dayAgoLabel,
  emptyForm,
  episodeTitle,
  type EpisodeForm,
  FLOW,
  fmtHour,
  formToEpisode,
  HELPED,
  HELPED_AMOUNT,
  PAIN_PATTERN,
  SENSATIONS,
  summarize,
  SYMPTOMS,
  TIMING_STATES,
  TRAJECTORY,
  WHAT_HAPPENED,
} from '../data/cycleLog';
import { useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { C, font } from '../theme';
import { BodyMap } from '../ui/BodyMap';
import { Panel } from '../ui/chrome';
import { ChoiceChips, FieldLabel, NoteField, SeverityScale, StepHeader, Stepper, StepProgress } from '../ui/cycleInputs';
import { Icon } from '../ui/icons';
import { DetailScreen, LinkButton, PrimaryButton, SecondaryButton } from '../ui/kit';

type StepId =
  | 'what'
  | 'period'
  | 'when'
  | 'where'
  | 'feel'
  | 'severity'
  | 'change'
  | 'changed'
  | 'impact'
  | 'symptoms'
  | 'around'
  | 'flare'
  | 'helped'
  | 'summary';

type Mode = 'new' | 'similar';

// Only the steps that apply to what happened. A similar episode starts from
// what changed and skips what Ciatta already knows.
function stepsFor(mode: Mode, kinds: string[]): StepId[] {
  if (mode === 'similar') return ['changed', 'severity', 'when', 'impact', 'around', 'flare', 'helped', 'summary'];
  const steps: StepId[] = ['what'];
  if (kinds.includes('Period') || kinds.includes('Spotting')) steps.push('period');
  if (kinds.includes('Pain')) steps.push('when', 'where', 'feel', 'severity', 'change', 'changed', 'impact');
  if (kinds.includes('Symptoms')) steps.push('symptoms');
  steps.push('around', 'flare');
  if (kinds.includes('Pain') || kinds.includes('Symptoms')) steps.push('helped');
  steps.push('summary');
  return steps;
}

type ListKey = { [K in keyof EpisodeForm]: EpisodeForm[K] extends string[] ? K : never }[keyof EpisodeForm];

// Toggle a value; `none` is exclusive of everything else in the list.
function toggleIn(list: string[], value: string, none?: string): string[] {
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (value === none) return [value];
  return [...list.filter((v) => v !== none), value];
}

// Half hour steps, wrapping at midnight; a first tap lands on a sensible time.
const stepTime = (h: number | null, delta: number, fallback: number) => (h == null ? fallback : (h + delta + 24) % 24);

export function CycleLogScreen() {
  const nav = useNav();
  const { draft, add } = useCycle();
  const { template } = useCycleInsights();
  const [mode, setMode] = useState<Mode>(draft.mode);
  const [form, setForm] = useState<EpisodeForm>(() => ({ ...emptyForm(), ...draft.form }));
  const [index, setIndex] = useState(0);
  const [noteOpen, setNoteOpen] = useState(!!draft.focusNote);

  const steps = stepsFor(mode, form.kinds);
  const at = Math.min(index, steps.length - 1);
  const step = steps[at];
  const episode = useMemo(() => formToEpisode(form, mode === 'similar'), [form, mode]);

  const set = <K extends keyof EpisodeForm>(key: K, value: EpisodeForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (key: ListKey, value: string, none?: string) =>
    setForm((f) => ({ ...f, [key]: toggleIn(f[key], value, none) }));
  const pick = (key: 'flow' | 'pattern' | 'helpedAmount', value: string) =>
    setForm((f) => ({ ...f, [key]: f[key] === value ? null : value }));

  const next = () => setIndex(Math.min(at + 1, steps.length - 1));
  const back = () => (at > 0 ? setIndex(at - 1) : nav.back());
  const save = () => {
    add(formToEpisode(form, mode === 'similar'));
    nav.back();
  };
  const logSimilar = () => {
    if (!template) return;
    setMode('similar');
    setForm({ ...emptyForm(), ...template });
    setIndex(0);
  };
  const editAll = () => {
    setMode('new');
    setIndex(0);
  };

  const acute =
    form.dayImpact.some((d) => ACUTE.includes(d)) || form.affect.includes('Needed help from someone') || form.severity === 10;
  const helpedSomething = form.helped.length > 0 && !(form.helped.length === 1 && form.helped[0] === 'Nothing');
  const triggerCandidates = form.context.filter((c) => c !== 'No obvious trigger' && c !== 'Other');

  const body: Record<StepId, () => ReactNode> = {
    what: () => (
      <>
        <StepHeader title="What happened?" hint="Choose everything that applies." />
        <ChoiceChips options={WHAT_HAPPENED} selected={form.kinds} onToggle={(v) => toggle('kinds', v)} />
        {template && mode === 'new' ? (
          <Panel style={l.gap}>
            <Text style={[font('headline'), { color: C.text }]}>Pain again?</Text>
            <Text style={[font('subhead'), { color: C.secondary, marginTop: 4 }]}>
              Start from your usual episode: {[...(template.locations ?? []), ...(template.sensations ?? [])].join(', ')}
              {template.severity != null ? `, ${template.severity} of 10` : ''}.
            </Text>
            <View style={{ marginTop: 12 }}>
              <SecondaryButton label="Log Similar Episode" onPress={logSimilar} />
            </View>
          </Panel>
        ) : null}
      </>
    ),

    period: () => {
      const spotting = !form.kinds.includes('Period');
      return (
        <>
          <StepHeader title={spotting ? 'When was the spotting?' : 'When was your period?'} hint="Rough dates are fine." />
          <Stepper
            label="Started"
            value={dayAgoLabel(form.periodStart)}
            onEarlier={() => set('periodStart', form.periodStart + 1)}
            onLater={() =>
              setForm((f) => {
                const start = Math.max(0, f.periodStart - 1);
                return { ...f, periodStart: start, periodEnd: f.periodEnd == null ? null : Math.min(f.periodEnd, start) };
              })
            }
            laterDisabled={form.periodStart === 0}
          />
          <Stepper
            label="Ended"
            value={form.periodEnd == null ? 'Still going' : dayAgoLabel(form.periodEnd)}
            onEarlier={() => set('periodEnd', form.periodEnd == null ? 0 : Math.min(form.periodEnd + 1, form.periodStart))}
            onLater={() => set('periodEnd', form.periodEnd == null || form.periodEnd === 0 ? null : form.periodEnd - 1)}
            laterDisabled={form.periodEnd == null}
          />
          <FieldLabel>Flow</FieldLabel>
          <ChoiceChips single options={FLOW} selected={form.flow ? [form.flow] : []} onToggle={(v) => pick('flow', v)} />
        </>
      );
    },

    when: () => (
      <>
        <StepHeader title="When did this pain occur?" hint="Rough times are fine. Leave them if you're not sure." />
        <Stepper
          label="Day"
          value={dayAgoLabel(form.day)}
          onEarlier={() => set('day', form.day + 1)}
          onLater={() => set('day', Math.max(0, form.day - 1))}
          laterDisabled={form.day === 0}
        />
        <View style={{ marginTop: 16 }}>
          <ChoiceChips options={['All day']} selected={form.allDay ? ['All day'] : []} onToggle={() => set('allDay', !form.allDay)} />
        </View>
        {!form.allDay ? (
          <>
            <Stepper
              label="Started"
              value={form.start == null ? 'Not sure' : fmtHour(form.start)}
              onEarlier={() => set('start', stepTime(form.start, -0.5, 9))}
              onLater={() => set('start', stepTime(form.start, 0.5, 9))}
            />
            <Stepper
              label="Ended"
              value={form.end == null ? (form.states.includes('Still happening') ? 'Still happening' : 'Not sure') : fmtHour(form.end)}
              onEarlier={() => set('end', stepTime(form.end, -0.5, form.start != null ? (form.start + 2) % 24 : 12))}
              onLater={() => set('end', stepTime(form.end, 0.5, form.start != null ? (form.start + 2) % 24 : 12))}
            />
            {form.start != null || form.end != null ? (
              <LinkButton label="I'm not sure of the times" onPress={() => setForm((f) => ({ ...f, start: null, end: null }))} />
            ) : null}
          </>
        ) : null}
        <FieldLabel>Also true</FieldLabel>
        <ChoiceChips options={TIMING_STATES} selected={form.states} onToggle={(v) => toggle('states', v)} />
        {form.states.includes('Comes and goes') ? (
          <>
            <FieldLabel>Pain pattern</FieldLabel>
            <ChoiceChips single options={PAIN_PATTERN} selected={form.pattern ? [form.pattern] : []} onToggle={(v) => pick('pattern', v)} />
          </>
        ) : null}
      </>
    ),

    where: () => (
      <>
        <StepHeader title="Where did you feel it?" />
        <BodyMap selected={form.locations} onToggle={(v) => toggle('locations', v)} />
      </>
    ),

    feel: () => (
      <>
        <StepHeader title="What best describes this pain?" hint="Choose as many as fit." />
        <ChoiceChips options={SENSATIONS} selected={form.sensations} onToggle={(v) => toggle('sensations', v)} />
      </>
    ),

    severity: () => (
      <>
        <StepHeader title="How severe was the pain?" hint="0 is no pain. 10 is the worst you can imagine." />
        <Panel>
          <Text style={[font('footnote', 'semibold'), l.panelLabel]}>Pain intensity</Text>
          <SeverityScale value={form.severity} onChange={(n) => set('severity', form.severity === n ? null : n)} />
        </Panel>
        <FieldLabel hint="Intensity and impact are different. Moderate pain can still stop a day.">
          How much did it affect you?
        </FieldLabel>
        <ChoiceChips options={AFFECT} selected={form.affect} onToggle={(v) => toggle('affect', v)} />
      </>
    ),

    change: () => (
      <>
        <StepHeader title="What best describes how the pain changed?" hint="Choose all that fit." />
        <ChoiceChips options={TRAJECTORY} selected={form.trajectory} onToggle={(v) => toggle('trajectory', v)} />
      </>
    ),

    changed: () => (
      <>
        {mode === 'similar' ? (
          <Panel style={{ marginBottom: 20 }}>
            <Text style={[font('footnote', 'semibold'), { color: C.tint }]}>Filled in from your usual episode</Text>
            <Text style={[font('subhead'), { color: C.text, marginTop: 4 }]}>
              {[...form.locations, ...form.sensations].join(', ')}
              {form.severity != null ? `, ${form.severity} of 10` : ''}
              {form.start != null && form.end != null ? `, ${fmtHour(form.start)} to ${fmtHour(form.end)}` : ''}
            </Text>
            <LinkButton label="Edit all details" onPress={editAll} />
          </Panel>
        ) : null}
        <StepHeader
          title={mode === 'similar' ? 'What changed this time?' : 'What changed during this episode?'}
          hint="This helps tell a steady symptom from one that's changing."
        />
        <ChoiceChips options={CHANGES} selected={form.changes} onToggle={(v) => toggle('changes', v, 'Nothing changed')} />
      </>
    ),

    impact: () => (
      <>
        <StepHeader title="How did this affect your day?" hint="Choose all that apply." />
        <ChoiceChips options={DAY_IMPACT} selected={form.dayImpact} onToggle={(v) => toggle('dayImpact', v, 'Nothing')} />
        {acute ? (
          <Panel style={[l.gap, l.care]}>
            <Icon name="info" size={20} color={C.secondary} weight={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={[font('headline'), { color: C.text }]}>If you need care now</Text>
              <Text style={[font('subhead'), { color: C.secondary, marginTop: 4 }]}>
                If you fainted, or the pain is severe or unlike your usual, it may be worth contacting a clinician. If you
                feel unsafe right now, call your local emergency number.
              </Text>
            </View>
          </Panel>
        ) : null}
      </>
    ),

    symptoms: () => (
      <>
        <StepHeader title="Which symptoms did you notice?" hint="Choose all that apply." />
        <ChoiceChips options={SYMPTOMS} selected={form.symptoms} onToggle={(v) => toggle('symptoms', v)} />
      </>
    ),

    around: () => (
      <>
        <StepHeader title="What was happening around the time?" hint="Anything that was going on, whether or not it seems related." />
        <ChoiceChips options={CONTEXT} selected={form.context} onToggle={(v) => toggle('context', v, 'No obvious trigger')} />
        {triggerCandidates.length ? (
          <>
            <FieldLabel hint="Optional. Only mark these if it feels true to you. Everything else is treated as happening at the same time, not as a cause.">
              I think this may have triggered it
            </FieldLabel>
            <ChoiceChips
              options={triggerCandidates}
              selected={form.triggers.filter((t) => triggerCandidates.includes(t))}
              onToggle={(v) => toggle('triggers', v)}
            />
          </>
        ) : null}
      </>
    ),

    flare: () => (
      <>
        <StepHeader title="Did this feel like a flare up?" hint="Mark this if this episode felt like a flare up to you." />
        <ChoiceChips
          single
          options={['Yes', 'No']}
          selected={form.flare == null ? [] : [form.flare ? 'Yes' : 'No']}
          onToggle={(v) => set('flare', form.flare === (v === 'Yes') ? null : v === 'Yes')}
        />
        <Text style={[font('footnote'), { color: C.secondary, marginTop: 12 }]}>
          Saved as a flare up you reported. It isn't a diagnosis.
        </Text>
      </>
    ),

    helped: () => (
      <>
        <StepHeader title="What helped?" hint="Choose all that apply." />
        <ChoiceChips options={HELPED} selected={form.helped} onToggle={(v) => toggle('helped', v, 'Nothing')} />
        {helpedSomething ? (
          <>
            <FieldLabel>How much did it help?</FieldLabel>
            <ChoiceChips
              single
              options={HELPED_AMOUNT}
              selected={form.helpedAmount ? [form.helpedAmount] : []}
              onToggle={(v) => pick('helpedAmount', v)}
            />
          </>
        ) : null}
      </>
    ),

    summary: () => (
      <>
        <Text style={[font('footnote', 'semibold'), { color: C.tint }]}>{episodeTitle(episode)}</Text>
        <StepHeader title="Check this before saving" hint="You can change anything with Edit." />
        <Panel>
          {summarize(episode).map((section, n) => (
            <View key={section.label} style={[l.summaryRow, n > 0 && l.summarySep]}>
              <Text style={[font('footnote'), { color: C.secondary }]}>{section.label}</Text>
              {section.lines.map((line) => (
                <Text key={line} style={[font('body'), { color: C.text }]}>
                  {line}
                </Text>
              ))}
            </View>
          ))}
        </Panel>
      </>
    ),
  };

  const footer =
    step === 'summary' ? (
      <View style={l.footer}>
        <PrimaryButton label="Add to My Health Record" onPress={save} />
        <SecondaryButton label="Edit" onPress={mode === 'similar' ? editAll : () => setIndex(0)} />
      </View>
    ) : (
      <View style={l.footer}>
        <PrimaryButton
          label={steps[at + 1] === 'summary' ? 'Review' : 'Next'}
          onPress={next}
          disabled={step === 'what' && form.kinds.length === 0}
        />
        {step !== 'what' ? <LinkButton center label="Skip this step" onPress={next} /> : null}
      </View>
    );

  return (
    <DetailScreen title="Log Cycle Experience" onBack={back} footer={footer}>
      <StepProgress index={at} total={steps.length} />
      {body[step]()}
      {step !== 'summary' ? (
        <NoteField open={noteOpen} onOpen={() => setNoteOpen(true)} value={form.note} onChange={(v) => set('note', v)} />
      ) : null}
    </DetailScreen>
  );
}

const l = StyleSheet.create({
  gap: { marginTop: 24 },
  care: { flexDirection: 'row', gap: 12 },
  panelLabel: { color: C.secondary, marginBottom: 12 },
  summaryRow: { paddingVertical: 10, gap: 2 },
  summarySep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },
  footer: {
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
  },
});
