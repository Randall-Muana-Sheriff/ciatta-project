import { useEffect, useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { expo } from '../../app.json';
import { deleteAccount, exportAndShare } from '../data/account';
import type { Data } from '../data/adapter';
import type { Tone } from '../data/sample';
import type { SourceView } from '../data/rows';
import type { Reported } from '../data/repo';
import { type Connection, loadConnections } from '../data/providers';
import { type BodyManual, overviewFacts, resolveBody } from '../lib/overviewFacts';
import { ageFact } from '../lib/healthFacts';
import { activeUnits, formatDistance, UNIT_LABEL } from '../lib/units';
import { type BodyField, BodySheet } from '../ui/BodySheet';
import { type Insurance, insuranceFact } from '../lib/insurance';
import { askForCharacteristics, readCharacteristics } from '../lib/healthKit';
import { openAppleHealth } from '../lib/openHealth';
import { useCycleInsights } from '../state/cycleStore';
import { profileOverview } from '../lib/profileOverview';
import { connectAppleHealth } from '../lib/connectHealth';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { type Screen, useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useColorScheme } from '../state/colorScheme';
import { useInsightReactions } from '../state/insightReactions';
import { useResearchInsights } from '../state/researchInsights';
import { savedInsights } from '../lib/insights';
import { SCHEME_LABEL, SCHEMES } from '../ui/scheme';
import { useData, useRepo, useSession } from '../state/session';
import { askForWeather, weatherIsOn } from '../state/environmentRun';
import { registerForFindings } from '../state/notifications';
import { C, font, GUTTER } from '../theme';
import { NAV_CLEARANCE, TILE_RADIUS } from '../ui/surface';
import { ListGroup, ListRow, Panel } from '../ui/chrome';
import { ScreenHeader } from '../ui/kit';
import { Icon, type IconName } from '../ui/icons';
import { Sheet } from '../ui/Sheet';
import { images } from '../ui/images';
import { avatarInitial } from '../ui/initial';
import { EmptyNote } from '../ui/kit';
import { G } from '../ui/scheme';
import { BookmarksList } from './BookmarksScreen';
import { openInsight } from '../lib/careHandoff';

type Profile = NonNullable<Data['profile']>;


const TONE: Record<Tone, string> = {
  coral: C.coral,
  mint: '#2FB8B4',
  lavender: C.indigo,
  indigo: C.blue,
  text: G.fillSelected,
};



// ── Overview pieces ────────────────────────────────────────────



// What Ciatta is doing with her record. It does not grade her health. It
// learns what is usual for her, measure by measure, and says when
// something moves away from that, so the overview shows exactly that: what
// it has found, and how far each measure is from being comparable.
// The one card at the top: the facts a clinician asks first, then her
// record in a short paragraph.
function ProfileCard({
  stats = [],
  onOpen,
  paragraph,
}: {
  stats?: readonly { label: string; value: string; sub?: string }[];
  onOpen: (screen: Screen) => void;
  paragraph: string;
}) {
  const nav = useNav();
  // Her insurance, as she entered it. Read again when Profile is back in
  // view, so what she just saved shows.
  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const repo = useRepo();
  const { profile: cycleProfile } = useCycleInsights();
  // Height, weight and blood type: what she entered on Body Measurements,
  // and what Apple Health holds. Age comes from Apple Health's date of
  // birth, or for the example person from the sample.
  const [body, setBody] = useState<BodyManual | null>(null);
  const [heightRead, setHeightRead] = useState<{ value: number; unit: string | null } | null>(null);
  const [weightRead, setWeightRead] = useState<{ value: number; unit: string | null; at: string } | null>(null);
  const [traits, setTraits] = useState<{ dateOfBirth: Date | null; bloodType: number | null }>({ dateOfBirth: null, bloodType: null });
  const fromHealth = stats.length === 0;
  useEffect(() => {
    let ignore = false;
    repo
      .loadVitals()
      .then((rows) => {
        if (ignore) return;
        const h = rows.find((r) => r.metric === 'height');
        const w = rows.find((r) => r.metric === 'body_mass');
        setHeightRead(h ? { value: h.value, unit: h.unit } : null);
        setWeightRead(w ? { value: w.value, unit: w.unit, at: w.at } : null);
      })
      .catch(() => {});
    repo.loadInsurance().then((ins) => !ignore && setInsurance(ins)).catch(() => {});
    repo.loadBody().then((b) => !ignore && setBody(b)).catch(() => {});
    if (fromHealth) {
      readCharacteristics()
        .then((t) => !ignore && setTraits(t))
        .catch(() => {});
    }
    return () => {
      ignore = true;
    };
  }, [repo, fromHealth, nav.depth]);
  const facts = useMemo(() => {
    const now = new Date();
    const sampleAge = stats.find((x) => x.label === 'Age');
    return overviewFacts({
      age: fromHealth ? ageFact(traits.dateOfBirth, now) : (sampleAge ?? null),
      body: resolveBody({ manual: body, health: { bloodType: fromHealth ? traits.bloodType : null, height: heightRead, weight: weightRead } }),
      insurance: insuranceFact(insurance),
      situations: cycleProfile.situations,
      units: activeUnits(),
      now,
    });
  }, [stats, fromHealth, traits, body, heightRead, weightRead, insurance, cycleProfile]);
  // Age Apple Health holds but Ciatta has not been allowed to read: one tap
  // asks, once.
  const askHealth = () => {
    askForCharacteristics()
      .then(setTraits)
      .catch(() => {});
  };
  // Where a tap on each fact goes.
  const OPENS: Partial<Record<string, Screen>> = { insurance: 'insurance', situation: 'cycleProfile' };
  // Height, weight and blood type each open their own sheet, here.
  const SHEETS: Partial<Record<string, BodyField>> = { height: 'height', weight: 'weight', blood: 'blood' };
  const [sheet, setSheet] = useState<BodyField | null>(null);
  return (
    <Panel flat>
      <View style={p.facts}>
        {facts.map((f) => (
          <Pressable
            key={f.key}
            style={p.fact}
            disabled={!(SHEETS[f.key] || OPENS[f.key] || (fromHealth && !f.value && f.key === 'age'))}
            onPress={SHEETS[f.key] ? () => setSheet(SHEETS[f.key]!) : OPENS[f.key] ? () => onOpen(OPENS[f.key]!) : askHealth}
            accessibilityRole={SHEETS[f.key] || OPENS[f.key] || (fromHealth && !f.value && f.key === 'age') ? 'button' : undefined}
            accessibilityLabel={`${f.label}, ${f.value ?? 'not added'}${f.sub ? `, ${f.sub}` : ''}`}
            accessibilityHint={OPENS[f.key] ? `Opens ${f.label.toLowerCase()}` : fromHealth && !f.value && f.key === 'age' ? 'Adds it from Apple Health' : undefined}
          >
            <Icon name={f.icon} size={16} color={f.key === 'insurance' ? C.lavender : C.coral} weight={1.8} />
            <Text style={[font('caption1'), { color: G.body, marginTop: 6 }]} numberOfLines={1}>{f.label}</Text>
            <Text style={[font('subhead', 'semibold'), { color: f.value ? G.ink : G.meta }]} numberOfLines={1} adjustsFontSizeToFit>
              {f.value ? displayCopy(f.value) : 'Not added'}
            </Text>
            {f.sub ? <Text style={[font('caption2'), { color: G.body }]} numberOfLines={1}>{displayCopy(f.sub)}</Text> : null}
            {!f.sub && !f.value && fromHealth && f.key === 'age' ? (
              <Text style={[font('caption2'), { color: C.blueLink }]} numberOfLines={1}>From Apple Health</Text>
            ) : null}
            {!f.value && (OPENS[f.key] || SHEETS[f.key]) ? (
              <Text style={[font('caption2'), { color: C.blueLink }]} numberOfLines={1}>Add</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      <Text style={[font('subhead'), p.paragraph]}>{displayCopy(paragraph)}</Text>
      <BodySheet field={sheet} onClose={() => setSheet(null)} onSaved={setBody} />
    </Panel>
  );
}

function DetailsGroup({ onOpen, profile }: { onOpen: (screen: Screen) => void; profile: Profile }) {
  return (
    <ListGroup>
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




// ── Sheets: each row of the list opens one ─────────────────────

// The landing page's questions, which is where the help lives: one set of
// answers, kept on the site, rather than a second copy in the app.
const HELP_URL = 'https://ciatta.io/member/#q-heading';







// One source, as a row: what it is, where it stands, and the one action.
function SourceRow({
  icon,
  title,
  status,
  tone,
  connected,
  onPress,
  first,
}: {
  icon: IconName;
  title: string;
  status?: string;
  // Green for a source that is flowing, lavender for one worth adding.
  tone?: 'live' | 'suggested';
  connected: boolean;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <View style={[p.source, !first && p.sourceRule]}>
      <Icon name={icon} size={22} color={G.ink} weight={1.6} />
      <View style={{ flex: 1 }}>
        <Text style={[font('headline'), { color: G.ink }]}>{displayCopy(title)}</Text>
        {status ? (
          <View style={p.statusRow}>
            {tone ? <View style={[p.statusDot, { backgroundColor: tone === 'live' ? '#34C759' : C.lavender }]} /> : null}
            <Text style={[font('footnote'), { color: G.meta, flexShrink: 1 }]} numberOfLines={1}>
              {displayCopy(status)}
            </Text>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${connected ? 'connected' : 'connect'}`}
        style={({ pressed }) => [connected ? p.connected : p.connect, pressed && { opacity: 0.8 }]}
      >
        <Text style={[font('subhead', 'semibold'), { color: connected ? G.ink : G.onPill }]}>{connected ? 'Connected' : 'Connect'}</Text>
      </Pressable>
    </View>
  );
}

// Everything that feeds her record, in one list: her phone and watch, her
// providers, her plan, the weather around her, and what she adds herself.
function DataSources({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const repo = useRepo();
  const { mode, userId } = useSession();
  const [sources, setSources] = useState<SourceView[]>([]);
  const [providers, setProviders] = useState<Connection[] | null>(null);
  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const [weather, setWeather] = useState<'unknown' | 'off' | 'on' | 'failed' | 'working'>('unknown');
  const [note, setNote] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  useEffect(() => {
    repo.loadSources().then(setSources).catch(() => {});
    loadConnections().then(setProviders).catch(() => {});
    repo.loadInsurance().then(setInsurance).catch(() => {});
    weatherIsOn().then((on) => setWeather(on ? 'on' : 'off'));
  }, [repo]);

  // Apple Health walks availability, then permission, then a sync, writing
  // its status at each step so the row says what happened.
  const connectHealth = async () => {
    if (mode === 'demo') {
      setNote('This is an example person. Sign in to connect your own sources.');
      return;
    }
    if (!userId || connecting) return;
    setConnecting(true);
    try {
      await connectAppleHealth({ userId, saveStatus: (kind, status, at) => repo.saveSourceStatus(kind, status, at), onNote: setNote });
      repo.loadSources().then(setSources).catch(() => {});
    } catch (e) {
      setNote(userFacingError(e, 'Apple Health did not connect. Try again.'));
    } finally {
      setConnecting(false);
    }
  };
  const turnOnWeather = async () => {
    setWeather('working');
    const r = await askForWeather(repo);
    setWeather(r === 'off' ? 'off' : r === 'failed' ? 'failed' : 'on');
  };

  const devices = sources.filter((x) => x.kind === 'measured');
  const labs = sources.find((x) => x.kind === 'lab');
  const logs = sources.find((x) => x.kind === 'logged');
  const linked = (providers ?? []).filter((c) => c.status === 'active');

  return (
    <View>
      <View style={p.sheetCard}>
        {devices.length ? (
          devices.map((d, n) => (
            <SourceRow key={d.name} first={n === 0} icon="ringDevice" title={d.name} status={d.status} tone="live" connected onPress={() => void openAppleHealth()} />
          ))
        ) : (
          <SourceRow first icon="heart" title="Apple Health" status={connecting ? 'Connecting' : 'Highly recommended'} tone="suggested" connected={false} onPress={() => void connectHealth()} />
        )}
        <SourceRow
          icon="stethoscope"
          title="Health Records"
          status={linked.length ? `${linked.reduce((n, c) => n + c.recordCount, 0)} records from ${linked.length === 1 ? linked[0].endpointName : `${linked.length} providers`}` : 'Your hospital or clinic, through its portal'}
          tone={linked.length ? 'live' : 'suggested'}
          connected={linked.length > 0}
          onPress={() => onOpen(linked.length ? 'chart' : 'providerConnect')}
        />
        <SourceRow
          icon="shield"
          title="Health Plans"
          status={insurance ? displayCopy(insuranceFact(insurance)?.value ?? 'Your plan') : 'Highly recommended'}
          tone={insurance ? 'live' : 'suggested'}
          connected={!!insurance}
          onPress={() => onOpen('insurance')}
        />
        <SourceRow
          icon="sun"
          title="Air Quality and Daylight"
          status={weather === 'on' ? 'On, for your approximate area only' : weather === 'working' ? 'Turning on' : weather === 'failed' ? 'Allowed, not set up yet' : 'Off'}
          tone={weather === 'on' ? 'live' : undefined}
          connected={weather === 'on'}
          onPress={() => (weather === 'on' || weather === 'working' ? undefined : void turnOnWeather())}
        />
        {labs ? <SourceRow icon="flask" title="Lab Reports" status={labs.status} tone="live" connected onPress={() => onOpen('healthrecords')} /> : null}
        {logs ? <SourceRow icon="notebook" title="Your Logs" status={logs.status} tone="live" connected onPress={() => onOpen('journal')} /> : null}
      </View>
      {note ? <Text style={[font('footnote'), { color: G.body, marginTop: 10 }]}>{displayCopy(note)}</Text> : null}
      <Text style={[font('footnote'), { color: G.meta, marginTop: 12 }]}>
        {`Only a rough area, about ${formatDistance(10)}, leaves your phone for the weather, and it is never stored.`}
      </Text>
    </View>
  );
}

// What she told Ciatta and what it holds about her body and cycle.
function HealthDetails({ onOpen, profile, reported }: { onOpen: (screen: Screen) => void; profile: Profile | null; reported: Reported | null }) {
  return (
    <View style={p.stack}>
      {profile ? <DetailsGroup onOpen={onOpen} profile={profile} /> : <Reported reported={reported} />}
      <CycleGroup onOpen={onOpen} />
      <Goals />
    </View>
  );
}

// What she wants to understand: the goals she wrote at onboarding, kept
// and changed here in her own words. Ciatta reads them to decide what to
// look for first; it never sets one for her.
function Goals() {
  const repo = useRepo();
  const [goals, setGoals] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    repo.loadGoals().then(setGoals).catch(() => {});
  }, [repo]);
  const save = (next: string[]) => {
    setGoals(next);
    void repo.saveGoals(next).catch(() => setGoals(goals));
  };
  const add = () => {
    const g = draft.trim();
    if (!g || goals.some((x) => x.toLowerCase() === g.toLowerCase())) return;
    save([...goals, g]);
    setDraft('');
  };
  return (
    <ListGroup header="Your Goals" footer="What you told Ciatta you want to understand. It looks for these first.">
      {goals.map((g, n) => (
        <ListRow
          key={g}
          first={n === 0}
          title={g}
          right={
            <Pressable onPress={() => save(goals.filter((x) => x !== g))} accessibilityRole="button" accessibilityLabel={`Remove ${g}`} hitSlop={10}>
              <Icon name="xmark" size={16} color={G.meta} />
            </Pressable>
          }
        />
      ))}
      <View style={[p.goalAdd, goals.length > 0 && p.goalRule]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          returnKeyType="done"
          placeholder="Add something you want to understand"
          placeholderTextColor={G.meta}
          style={[font('body'), { color: G.ink, flex: 1 }]}
          accessibilityLabel="Add a goal"
        />
        {draft.trim() ? (
          <Pressable onPress={add} accessibilityRole="button" style={p.goalButton}>
            <Text style={[font('subhead', 'semibold'), { color: G.onPill }]}>Add</Text>
          </Pressable>
        ) : null}
      </View>
    </ListGroup>
  );
}

// Light, Dark, or the phone's own setting.
function Appearance() {
  const { scheme, choose } = useColorScheme();
  return (
    <ListGroup footer="System follows your iPhone. Ciatta restarts briefly to change.">
      {SCHEMES.map((x, n) => (
        <ListRow key={x} first={n === 0} title={SCHEME_LABEL[x]} selected={scheme === x} onPress={() => void choose(x)} />
      ))}
    </ListGroup>
  );
}

function Notifications() {
  const repo = useRepo();
  const [findings, setFindingsState] = useState(true);
  const [appointments, setAppointments] = useState(false);
  useEffect(() => {
    repo.loadNotifyFindings().then(setFindingsState).catch(() => {});
  }, [repo]);
  // Saved to her profile, which the server reads before sending a push.
  const setFindings = (on: boolean) => {
    setFindingsState(on);
    void repo.saveNotifyFindings(on).catch(() => setFindingsState(!on));
    if (on) void registerForFindings(repo, true);
  };
  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string) => (
    <Switch value={value} onValueChange={onChange} trackColor={{ false: G.fill, true: '#34C759' }} ios_backgroundColor={G.fill} accessibilityLabel={label} />
  );
  return (
    <ListGroup footer="No nudges to log, and no reminders to take anything.">
      <ListRow first title="New Findings" sub="Only once a pattern has appeared more than once" right={toggle(findings, setFindings, 'New findings')} />
      <ListRow title="Before Appointments" sub="The day before, so you can prepare" right={toggle(appointments, setAppointments, 'Before appointments')} />
    </ListGroup>
  );
}

function PrivacyData({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const { mode, userId } = useSession();
  const [footer, setFooter] = useState<string | null>(null);
  const onDownload = () => {
    if (mode === 'demo') {
      setFooter('The example person has no data to download.');
      return;
    }
    if (!userId) return;
    setFooter('Gathering your record into one file.');
    exportAndShare(userId)
      .then(() => setFooter(null))
      .catch((e) => setFooter(userFacingError(e, 'Your data did not download. Try again.')));
  };
  return (
    <ListGroup footer={footer ?? undefined}>
      <ListRow first title="Who Can See This" sub="Only you. Nothing is sold or shared." onPress={() => onOpen('privacy')} />
      <ListRow title="Share with a Clinician" sub="A PDF summary, made on this phone" onPress={() => onOpen('shareClinician')} />
      <ListRow title="Download Your Data" sub="Everything Ciatta holds, as one file" onPress={onDownload} />
    </ListGroup>
  );
}

type SheetKey = 'sources' | 'details' | 'bookmarks' | 'appearance' | 'notifications' | 'privacy';
const SHEET_TITLE: Record<SheetKey, string> = {
  sources: 'Data Sources',
  details: 'Health Details',
  bookmarks: 'Bookmarks',
  appearance: 'Appearance',
  notifications: 'Notifications',
  privacy: 'Privacy and Data',
};

// ── Screen ─────────────────────────────────────────────────────

export function ProfileScreen() {
  const nav = useNav();
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
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [bodySheet, setBodySheet] = useState<BodyField | null>(null);
  const [accountNote, setAccountNote] = useState<string | null>(null);
  const { userId, signOut } = useSession();
  const { reactions } = useInsightReactions();
  const { library } = useResearchInsights(reactions);
  const saved = savedInsights(library, reactions).length;
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
  // Her own first name until her record holds a full profile.
  const name = profile?.name ?? person?.firstName ?? null;
  // The sample portrait is a photograph of one particular woman. It belongs
  // to the example person and nobody else: her own circle is her initial.
  const initial = avatarInitial(name);

  // A row inside a sheet that goes to a screen closes the sheet first, so
  // the screen opens on Profile rather than under the sheet.
  const openFromSheet = (screen: Screen) => {
    setSheet(null);
    nav.push(screen);
  };
  // The marketing site's pages open as a sheet over Profile, like every
  // other row here, rather than leaving for the browser.
  const browse = (url: string) => () =>
    void WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
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
              if (keptOnThisPhone.length) setAccountNote(displayCopy('Your account is deleted. Some of what was saved on this phone could not be removed.'));
            })
            .catch((e) => setAccountNote(userFacingError(e, 'Your account was not deleted. Try again.'))),
      },
    ]);
  };

  return (
    <ScrollView style={p.fill} contentContainerStyle={p.body}>
      <ScreenHeader title="Profile" onBack={nav.back} />

      {/* Who she is, centred, as Settings opens. */}
      <View style={p.identity}>
        {mode === 'demo' ? (
          <Image source={images.avatar} style={p.avatar} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[p.avatar, p.initial]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {initial ? (
              <Text style={[font('title2', 'semibold'), { color: G.body }]}>{initial}</Text>
            ) : (
              <Icon name="person" size={34} color={G.body} weight={1.8} />
            )}
          </View>
        )}
        {name ? <Text style={[font('title2', 'semibold'), { color: G.ink, marginTop: 12 }]}>{displayCopy(name)}</Text> : null}
        {profile ? <Text style={[font('subhead'), { color: G.meta, marginTop: 2 }]}>{`${profile.age} · ${profile.born}`}</Text> : null}
      </View>

      <View style={p.pad}>
        <ProfileCard stats={profile?.stats} onOpen={nav.push} paragraph={overview} />

        {/* One long list. Each row opens its own sheet, or the page it names. */}
        <Text style={[font('footnote', 'semibold'), p.label]}>Your record</Text>
        <ListGroup>
          <ListRow first light icon="zigzag" title="Data Sources" onPress={() => setSheet('sources')} />
          <ListRow light icon="doc" title="Health Details" onPress={() => setSheet('details')} />
          <ListRow light icon="bookmark" title="Bookmarks" value={saved ? String(saved) : undefined} onPress={() => setSheet('bookmarks')} />
        </ListGroup>

        <Text style={[font('footnote', 'semibold'), p.label]}>Settings</Text>
        <ListGroup>
          <ListRow first light icon="ruler" title="Units" value={UNIT_LABEL[activeUnits()]} onPress={() => setBodySheet('units')} />
          <ListRow light icon="moon" title="Appearance" onPress={() => setSheet('appearance')} />
          <ListRow light icon="clock" title="Notifications" onPress={() => setSheet('notifications')} />
          <ListRow light icon="shield" title="Privacy and Data" onPress={() => setSheet('privacy')} />
          <ListRow light icon="info" title="Help Center" onPress={browse(HELP_URL)} />
        </ListGroup>

        <Text style={[font('footnote', 'semibold'), p.label]}>Legal and Policy</Text>
        <ListGroup>
          <ListRow first light title="Terms of Service" onPress={browse('https://ciatta.io/terms/')} />
          <ListRow light title="Privacy Policy" onPress={browse('https://ciatta.io/privacy/')} />
        </ListGroup>

        <Text style={[font('footnote', 'semibold'), p.label]}>Account</Text>
        <ListGroup footer={accountNote ?? undefined}>
          <ListRow first light title="Sign Out" onPress={signOut} />
          {mode === 'real' ? <ListRow light title="Delete Account and Data" destructive onPress={onDelete} /> : null}
        </ListGroup>

        <Text style={[font('footnote'), p.version]}>Version {expo.version}</Text>
      </View>

      <BodySheet field={bodySheet} onClose={() => setBodySheet(null)} />
      <Sheet visible={sheet !== null} title={sheet ? SHEET_TITLE[sheet] : ''} onDone={() => setSheet(null)}>
        {sheet === 'sources' ? <DataSources onOpen={openFromSheet} /> : null}
        {sheet === 'details' ? <HealthDetails onOpen={openFromSheet} profile={profile ?? null} reported={reported} /> : null}
        {sheet === 'bookmarks' ? (
          <BookmarksList
            onOpen={(id) => {
              setSheet(null);
              openInsight(id);
              nav.push('insight');
            }}
          />
        ) : null}
        {sheet === 'appearance' ? <Appearance /> : null}
        {sheet === 'notifications' ? <Notifications /> : null}
        {sheet === 'privacy' ? <PrivacyData onOpen={openFromSheet} /> : null}
      </Sheet>
    </ScrollView>
  );
}

const p = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: NAV_CLEARANCE },
  pad: { paddingHorizontal: GUTTER },
  stack: { gap: 28 },

  identity: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  label: { color: G.meta, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  paragraph: { color: G.body, lineHeight: 21, marginTop: 16 },
  goalAdd: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 10, minHeight: 50 },
  goalRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: G.rule },
  goalButton: { backgroundColor: G.pill, borderRadius: 999, minHeight: 32, paddingHorizontal: 14, justifyContent: 'center' },
  sheetCard: { backgroundColor: G.card, borderRadius: TILE_RADIUS, paddingHorizontal: 14 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sourceRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: G.rule },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  connect: { backgroundColor: G.pill, borderRadius: 999, minHeight: 38, paddingHorizontal: 18, justifyContent: 'center' },
  connected: { borderRadius: 999, minHeight: 38, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: G.rule },
  initial: { backgroundColor: G.fill, alignItems: 'center', justifyContent: 'center' },
  // Profile's scroll body has no gutter of its own, so each section pads
  // itself. The bottom margin comes from the control's own wrapper.
  segs: { marginTop: 20, paddingHorizontal: GUTTER },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: { backgroundColor: G.card, borderRadius: TILE_RADIUS, padding: 14, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },

  // The paragraph sits on the statement ground the system keeps for one
  // sentence at a time.
  overviewCard: {
    backgroundColor: G.fillSelected,
    borderRadius: TILE_RADIUS,
    padding: 18,
    marginTop: 4,
  },
  overviewText: { color: G.ink, lineHeight: 25 },
  overviewTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  // Each fact in a card of its own, three to a row.
  facts: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 8 },
  // Three to a row that share the width evenly whatever the gaps take,
  // and one height for all, so the six line up as a grid.
  fact: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 96,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  measures: { gap: 12, marginTop: 16 },
  measureHead: { flexDirection: 'row', alignItems: 'baseline' },
  track: { height: 5, borderRadius: 2.5, backgroundColor: G.fill, marginTop: 6, overflow: 'hidden' },
  fillBar: { height: 5, borderRadius: 2.5 },


  system: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    // No surface of its own: a body system here is a label, set on the
    // page as Settings sets its rows.
  },

  version: { color: G.meta, textAlign: 'center', marginTop: 24 },
});
