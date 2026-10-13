import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { expo } from '../../app.json';
import { deleteAccount, exportAndShare } from '../data/account';
import type { Data } from '../data/adapter';
import type { SourceKind, Tone } from '../data/sample';
import type { SourceView } from '../data/rows';
import type { Reported } from '../data/repo';
import { type Connection, loadConnections } from '../data/providers';
import { intelligenceLine, metricLine, patternReadiness } from '../lib/patternReadiness';
import { profileOverview } from '../lib/profileOverview';
import { connectAppleHealth } from '../lib/connectHealth';
import { SYSTEM_DOTS } from '../lib/bodyMap';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { type Screen, useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData, useRepo, useSession } from '../state/session';
import { askForWeather, weatherIsOn } from '../state/environmentRun';
import { registerForFindings } from '../state/notifications';
import { C, font, GUTTER, numeral, RADIUS } from '../theme';
import { L, NAV_CLEARANCE, TILE_RADIUS } from '../ui/surface';
import { ListGroup, ListRow, Panel, TextButton } from '../ui/chrome';
import { ScreenHeader } from '../ui/kit';
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

const OVERVIEW_TONE: Record<Tone, string> = { coral: C.coral, mint: C.mint, lavender: C.lavender, indigo: C.lavender, text: C.gray };

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

// How many measures Ciatta can compare against her own usual. The ring
// used to hold a health score out of 100, which nothing in her rows can
// produce; this holds a count the engine can actually stand behind.
function ReadyRing({ ready, total }: { ready: number; total: number }) {
  const r = 36;
  const len = 2 * Math.PI * r;
  return (
    <View style={p.ring} accessible accessibilityLabel={`${ready} of ${total} measures can be compared with your usual`}>
      <Svg width={88} height={88} viewBox="0 0 88 88" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ready" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={C.coral} />
            <Stop offset="0.5" stopColor={C.indigo} />
            <Stop offset="1" stopColor={C.mint} />
          </LinearGradient>
        </Defs>
        <Circle cx={44} cy={44} r={r} stroke={C.fill} strokeWidth={7} fill="none" />
        {ready ? (
          <Circle
            cx={44}
            cy={44}
            r={r}
            stroke="url(#ready)"
            strokeWidth={7}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(len * ready) / total} ${len}`}
            transform="rotate(-90 44 44)"
          />
        ) : null}
      </Svg>
      <Text style={[numeral(28, 'bold'), { color: C.text }]}>{ready}</Text>
      <Text style={[font('caption2'), { color: C.secondary, marginTop: -2 }]}>of {total}</Text>
    </View>
  );
}

// What Ciatta is doing with her record. It does not grade her health. It
// learns what is usual for her, measure by measure, and says when
// something moves away from that, so the overview shows exactly that: what
// it has found, and how far each measure is from being comparable.
function HealthOverview() {
  const { days } = useData();
  const { ranked } = useInsights();
  const ready = useMemo(() => patternReadiness(days), [days]);
  const found = ranked.filter((i) => i.triage === 'Surface' || i.triage === 'Investigate').length;
  const watching = ranked.filter((i) => i.triage === 'Watch').length;
  const count = ready.filter((r) => r.ready).length;
  return (
    <Panel>
      <View style={p.overviewTop}>
        <ReadyRing ready={count} total={ready.length} />
        <View style={{ flex: 1 }}>
          <Text style={[font('headline'), { color: C.text }]}>Health Overview</Text>
          <Text style={[font('footnote'), { color: C.secondary, marginTop: 2 }]}>
            {displayCopy(intelligenceLine(days, ready, found, watching))}
          </Text>
        </View>
      </View>
      {/*
        One row per measure: how much of its usual Ciatta has learned. The
        bar fills toward the days a comparison needs, not toward a target
        for her to hit.
      */}
      <View style={p.measures}>
        {ready.map((r) => (
          <View key={r.key} accessible accessibilityLabel={`${r.label}, ${metricLine(r)}`}>
            <View style={p.measureHead}>
              <Text style={[font('footnote', 'semibold'), { color: C.text, flex: 1 }]}>{r.label}</Text>
              <Text style={[font('caption1'), { color: C.secondary }]}>
                {r.ready ? 'Comparing' : `${r.have} of ${r.need} days`}
              </Text>
            </View>
            <View style={p.track}>
              <View
                style={[
                  p.fillBar,
                  { width: `${Math.min(100, (r.have / r.need) * 100)}%`, backgroundColor: r.ready ? C.mint : C.lavender },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
      <Text style={[font('caption1'), { color: C.secondary, marginTop: 14 }]}>
        Compared against your own days 35 to 90 back, never a population average.
      </Text>
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

function BodySystems({ profile }: { profile: Profile }) {
  return (
    <View>
      <Text style={[font('title3', 'semibold'), { color: C.text, marginBottom: 8 }]} accessibilityRole="header">
        Body Systems
      </Text>
      <View style={p.grid}>
        {profile.bodySystems.map((b) => (
          <View key={b.label} style={p.system}>
            <Icon name={b.icon} size={20} color={SYSTEM_DOTS[b.label]?.color ?? C.secondary} weight={1.8} />
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

// The weather around her: off until she says yes, then an approximate
// area only. Saying yes fills the last 90 days so patterns she already has
// get their background.
function WeatherRow() {
  const repo = useRepo();
  const [state, setState] = useState<'unknown' | 'off' | 'on' | 'failed' | 'working'>('unknown');
  useEffect(() => {
    weatherIsOn().then((on) => setState(on ? 'on' : 'off'));
  }, []);
  const sub =
    state === 'on'
      ? 'On, for your approximate area only'
      : state === 'failed'
        ? 'Allowed, but weather is not set up yet. It will fill in once it is.'
        : state === 'working'
          ? 'Adding the weather around you'
          : 'Off. Adds the weather and daylight around you as background.';
  return (
    <ListGroup header="Around You" footer="Only a rough area, about 10 km, leaves your phone, and it is never stored.">
      <ListRow
        first
        icon="sun"
        tint={TONE.indigo}
        title="Weather and Daylight"
        sub={sub}
        onPress={
          state === 'on' || state === 'working'
            ? undefined
            : async () => {
                setState('working');
                const r = await askForWeather(repo);
                setState(r === 'off' ? 'off' : r === 'failed' ? 'failed' : 'on');
              }
        }
      />
    </ListGroup>
  );
}

// ── Overview: what feeds her record ──────────────────────────────

// Where her record comes from and what she has set for it: her devices,
// her providers, the weather around her and her goals. On the Overview,
// because these are what make the rest of Profile fill in.
function Connections({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [list, setList] = useState<SourceView[]>([]);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const { mode, userId } = useSession();
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

      <WeatherRow />

      <ListGroup header="Your Goals" footer="Optional. Ciatta never sets these for you.">
        <ListRow first icon="leaf" tint={TONE.mint} title="Nutrition Targets" sub="Calories, protein, carbs, fat" onPress={() => onOpen('nutritionTargets')} />
      </ListGroup>

    </View>
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
  const [newFindings, setNewFindingsState] = useState(true);
  const settingsRepo = useRepo();
  useEffect(() => {
    settingsRepo.loadNotifyFindings().then(setNewFindingsState).catch(() => {});
  }, [settingsRepo]);
  // Saved to her profile, which the server reads before sending a push.
  // Turning it on asks for notifications if she has not been asked yet.
  const setNewFindings = (on: boolean) => {
    setNewFindingsState(on);
    void settingsRepo.saveNotifyFindings(on).catch(() => setNewFindingsState(!on));
    if (on) void registerForFindings(settingsRepo, true);
  };
  const [appointments, setAppointments] = useState(false);
  const [dataFooter, setDataFooter] = useState<string | null>(null);
  const [accountNote, setAccountNote] = useState<string | null>(null);
  const { mode, userId, signOut } = useSession();

  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string) => (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: C.fill, true: C.green }}
      ios_backgroundColor={C.fill}
      accessibilityLabel={label}
    />
  );

  const onDownload = () => {
    if (mode === 'demo') {
      setDataFooter('The example person has no data to download.');
      return;
    }
    if (!userId) return;
    // Every table she has, read and written to one file, takes a moment.
    setDataFooter('Gathering your record into one file.');
    exportAndShare(userId)
      .then(() => setDataFooter(null))
      .catch((e) => setDataFooter(userFacingError(e, 'Your data did not download. Try again.')));
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
        <ListRow first title="Who Can See This" sub="Only you. Nothing is sold or shared." onPress={() => onOpen('privacy')} />
        <ListRow title="Share with a Clinician" sub="A PDF summary, made on this phone" onPress={() => onOpen('shareClinician')} />
        <ListRow title="Download Your Data" sub="Everything Ciatta holds, as one file" onPress={onDownload} />
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
      {/*
        Profile is opened from Today's hamburger rather than switched to,
        so it owes her a way back. The tab bar used to be that and is not
        any more.
      */}
      <ScreenHeader title="Profile" onBack={nav.back} />

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

          No health score and no stat tiles: a score out of 100 is a
          number nobody can compute from her rows without inventing most
          of it. The overview shows what Ciatta is doing with her record
          instead, which is real in this mode too, and the paragraph
          closes with what is in it.
        */}
        {!profile && seg === 'Overview' ? (
          <>
            <HealthOverview />
            <CycleGroup onOpen={nav.push} />
            <Connections onOpen={nav.push} />
            <View style={p.overviewCard}>
              <Text style={[font('body'), p.overviewText]}>{displayCopy(overview)}</Text>
            </View>
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
              What Ciatta is doing with her record leads, then the facts
              about her, then her record in a paragraph to close: the
              summary reads best after the parts it summarises.
            */}
            <HealthOverview />
            <StatTiles cols={cols} profile={profile} />
            <Connections onOpen={nav.push} />
            <View style={p.overviewCard}>
              <Text style={[font('body'), p.overviewText]}>{displayCopy(overview)}</Text>
            </View>
          </>
        ) : null}
        {profile && seg === 'Health' ? (
          <>
            {/*
              One subject, one screen: what she told Ciatta, what her
              cycle looks like, and who is looking after her. The biomarker
              tiles moved to Today, where each metric card carries its own
              trend line and arrow, computed from her readings.
            */}
            <DetailsGroup onOpen={nav.push} profile={profile} />
            <CycleGroup onOpen={nav.push} />
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
  measures: { gap: 12, marginTop: 16 },
  measureHead: { flexDirection: 'row', alignItems: 'baseline' },
  track: { height: 5, borderRadius: 2.5, backgroundColor: C.fill, marginTop: 6, overflow: 'hidden' },
  fillBar: { height: 5, borderRadius: 2.5 },


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
