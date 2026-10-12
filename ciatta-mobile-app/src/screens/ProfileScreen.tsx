import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { expo } from '../../app.json';
import { deleteAccount, exportAndShare } from '../data/account';
import type { Data } from '../data/adapter';
import type { SourceKind, Tone } from '../data/sample';
import type { SourceView } from '../data/rows';
import type { Reported } from '../data/repo';
import { type Connection, loadConnections } from '../data/providers';
import { profileOverview } from '../lib/profileOverview';
import { connectAppleHealth } from '../lib/connectHealth';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { type Screen, useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useData, useRepo, useSession } from '../state/session';
import { C, font, GUTTER, numeral, RADIUS } from '../theme';
import { L, NAV_CLEARANCE, TILE_RADIUS } from '../ui/surface';
import { LargeTitle, ListGroup, ListRow, Panel, TextButton } from '../ui/chrome';
import { Icon } from '../ui/icons';
import { images } from '../ui/images';
import { avatarInitial } from '../ui/initial';
import { EmptyNote, Expandable, Facts, LinkButton, SecondaryButton, SegmentedControl, Tag } from '../ui/kit';

type Profile = NonNullable<Data['profile']>;

// Three, not five. Health Info, Biomarkers and Care were three doors into
// one subject: what is in her record and who is looking after it. Splitting
// them meant a lab result and the clinician who ordered it lived on
// different screens.
const SEGMENTS = ['Overview', 'Health', 'Settings'] as const;
type Segment = (typeof SEGMENTS)[number];

const TONE: Record<Tone, string> = {
  coral: C.coral,
  mint: '#2FB8B4',
  lavender: C.indigo,
  indigo: C.blue,
  text: C.fillSelected,
};

// Account, export and sharing flows arrive with the data layer.
const notYet = () => {};

// ── Overview pieces ────────────────────────────────────────────

function StatTiles({ cols, profile }: { cols: 2 | 4; profile: Profile }) {
  return (
    <View style={p.grid}>
      {profile.stats.map((s) => (
        <View
          key={s.label}
          style={[p.tile, { width: cols === 4 ? '23.5%' : '48.5%' }]}
          accessible
          accessibilityLabel={`${s.label}, ${s.value}${s.sub ? `, ${s.sub}` : ''}`}
        >
          <Icon name={s.icon} size={20} color={s.tone === 'lavender' ? C.lavender : C.coral} weight={1.8} />
          <Text style={[font('footnote'), { color: C.secondary, marginTop: 8 }]}>{s.label}</Text>
          <Text style={[font('title3', 'semibold'), { color: C.text }]}>{displayCopy(s.value)}</Text>
          {s.sub ? <Text style={[font('footnote'), { color: C.secondary }]}>{s.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function CareGroup({ profile }: { profile: Profile }) {
  return (
    <ListGroup header="Care and Coverage">
      {profile.care.map((c, n) => (
        <ListRow
          key={c.label}
          first={n === 0}
          icon={c.icon}
          tint={TONE[c.tone]}
          title={c.label}
          sub={`${c.value} · ${c.sub}`}
          onPress={notYet}
        />
      ))}
      <ListRow icon="shield" tint={TONE.lavender} title="Insurance" sub="Anthem · PPO" onPress={notYet} />
    </ListGroup>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const len = 2 * Math.PI * r;
  return (
    <View style={p.ring} accessible accessibilityLabel={`Health score ${score} out of 100`}>
      <Svg width={88} height={88} viewBox="0 0 88 88" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="score" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={C.coral} />
            <Stop offset="0.5" stopColor={C.indigo} />
            <Stop offset="1" stopColor={C.mint} />
          </LinearGradient>
        </Defs>
        <Circle cx={44} cy={44} r={r} stroke={C.fill} strokeWidth={7} fill="none" />
        <Circle
          cx={44}
          cy={44}
          r={r}
          stroke="url(#score)"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(len * score) / 100} ${len}`}
          transform="rotate(-90 44 44)"
        />
      </Svg>
      <Text style={[numeral(28, 'bold'), { color: C.text }]}>{score}</Text>
    </View>
  );
}

const OVERVIEW_TONE: Record<Tone, string> = { coral: C.coral, mint: C.mint, lavender: C.lavender, indigo: C.lavender, text: C.gray };

function HealthOverview({ profile }: { profile: Profile }) {
  return (
    <Panel>
      <View style={p.overviewTop}>
        <ScoreRing score={profile.score} />
        <View style={{ flex: 1 }}>
          <Text style={[font('headline'), { color: C.text }]}>Health Overview</Text>
          <Text style={[font('footnote'), { color: C.secondary, marginTop: 2 }]}>
            A snapshot of your health from the data available, out of 100.
          </Text>
        </View>
      </View>
      <View style={p.progressRow}>
        {profile.overview.map((g) => (
          <View
            key={g.label}
            style={{ flex: 1 }}
            accessible
            accessibilityLabel={`${g.label}, ${g.done} of ${g.total} complete`}
          >
            <Text style={[font('footnote', 'semibold'), { color: C.text }]}>{g.label}</Text>
            <View style={p.segments}>
              {Array.from({ length: g.total }, (_, i) => (
                <View key={i} style={[p.segment, { backgroundColor: i < g.done ? OVERVIEW_TONE[g.tone] : C.fill }]} />
              ))}
            </View>
            <Text style={[font('caption1'), { color: C.secondary, marginTop: 4 }]}>
              {g.done} of {g.total} done
            </Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

function DetailsGroup({ onOpen, profile }: { onOpen: (screen: Screen) => void; profile: Profile }) {
  return (
    <ListGroup header="Health Details">
      {profile.records.map((r, n) => (
        <ListRow
          key={r.title}
          first={n === 0}
          icon={r.icon}
          tint={TONE[r.tone]}
          title={r.title}
          sub={r.lines.join(' · ')}
          onPress={r.screen ? () => onOpen(r.screen!) : undefined}
        />
      ))}
    </ListGroup>
  );
}

function CycleGroup({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const { profile } = useCycle();
  return (
    <ListGroup header="Your Cycle">
      <ListRow
        first
        icon="drop"
        tint={C.coral}
        title="Cycle Situation"
        sub={profile.situations.join(' · ') || 'Not set yet'}
        onPress={() => onOpen('cycleProfile')}
      />
    </ListGroup>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const W = 56;
  const H = 20;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const d = points
    .map((v, i) => `${i ? 'L' : 'M'}${(i / (points.length - 1)) * W},${H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4)}`)
    .join(' ');
  return (
    <Svg width={W} height={H}>
      <Path d={d} stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function Biomarkers({ onOpen, profile }: { onOpen: (screen: Screen) => void; profile: Profile }) {
  return (
    <View>
      <View style={p.sectionHead}>
        <Text style={[font('title3', 'semibold'), { color: C.text, flex: 1 }]} accessibilityRole="header">
          Biomarkers
        </Text>
        <TextButton label="View Trends" onPress={() => onOpen('healthrecords')} />
      </View>
      <View style={p.grid}>
        {profile.biomarkers.map((b) => (
          <View key={b.label} style={[p.tile, { width: '48.5%' }]} accessible accessibilityLabel={`${b.label}, ${b.value} ${b.unit}, ${b.change}`}>
            <Text style={[font('footnote'), { color: C.secondary }]}>{b.label}</Text>
            <View style={p.bioValue}>
              <Text style={[numeral(24), { color: C.text }]}>{b.value}</Text>
              <Text style={[font('footnote'), { color: C.secondary }]}>{b.unit}</Text>
            </View>
            <View style={p.bioFoot}>
              <Text style={[font('caption1', 'semibold'), { color: C.secondary }]}>{b.change}</Text>
              <Sparkline points={b.trend} color={C.mint} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 12 }}>
        <SecondaryButton label="View Full Report" onPress={() => onOpen('healthrecords')} />
      </View>
    </View>
  );
}

function BodySystems({ profile }: { profile: Profile }) {
  return (
    <View>
      <Text style={[font('title3', 'semibold'), { color: C.text, marginBottom: 8 }]} accessibilityRole="header">
        Body Systems
      </Text>
      <View style={p.grid}>
        {profile.bodySystems.map((b) => (
          <View key={b.label} style={p.system}>
            <Icon name={b.icon} size={20} color={b.tone === 'text' ? C.secondary : OVERVIEW_TONE[b.tone]} weight={1.8} />
            <Text style={[font('subhead'), { color: C.text, flex: 1 }]}>{displayCopy(b.label)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// A hospital or clinic she linked, and what has come from it.
function Providers({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const [list, setList] = useState<Connection[] | null>(null);

  useEffect(() => {
    let ignore = false;
    loadConnections()
      .then((rows) => {
        if (!ignore) setList(rows);
      })
      .catch(() => {
        // Left null, so the section says nothing rather than claiming
        // she has no providers when the read simply failed.
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <View>
      <Text style={[font('title3', 'semibold'), { color: C.text, marginBottom: 4 }]} accessibilityRole="header">
        Providers
      </Text>
      <Text style={[font('footnote'), { color: C.secondary, marginBottom: 10 }]}>
        Your hospital or clinic, connected through their own patient portal.
      </Text>

      {list?.length ? (
        <ListGroup>
          {list.map((c, n) => (
            <ListRow
              key={c.id}
              first={n === 0}
              icon="stethoscope"
              tint={TONE.lavender}
              title={c.endpointName}
              // Counted, never characterised. "412 records" is a fact;
              // "your records are up to date" would be a claim about a
              // chart Ciatta cannot see the whole of.
              sub={
                c.status === 'active'
                  ? `${c.recordCount} records`
                  : c.status === 'expired'
                    ? 'Needs connecting again'
                    : c.lastError
                      ? 'Something went wrong'
                      : 'Connected, nothing yet'
              }
              // A connection she can open is one she can verify. A row
              // that counted records and could not show them would be
              // asking her to take the number on trust.
              onPress={() => onOpen('chart')}
            />
          ))}
        </ListGroup>
      ) : list ? (
        <Text style={[font('footnote'), { color: C.secondary }]}>No provider connected yet.</Text>
      ) : null}

      <View style={{ marginTop: 12 }}>
        <SecondaryButton label="Connect a Provider" onPress={() => onOpen('providerConnect')} />
      </View>
    </View>
  );
}

// What she told Ciatta, in her own words, grouped as she gave it.
//
// Null while the read is in flight is not the same as nothing reported,
// so the section waits rather than claiming an empty history.
function Reported({ reported }: { reported: Reported | null }) {
  if (!reported) return null;
  const groups: { header: string; items: string[] }[] = [
    { header: 'Conditions', items: reported.conditions },
    { header: 'Surgeries', items: reported.surgeries },
    { header: 'Medications', items: reported.medications },
    { header: 'Supplements', items: reported.supplements },
  ].filter((g) => g.items.length > 0);

  if (!groups.length) {
    return <EmptyNote text="Ciatta has not been told about any conditions or medications yet." />;
  }

  return (
    <>
      {groups.map((g) => (
        <ListGroup key={g.header} header={g.header}>
          {g.items.map((item, n) => (
            <ListRow key={item} first={n === 0} title={item} sub="You told Ciatta" />
          ))}
        </ListGroup>
      ))}
    </>
  );
}

// ── Settings: sources, notifications, privacy, account ────────

const KIND_LABEL: Record<SourceKind, string> = { measured: 'Measured', lab: 'Lab', logged: 'You logged' };

// Where each source's link goes. Devices have no screen of their own yet.
const SOURCE_LINK: Partial<Record<SourceKind, { label: string; screen: Screen }>> = {
  lab: { label: 'See health records', screen: 'healthrecords' },
  logged: { label: 'See your notes', screen: 'journal' },
};

function Settings({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [newFindings, setNewFindings] = useState(true);
  const [appointments, setAppointments] = useState(false);
  const [list, setList] = useState<SourceView[]>([]);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [dataFooter, setDataFooter] = useState<string | null>(null);
  const [accountNote, setAccountNote] = useState<string | null>(null);
  const { mode, userId, signOut } = useSession();
  const repo = useRepo();

  useEffect(() => {
    let ignore = false;
    repo.loadSources().then((rows) => {
      if (!ignore) setList(rows);
    }).catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo]);

  const refreshSources = () => {
    repo.loadSources().then(setList).catch(() => {});
  };

  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string) => (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: C.fill, true: C.green }}
      ios_backgroundColor={C.fill}
      accessibilityLabel={label}
    />
  );

  // Real mode walks availability, then permission, then a recovery sync,
  // writing the Apple Health source's status at each step so it always
  // reflects what actually happened, never what was merely attempted. Demo
  // mode keeps today's honest notice: nothing here is hers to connect.
  const onConnectSource = async () => {
    if (mode === 'demo') {
      setSourceNote('This is an example person. Sign in to connect your own sources.');
      return;
    }
    if (!userId || connecting) return;
    setConnecting(true);
    try {
      // The sequence itself now lives in lib/connectHealth, shared with
      // onboarding, which offers the same connection. The status writing that
      // keeps health_sources honest moved with it.
      await connectAppleHealth({
        userId,
        saveStatus: (kind, status, lastSyncedAt) => repo.saveSourceStatus(kind, status, lastSyncedAt),
        onNote: setSourceNote,
      });
      refreshSources();
    } catch (e) {
      setSourceNote(userFacingError(e, 'Apple Health did not connect. Try again.'));
    } finally {
      setConnecting(false);
    }
  };

  const onDownload = () => {
    if (mode === 'demo') {
      setDataFooter('The example person has no data to download.');
      return;
    }
    if (!userId) return;
    exportAndShare(userId).catch((e) => setDataFooter(userFacingError(e, 'Your data did not download. Try again.')));
  };

  const onDelete = () => {
    if (!userId) return;
    Alert.alert('Delete your account?', 'Your record, notes, sources and files are deleted for good. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteAccount(userId)
            .then((keptOnThisPhone) => {
              // Her account is gone either way; only say the phone is clean
              // when it is.
              if (keptOnThisPhone.length) {
                setAccountNote(displayCopy('Your account is deleted. Some of what was saved on this phone could not be removed.'));
              }
            })
            .catch((e) => setAccountNote(userFacingError(e, 'Your account was not deleted. Try again.'))),
      },
    ]);
  };

  return (
    <View style={p.stack}>
      <View>
        <Text style={[font('title3', 'semibold'), { color: C.text, marginBottom: 4 }]} accessibilityRole="header">
          Sources
        </Text>
        {list.map((src, n) => {
          const link = SOURCE_LINK[src.kind];
          return (
            <Expandable
              key={src.name}
              first={n === 0}
              title={src.name}
              sub={`${KIND_LABEL[src.kind]} · ${src.status}`}
              open={open === src.name}
              onToggle={() => setOpen(open === src.name ? null : src.name)}
            >
              <View style={{ marginBottom: 8 }}>
                <Tag label={KIND_LABEL[src.kind]} tone={src.kind} />
              </View>
              <Facts rows={src.facts} />
              {link ? (
                <LinkButton label={link.label} onPress={() => onOpen(link.screen)} />
              ) : (
                <LinkButton label="Manage access" onPress={notYet} />
              )}
            </Expandable>
          );
        })}
        <View style={{ marginTop: 12 }}>
          <SecondaryButton label="Connect a Source" onPress={onConnectSource} />
        </View>
        {sourceNote ? <Text style={[font('footnote'), { color: C.secondary, marginTop: 8 }]}>{displayCopy(sourceNote)}</Text> : null}
      </View>

      {/*
        Providers sit apart from devices on purpose. A ring and a hospital
        are not the same kind of source: one streams readings she
        produces, the other holds the record somebody else wrote about
        her, and listing them together would blur exactly the line this
        app keeps everywhere else.
      */}
      <Providers onOpen={onOpen} />

      <ListGroup header="Notifications" footer="No nudges to log, and no reminders to take anything.">
        <ListRow
          first
          title="New Findings"
          sub="Only once a pattern has appeared more than once"
          right={toggle(newFindings, setNewFindings, 'New findings')}
        />
        <ListRow
          title="Before Appointments"
          sub="The day before, so you can prepare"
          right={toggle(appointments, setAppointments, 'Before appointments')}
        />
      </ListGroup>

      <ListGroup header="Privacy and Data" footer={dataFooter ?? undefined}>
        <ListRow first title="Who Can See This" sub="Only you. Nothing is sold or shared." onPress={notYet} />
        <ListRow title="Share with a Clinician" sub="A summary to bring to an appointment" onPress={notYet} />
        <ListRow title="Download Your Data" sub="Everything you and your sources have shared" onPress={onDownload} />
      </ListGroup>

      <ListGroup footer={accountNote ?? undefined}>
        <ListRow first title="Sign Out" onPress={signOut} />
        {mode === 'real' ? <ListRow title="Delete Account and Data" destructive onPress={onDelete} /> : null}
      </ListGroup>

      <Text style={[font('footnote'), p.version]}>Version {expo.version}</Text>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────

export function ProfileScreen() {
  const nav = useNav();
  const { width } = useWindowDimensions();
  const repo = useRepo();
  const { profile, person, mode, days } = useData();
  const [sources, setSources] = useState<SourceView[]>([]);

  useEffect(() => {
    let ignore = false;
    repo
      .loadSources()
      .then((rows) => {
        if (!ignore) setSources(rows);
      })
      .catch(() => {
        // No source named rather than one assumed.
      });
    return () => {
      ignore = true;
    };
  }, [repo]);
  const [seg, setSeg] = useState<Segment>('Overview');
  const [reported, setReported] = useState<Reported | null>(null);
  const [onboardedAt, setOnboardedAt] = useState<Date | null>(null);

  useEffect(() => {
    let ignore = false;
    void Promise.all([repo.loadReported(), repo.loadOnboardedAt()])
      .then(([r, at]) => {
        if (ignore) return;
        setReported(r);
        setOnboardedAt(at ? new Date(at) : null);
      })
      .catch(() => {
        // The paragraph says the record is empty rather than guessing.
      });
    return () => {
      ignore = true;
    };
  }, [repo]);

  const overview = useMemo(
    () =>
      profileOverview({
        name: person?.firstName ?? null,
        since: onboardedAt,
        conditions: reported?.conditions ?? [],
        surgeries: reported?.surgeries ?? [],
        medications: reported?.medications ?? [],
        supplements: reported?.supplements ?? [],
        symptoms: [],
        observationCount: days.reduce((n, d) => n + (d.steps != null ? 1 : 0) + (d.sleepHours != null ? 1 : 0), 0),
        daysWithData: days.length,
        sources: sources.filter((x) => x.status === 'active').map((x) => x.name),
        now: new Date(),
      }),
    [person, onboardedAt, reported, days, sources],
  );
  const cols = width >= 430 ? 4 : 2;
  // Her own first name until her record holds a full profile.
  const name = profile?.name ?? person?.firstName ?? null;
  // The sample portrait is a photograph of one particular woman. It belongs
  // to the example person and nobody else: her own circle is her initial.
  const initial = avatarInitial(name);

  return (
    <ScrollView style={p.fill} contentContainerStyle={p.body}>
      <LargeTitle title="Profile" trailing={<TextButton label="Edit" onPress={() => setSeg('Settings')} />} />

      <View style={p.pad}>
        <View style={p.identity}>
          {mode === 'demo' ? (
            <Image source={images.avatar} style={p.avatar} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[p.avatar, p.initial]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {initial ? (
                <Text style={[font('title2', 'semibold'), { color: C.secondary }]}>{initial}</Text>
              ) : (
                <Icon name="person" size={34} color={C.secondary} weight={1.8} />
              )}
            </View>
          )}
          <View style={{ flex: 1 }}>
            {name ? <Text style={[font('title2', 'semibold'), { color: C.text }]}>{displayCopy(name)}</Text> : null}
            {profile ? (
              <Text style={[font('subhead'), { color: C.secondary }]}>
                {profile.age} · {profile.born}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={p.segs}>
        <SegmentedControl segments={SEGMENTS} active={seg} onChange={setSeg} />
      </View>

      <View style={[p.pad, p.stack]}>
        {/*
          Real mode. The paragraph was being computed and then thrown
          away: it only rendered inside the profile branch, which is
          sample only, so a signed in woman saw an empty note on a
          record that was not empty.

          What is not here is deliberate. No score ring and no stat
          tiles: a health score out of 100 is a number nobody can
          compute from her rows without inventing most of it, and this
          app does not invent numbers. The paragraph says what is in
          her record, which is the question someone opens their own
          profile to answer.
        */}
        {!profile && seg === 'Overview' ? (
          <>
            <View style={p.overviewCard}>
              <Text style={[font('body'), p.overviewText]}>{displayCopy(overview)}</Text>
            </View>
            <CycleGroup onOpen={nav.push} />
          </>
        ) : null}

        {!profile && seg === 'Health' ? (
          <>
            <Reported reported={reported} />
            <CycleGroup onOpen={nav.push} />
            <ListGroup header="From your providers" footer="Results and notes your hospital sent, in their words.">
              <ListRow
                first
                icon="doc"
                tint={TONE.lavender}
                title="Provider records"
                sub="Results, conditions and medications"
                onPress={() => nav.push('chart')}
              />
            </ListGroup>
          </>
        ) : null}
        {profile && seg === 'Overview' ? (
          <>
            {/*
              Her record in a paragraph before any of it is counted. The
              tiles and rings said how much is there; this says what is
              there, which is the question someone opens their own profile
              to answer. It grows as the record does.
            */}
            <View style={p.overviewCard}>
              <Text style={[font('body'), p.overviewText]}>{displayCopy(overview)}</Text>
            </View>
            <StatTiles cols={cols} profile={profile} />
            <HealthOverview profile={profile} />
          </>
        ) : null}
        {profile && seg === 'Health' ? (
          <>
            {/*
              One subject, one screen: what she told Ciatta, what her
              cycle looks like, what the labs say, and who is looking
              after her. A lab result and the clinician who ordered it
              belong in the same place.
            */}
            <DetailsGroup onOpen={nav.push} profile={profile} />
            <CycleGroup onOpen={nav.push} />
            <Biomarkers onOpen={nav.push} profile={profile} />
            <BodySystems profile={profile} />
            <CareGroup profile={profile} />
          </>
        ) : null}
        {seg === 'Settings' ? <Settings onOpen={nav.push} /> : null}
      </View>
    </ScrollView>
  );
}

const p = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: NAV_CLEARANCE },
  pad: { paddingHorizontal: GUTTER },
  stack: { gap: 28 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  initial: { backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  // Profile's scroll body has no gutter of its own, so each section pads
  // itself. The bottom margin comes from the control's own wrapper.
  segs: { marginTop: 20, paddingHorizontal: GUTTER },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: { backgroundColor: C.card, borderRadius: RADIUS, padding: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },

  // The paragraph sits on the statement ground the system keeps for one
  // sentence at a time.
  overviewCard: {
    backgroundColor: L.statement,
    borderRadius: TILE_RADIUS,
    padding: 18,
    marginTop: 4,
  },
  overviewText: { color: L.ink, lineHeight: 25 },
  overviewTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  segments: { flexDirection: 'row', gap: 3, marginTop: 6 },
  segment: { flex: 1, height: 5, borderRadius: 2.5 },

  bioValue: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  bioFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },

  system: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: RADIUS,
    backgroundColor: C.card,
  },

  version: { color: C.secondary, textAlign: 'center' },
});
