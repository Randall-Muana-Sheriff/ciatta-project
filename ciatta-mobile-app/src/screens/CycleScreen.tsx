import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { countedWindows, medianLength } from '../lib/cycleModel';
import { painSplit, tally } from '../lib/cyclePatterns';
import { displayCopy } from '../lib/displayCopy';
import { FERTILITY_DISCLAIMER, fmtRange } from '../lib/fertility';
import { chooseLogCategory } from '../lib/logHandoff';
import { useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useData } from '../state/session';
import { C, font } from '../theme';
import { ListGroup, ListRow, Panel } from '../ui/chrome';
import { ObservationCard } from '../ui/cycleInputs';
import { DetailScreen, PrimaryButton, SecLabel, SecondaryButton, SourceFooter, Tag } from '../ui/kit';
import { FertilityStrip, LengthDots, MonthsSince, PostpartumTimeline } from '../ui/lineCharts';
import { experienceRows } from '../lib/experienceRows';
import { hormoneView, phaseEffects } from '../lib/hormones';
import { HormonesSection } from '../ui/HormonesSection';
import { L, TILE_RADIUS } from '../ui/surface';
import { CardFill } from '../ui/cardFill';
import { G } from '../ui/scheme';

// Cycle home: timing, then what the cycle felt like, then how it's changing.
export function CycleScreen() {
  const nav = useNav();
  const { startDraft } = useCycle();
  const { signals, summaries, observations, template, lens, profile, fertility, windows } = useCycleInsights();
  const { days } = useData();
  // Hormones: the typical shape fitted to her cycle, and each phase in her
  // own record. Placed by her open cycle and her usual length.
  const hormones = useMemo(() => {
    const open = windows[windows.length - 1] ?? null;
    const counted = countedWindows(windows, profile);
    return hormoneView({
      open: open && !open.end ? open : null,
      usualLength: counted.length ? medianLength(counted) : null,
      situations: profile.situations,
      confirmedOvulation: fertility.confirmedThisCycle && fertility.ovulation ? fertility.ovulation.start : null,
      now: new Date(),
    });
  }, [windows, profile, fertility]);
  const effects = useMemo(() => phaseEffects(days, windows), [days, windows]);

  const current = summaries[summaries.length - 1] ?? null;
  const last4 = summaries.slice(-4);
  const mine = current ? signals.filter((s) => s.cycle === current.window) : [];
  const top = (lists: string[][], n: number) => tally(lists).slice(0, n).map((x) => x.label);

  // Each row of Your Experience: one total, with what makes it up counted.
  const exp = experienceRows(current ? current.painDays : null, mine);
  const overallLocations = top(signals.filter((s) => s.pain).map((s) => s.episode.locations), 3);
  const split = lens.painSplit ? painSplit(signals) : null;

  // Logged the way everything is: the Log screen on Cycle, voice and text
  // first, with the step by step form a link inside it.
  const log = () => {
    chooseLogCategory('cycle');
    nav.push('quickLog');
  };
  const similar = () => {
    if (!template) return;
    startDraft({ mode: 'similar', form: template });
    nav.push('cycleLog');
  };
  const history = () => nav.push('cycleHistory');

  return (
    <DetailScreen
      title="Cycle"
      onBack={nav.back}
      footer={<SourceFooter kind="logged" text="Pain, symptoms, and flare ups are what you reported." />}
    >
      <Pressable
        onPress={() => nav.push('cycleProfile')}
        accessibilityRole="button"
        accessibilityLabel={`What you told us: ${lens.tags.join(', ') || 'nothing yet'}. Edit`}
        style={cy.told}
      >
        <Text style={[font('footnote'), { color: G.body }]}>What you told us</Text>
        <View style={cy.tagRow}>
          {lens.tags.length ? lens.tags.map((t) => <Tag key={t} label={t} tone="neutral" />) : <Tag label="Not set" tone="neutral" />}
        </View>
      </Pressable>

      {!profile.setupDone ? (
        <Panel style={cy.below}>
          <Text style={[font('headline'), { color: C.text }]}>Tell us about your cycle</Text>
          <Text style={[font('subhead'), { color: C.secondary, marginTop: 4 }]}>
            Conditions and life stages change what is useful to track and what can be predicted.
          </Text>
          <View style={{ marginTop: 12 }}>
            <SecondaryButton label="Set Up Your Cycle" onPress={() => nav.push('cycleProfile')} />
          </View>
        </Panel>
      ) : null}

      <View style={cy.tiles}>
        <View style={cy.tile}>
          <CardFill />
          <Text style={[font('footnote'), { color: C.secondary }]}>{displayCopy(lens.header.label)}</Text>
          <Text style={[font('title2', 'semibold'), { color: C.text }]}>{displayCopy(lens.header.value)}</Text>
        </View>
        {lens.secondary ? (
          <View style={cy.tile}>
            <CardFill />
            <Text style={[font('footnote'), { color: C.secondary }]}>{displayCopy(lens.secondary.label)}</Text>
            <Text style={[font('title2', 'semibold'), { color: C.text }]}>{displayCopy(lens.secondary.value)}</Text>
          </View>
        ) : null}
      </View>

      {lens.chart !== 'none' ? (
        <Panel style={cy.below}>
          {lens.chart === 'lengthDots' ? (
            <>
              <Text style={[font('footnote'), cy.chartLabel]}>Cycle lengths</Text>
              <LengthDots lengths={lens.lengths} />
            </>
          ) : null}
          {lens.chart === 'postpartumTimeline' && lens.weeksSinceBirth != null ? (
            <>
              <Text style={[font('footnote'), cy.chartLabel]}>Since birth</Text>
              <PostpartumTimeline weeks={lens.weeksSinceBirth} periodWeeks={lens.periodWeeks} />
            </>
          ) : null}
          {lens.chart === 'monthsSince' && lens.monthsSince != null ? (
            <>
              <Text style={[font('footnote'), cy.chartLabel]}>Months since your last period</Text>
              <MonthsSince months={lens.monthsSince} />
            </>
          ) : null}
        </Panel>
      ) : null}

      {lens.notes.map((n) => (
        <Text key={n} style={[font('footnote'), cy.note]}>
          {displayCopy(n)}
        </Text>
      ))}

      {split ? (
        <Panel style={cy.below}>
          <Text style={[font('footnote'), { color: C.secondary }]}>Pain days, last 90 days</Text>
          <View style={[cy.tiles, { marginBottom: 0, marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[font('title3', 'semibold'), { color: C.text }]}>{split.during}</Text>
              <Text style={[font('footnote'), { color: C.secondary }]}>During your period</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[font('title3', 'semibold'), { color: C.text }]}>{split.outside}</Text>
              <Text style={[font('footnote'), { color: C.secondary }]}>Outside your period</Text>
            </View>
          </View>
        </Panel>
      ) : null}

      {fertility.show ? (
        <Panel style={cy.below}>
          <Text style={[font('headline'), { color: C.text }]}>Fertile window</Text>
          {fertility.fertile && fertility.ovulation && current ? (
            <>
              <View style={{ marginVertical: 8 }}>
                <FertilityStrip
                  start={current.window.start}
                  fertile={fertility.fertile}
                  ovulation={fertility.ovulation}
                  confirmed={fertility.confirmedThisCycle}
                />
              </View>
              <Text style={[font('subhead'), { color: C.text }]}>
                {displayCopy(
                  fertility.confirmedThisCycle
                    ? `Ovulation confirmed around ${fmtRange(fertility.ovulation.start, fertility.ovulation.end)}.`
                    : `Fertile window likely ${fmtRange(fertility.fertile.start, fertility.fertile.end)}. Ovulation most likely ${fmtRange(fertility.ovulation.start, fertility.ovulation.end)}.`,
                )}
              </Text>
              <Text style={[font('footnote'), cy.fertileLine]}>{displayCopy(`${fertility.confidence} confidence: ${fertility.why}.`)}</Text>
            </>
          ) : null}
          {fertility.notes.map((n) => (
            <Text key={n} style={[font('footnote'), cy.fertileLine]}>
              {displayCopy(n)}
            </Text>
          ))}
          <Text style={[font('footnote'), cy.fertileLine]}>{displayCopy(FERTILITY_DISCLAIMER)}</Text>
        </Panel>
      ) : fertility.hiddenReason ? (
        <Text style={[font('footnote'), cy.note]}>{displayCopy(fertility.hiddenReason)}</Text>
      ) : null}

      <View style={cy.below} />

      <PrimaryButton label="Log Cycle Experience" onPress={log} />

      {template ? (
        <Panel style={cy.gap}>
          <Text style={[font('headline'), { color: C.text }]}>Pain again?</Text>
          <Text style={[font('subhead'), { color: C.secondary, marginTop: 4 }]}>
            Your usual details are filled in, so you only add what changed.
          </Text>
          <View style={{ marginTop: 12 }}>
            <SecondaryButton label="Log Similar Episode" onPress={similar} />
          </View>
        </Panel>
      ) : null}

      <View style={cy.section}>
        <SecLabel>Your Experience</SecLabel>
        <ListGroup>
          <ListRow first icon="wave" tint={C.coral} title="Pain" sub={exp.pain.sub} value={exp.pain.value ?? undefined} onPress={history} />
          <ListRow icon="body" tint={C.coral} title="Where it hurts" sub={exp.places.sub} value={exp.places.value ?? undefined} onPress={history} />
          <ListRow icon="target" tint={C.indigo} title="Common sensations" sub={exp.sensations.sub} value={exp.sensations.value ?? undefined} onPress={history} />
          <ListRow icon="triangle" tint={C.violet} title="Symptoms" sub={exp.symptoms.sub} value={exp.symptoms.value ?? undefined} onPress={history} />
          <ListRow icon="flame" tint={C.coral} title="Flare ups" sub={exp.flares.sub} value={exp.flares.value ?? undefined} onPress={history} />
        </ListGroup>
      </View>

      <View style={cy.section}>
        <SecLabel>Over Time</SecLabel>
        <ListGroup>
          {lens.lengths.length ? <ListRow first title="Cycle length" sub={`${lens.lengths.slice(-4).join(' → ')} days`} /> : null}
          <ListRow first={!lens.lengths.length} title="Pain days" sub={last4.map((c) => c.painDays).join(' → ') || 'None logged'} />
          <ListRow title="Pain locations" sub={overallLocations.join(' · ') || 'None logged'} />
        </ListGroup>
      </View>

      {/* Hormones across the cycle, under her cycle's own data. */}
      <View style={cy.section}>
        <SecLabel>Hormones</SecLabel>
        {hormones?.applies ? (
          <HormonesSection view={hormones} effects={effects} />
        ) : (
          <Text style={[font('footnote'), cy.note]}>
            {hormones
              ? 'Your situation changes the usual hormone pattern, so a typical curve would not describe your cycle. Your own data still shows here as it builds.'
              : 'Log a period, and Ciatta places you in your cycle and shows how hormones typically move through it.'}
          </Text>
        )}
      </View>

      {observations.length ? (
        <View style={cy.section}>
          <SecLabel>Patterns</SecLabel>
          {observations.map((o) => (
            <ObservationCard key={o.id} observation={o} />
          ))}
        </View>
      ) : null}

      <View style={[cy.section, { gap: 12 }]}>
        <SecondaryButton label="Pain & Flare History" onPress={history} />
        <SecondaryButton label="View Cycle Journey" onPress={() => nav.goTab('journey')} />
      </View>
    </DetailScreen>
  );
}

const cy = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tile: {
    flex: 1,
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    padding: 14,
    gap: 2,
    overflow: 'hidden',
  },
  gap: { marginTop: 16 },
  section: { marginTop: 28 },
  told: { minHeight: 44, gap: 6, marginBottom: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  below: { marginBottom: 16 },
  chartLabel: { color: C.secondary, marginBottom: 6 },
  note: { color: G.body, marginBottom: 8 },
  fertileLine: { color: C.secondary, marginTop: 6 },
});
