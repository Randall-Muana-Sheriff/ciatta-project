// Find your health institution, and connect to it.
//
// Two states in one screen, because they are one task: the search, and
// the sheet that explains what is about to happen to the one she picked.
// The sheet is not a confirmation dialog. She is about to be handed to a
// hospital's login page, and the three things she needs to know before
// that happens are that her password goes to them and not to Ciatta, that
// the download takes a few minutes, and that she can undo it.
//
// Everything that decides anything lives in lib/providers and is tested.
// This renders, and calls it.

import { GroundLayer } from '../ui/Ground';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { connectProvider, loadConnections, loadDirectory, searchFasten, showsTestProviders } from '../data/providers';
import { type FastenHit, fastenNote, placeLine as fastenPlace, platformLine } from '../lib/providers/fastenCatalog';
import { FastenConnectSheet } from './FastenConnectSheet';
import { clientIds as readClientIds, setClientId } from '../data/providerAccess';
import { type ClientIds, clientFor } from '../lib/providers/clientChoice';
import type { Endpoint } from '../lib/providers/directory';
import { groupLine, hasMore, MAX_SHOWN, noResults, PREVIEW, type ResultGroup, search } from '../lib/providers/directory';
import { isSandbox } from '../lib/providers/epicDirectory';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { font, GUTTER } from '../theme';
import { Eyebrow } from '../ui/bento';
import { Icon } from '../ui/icons';
import { DetailScreen, PrimaryButton, SecondaryButton } from '../ui/kit';
import { HUE, L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';
import { G } from '../ui/scheme';

export function ProviderConnectScreen() {
  const nav = useNav();
  const [directory, setDirectory] = useState<Endpoint[] | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [picked, setPicked] = useState<Endpoint | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [fastenOpen, setFastenOpen] = useState(false);
  const [fastenTarget, setFastenTarget] = useState<FastenHit | null>(null);
  // Fasten's catalog for the same words. undefined while it is asked.
  const [fastenHits, setFastenHits] = useState<FastenHit[] | null | undefined>([]);
  // Read rather than compiled in, so a registration approved today works
  // today. Null while the read is in flight, which is not the same as
  // absent and must not render as it.
  const [registration, setRegistration] = useState<ClientIds | null>(null);

  useEffect(() => {
    void readClientIds().then(setRegistration);
  }, []);

  useEffect(() => {
    let ignore = false;
    void loadDirectory().then((d) => {
      if (!ignore) setDirectory(d);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const groups = useMemo(() => (directory ? search(directory, query) : []), [directory, query]);
  const searching = query.trim().length >= 2;

  // Asked a moment after she stops typing, and the previous ask dropped,
  // so a fast typist sends one search rather than one per letter.
  useEffect(() => {
    if (!searching) {
      setFastenHits([]);
      return;
    }
    setFastenHits(undefined);
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void searchFasten(query, abort.signal).then((hits) => {
        if (!abort.signal.aborted) setFastenHits(hits);
      });
    }, 350);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, searching]);

  const openFasten = (target: FastenHit | null) => {
    setFastenTarget(target);
    setFastenOpen(true);
  };

  const connect = useCallback(async () => {
    if (!picked || connecting) return;
    setConnecting(true);
    setMessage('');
    const out = await connectProvider(picked, registration ? clientFor(picked, registration) : '');
    setConnecting(false);
    if (!out.ok) {
      setMessage(out.message);
      return;
    }
    // Loaded so the next screen does not have to guess at the count.
    await loadConnections();
    setPicked(null);
    setMessage(
      out.written > 0
        ? `Connected. ${out.written} records arrived from ${picked.name}.`
        : `Connected to ${picked.name}. Nothing has arrived yet, which can take a few minutes.`,
    );
  }, [picked, connecting, registration]);

  const dismiss = () => {
    setPicked(null);
    setMessage('');
  };

  return (
    <>
      <DetailScreen title="Find your health institution" onBack={nav.back}>
      {/*
        Two ways in, side by side. Epic's MyChart through Ciatta's own
        connection, searched below; everything else through Fasten.
      */}
      {searching ? null : (
      <View style={s.ways}>
        <View style={s.way}>
          <Text style={[font('subhead', 'semibold'), s.rowName]}>Epic (MyChart)</Text>
          <Text style={[font('caption1'), s.place]}>Hospitals and clinics on MyChart</Text>
        </View>
        <Pressable
          onPress={() => openFasten(null)}
          accessibilityRole="button"
          accessibilityLabel="Other providers and insurers"
          style={({ pressed }) => [s.way, s.wayAction, pressed && s.pressed]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[font('subhead', 'semibold'), s.rowName]}>Other providers and insurers</Text>
            <Text style={[font('caption1'), s.place]}>Hospitals, clinics, labs and insurance plans</Text>
          </View>
          <Icon name="chevronRight" size={15} color={G.meta} />
        </Pressable>
      </View>
      )}

      <View style={s.searchWrap}>
        <Icon name="search" size={18} color={G.meta} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Hospital, clinic, lab or insurer"
          placeholderTextColor={G.meta}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          style={[font('body'), s.search]}
          accessibilityLabel="Search for your hospital, clinic, lab or insurer"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
            <Icon name="xmark" size={15} color={G.meta} />
          </Pressable>
        ) : null}
      </View>

      {message ? <Text style={[font('subhead'), s.message]}>{displayCopy(message)}</Text> : null}

      {directory === null ? (
        <View style={s.centre}>
          <ActivityIndicator color={G.meta} />
        </View>
      ) : null}

      {/*
        No real hospital in the directory means the fetch did not land
        (test builds still list the test servers). Said plainly, because an empty search otherwise
        reads as "your hospital is not supported".
      */}
      {directory !== null && directory.every(isSandbox) ? (
        <Text style={[font('caption1'), s.note]}>
          {showsTestProviders
            ? 'The full directory could not be reached just now. You can still connect to the test servers below.'
            : 'The directory of hospitals and clinics could not be reached just now. Check your connection and try again.'}
        </Text>
      ) : null}

      {searching && groups.length === 0 && directory !== null && Array.isArray(fastenHits) && fastenHits.length === 0 ? (
        <Text style={[font('subhead'), s.empty]}>{displayCopy(noResults(query))}</Text>
      ) : null}

      {searching && groups.length > 0 ? (
        <View style={s.sectionHead}>
          <Eyebrow>MyChart</Eyebrow>
        </View>
      ) : null}

      {groups.length > MAX_GROUPS ? (
        <Text style={[font('caption1'), s.note]}>
          {`Showing ${MAX_GROUPS} of ${groups.length} health systems. Add your town or state to narrow it.`}
        </Text>
      ) : null}

      {groups.slice(0, MAX_GROUPS).map((group) => (
        <Group
          key={`${group.title}|${group.area ?? ''}`}
          group={group}
          open={expanded === `${group.title}|${group.area ?? ''}`}
          onToggle={() => {
            const key = `${group.title}|${group.area ?? ''}`;
            setExpanded(expanded === key ? null : key);
          }}
          onPick={setPicked}
        />
      ))}

      {searching ? (
        <View style={s.fastenSection}>
          <Eyebrow>Other providers and insurers</Eyebrow>
          {fastenHits === undefined ? (
            <View style={s.centreSmall}>
              <ActivityIndicator color={G.meta} />
            </View>
          ) : (
            <>
              {fastenNote(fastenHits) && !(groups.length === 0 && fastenHits?.length === 0) ? (
                <Text style={[font('caption1'), s.fastenNote]}>{displayCopy(fastenNote(fastenHits)!)}</Text>
              ) : null}
              <View style={s.groupBody}>
                {(fastenHits ?? []).slice(0, MAX_FASTEN).map((hit) => (
                  <FastenRow key={hit.brandId} hit={hit} onPick={openFasten} />
                ))}
              </View>
            </>
          )}
          <Pressable
            onPress={() => openFasten(null)}
            accessibilityRole="button"
            style={({ pressed }) => [pressed && s.pressed]}
          >
            <Text style={[font('subhead', 'semibold'), s.viewAll]}>Search every provider and insurer</Text>
          </Pressable>
        </View>
      ) : null}
      </DetailScreen>

      <FastenConnectSheet
        visible={fastenOpen}
        target={fastenTarget}
        onClose={(connected) => {
          setFastenOpen(false);
          if (connected) {
            setMessage('Connected. Your records are on their way and usually arrive within a few minutes, under Your providers.');
          }
        }}
      />

      {/*
        A sheet over the search, not a screen replacing it. She is one tap
        from the wrong hospital at this point, and keeping the list she
        chose from visible behind it means backing out costs nothing.

        Outside DetailScreen, because DetailScreen puts its children in a
        scroll view and a modal does not belong in scrolling content. The
        column below ends at the bottom and the scrim fills absolutely:
        a scrim with flex 1 competes with the sheet for height and pushes
        it off the screen, which is exactly what it did.
      */}
      <Modal visible={!!picked} transparent animationType="slide" onRequestClose={dismiss}>
        <View style={s.sheetRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          {picked ? (
            <ProviderSheet
              endpoint={picked}
              connecting={connecting}
              message={message}
              registration={registration ? clientFor(picked, registration) : null}
              onRegister={async (value) => {
                await setClientId(value);
                setRegistration(await readClientIds());
              }}
              onBack={dismiss}
              onConnect={connect}
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function Group({
  group,
  open,
  onToggle,
  onPick,
}: {
  group: ResultGroup;
  open: boolean;
  onToggle: () => void;
  onPick: (e: Endpoint) => void;
}) {
  const shown = group.endpoints.slice(0, open ? MAX_SHOWN : PREVIEW);
  const line = groupLine(group);

  // A group of one is a row, not a heading with a single child under it.
  if (group.single) {
    return <EndpointRow endpoint={group.endpoints[0]} onPick={onPick} standalone />;
  }

  return (
    <View style={s.group}>
      <Text style={[font('headline'), s.groupTitle]}>{displayCopy(group.title)}</Text>
      {line ? <Text style={[font('footnote'), s.groupLine]}>{displayCopy(line)}</Text> : null}
      <View style={s.groupBody}>
        {shown.map((e) => (
          <EndpointRow key={e.id} endpoint={e} onPick={onPick} />
        ))}
      </View>
      {open && group.endpoints.length > MAX_SHOWN ? (
        <Text style={[font('caption1'), s.groupLine, { marginTop: 10 }]}>
          {`Showing ${MAX_SHOWN} of ${group.endpoints.length.toLocaleString('en-US')}. Add your town or street to the search to find yours.`}
        </Text>
      ) : null}
      {hasMore(group) ? (
        <Pressable onPress={onToggle} accessibilityRole="button" style={({ pressed }) => [pressed && s.pressed]}>
          <Text style={[font('subhead', 'semibold'), s.viewAll]}>
            {open ? 'Show fewer' : group.endpoints.length > MAX_SHOWN ? 'Show more' : `View all ${group.endpoints.length}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EndpointRow({
  endpoint,
  onPick,
  standalone = false,
}: {
  endpoint: Endpoint;
  onPick: (e: Endpoint) => void;
  standalone?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onPick(endpoint)}
      accessibilityRole="button"
      accessibilityLabel={[endpoint.name, endpoint.location].filter(Boolean).join(', ')}
      style={({ pressed }) => [s.row, standalone && s.rowAlone, pressed && s.pressed]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[font('subhead'), s.rowName]}>{displayCopy(endpoint.name)}</Text>
        {isSandbox(endpoint) ? (
          <Text style={[font('caption1'), s.sandbox]}>Test server, not a hospital</Text>
        ) : placeLine(endpoint, standalone) ? (
          <Text style={[font('caption1'), s.place]}>{displayCopy(placeLine(endpoint, standalone)!)}</Text>
        ) : null}
      </View>
      <Icon name="chevronRight" size={15} color={G.meta} />
    </Pressable>
  );
}

// Where a row is. Under a heading the system is already named, so only the
// town; standing alone it says whose it is as well.
function placeLine(endpoint: Endpoint, standalone: boolean): string | null {
  const parts = standalone && endpoint.organization ? [endpoint.organization, endpoint.location] : [endpoint.location];
  const line = parts.filter(Boolean).join(', ');
  return line || null;
}

// A provider from Fasten's catalog: its name, the system behind it, and
// where it is when the catalog says.
function FastenRow({ hit, onPick }: { hit: FastenHit; onPick: (h: FastenHit) => void }) {
  const line = [platformLine(hit), fastenPlace(hit)].filter(Boolean).join(', ');
  return (
    <Pressable
      onPress={() => onPick(hit)}
      accessibilityRole="button"
      accessibilityLabel={[hit.name, line].filter(Boolean).join(', ')}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[font('subhead'), s.rowName]}>{displayCopy(hit.name)}</Text>
        {line ? <Text style={[font('caption1'), s.place]}>{displayCopy(line)}</Text> : null}
      </View>
      <Icon name="chevronRight" size={15} color={G.meta} />
    </Pressable>
  );
}

const MAX_FASTEN = 20;

// A broad word like "clinic" matches most of the country. Past this many
// systems the list asks for a town instead of drawing them all.
const MAX_GROUPS = 40;

// What happens next, before it happens.
function ProviderSheet({
  endpoint,
  connecting,
  message,
  registration,
  onRegister,
  onBack,
  onConnect,
}: {
  endpoint: Endpoint;
  connecting: boolean;
  message: string;
  registration: string | null;
  onRegister: (value: string) => Promise<void>;
  onBack: () => void;
  onConnect: () => void;
}) {
  const portal = endpoint.portalName ?? 'their patient portal';
  const unregistered = registration !== null && registration.length === 0;
  const [showSetup, setShowSetup] = useState(false);
  const [draftId, setDraftId] = useState('');

  return (
    <View style={s.sheetWrap}>
      {/* The same ground as every screen, so the sheet is not a flat dark
          page of its own. */}
      <GroundLayer />
      {/* The grabber, which is what says this can be pulled away. */}
      <View style={s.grabber} />
      {/*
        No flex on this scroll view. Its parent's height comes from its
        content, capped at 88 percent, and a scroll view asking for flex 1
        of an undefined height resolves to zero: the sheet rendered as its
        grabber and nothing else, which looked like tapping a hospital did
        nothing at all.
      */}
      <ScrollView contentContainerStyle={s.sheet} bounces={false}>
        <Text style={[font('title2'), s.sheetTitle]} accessibilityRole="header">
          {displayCopy(endpoint.name)}
        </Text>
        {placeLine(endpoint, true) ? (
          <Text style={[font('subhead'), s.sheetPlace]}>{displayCopy(placeLine(endpoint, true)!)}</Text>
        ) : null}
        <Text style={[font('body'), s.sheetLede]}>
          Connect to your provider's portal to securely share your health data with Ciatta. Choosing 6 or 12 month
          access keeps your records up to date without connecting again.
        </Text>

        <Eyebrow>What to expect</Eyebrow>
        <View style={s.bullets}>
          <Bullet
            title="Have your login ready"
            body={`You will be taken to ${portal}, your provider's own page. Take your time. Your password goes to them and Ciatta never sees it.`}
          />
          <Bullet
            title="Automatic download"
            body="Once you log in, your records download on their own. This can take a few minutes."
          />
          <Bullet
            title="Safety and security"
            body="Ciatta only ever reads. It cannot change anything in your chart, and you can remove this connection whenever you want."
          />
        </View>

        {message ? <Text style={[font('subhead'), s.message]}>{displayCopy(message)}</Text> : null}

        <View style={s.action}>
          {connecting ? (
            <View style={s.centre}>
              <ActivityIndicator color={G.ink} />
              <Text style={[font('subhead'), s.note]}>Waiting for your provider.</Text>
            </View>
          ) : (
            <>
              {/*
                The button is always here and it is always the real one:
                it opens the provider's own login page in the system
                browser. What changes is whether it can be pressed. An
                unregistered build says why underneath rather than
                opening a page that will fail.
              */}
              <PrimaryButton
                label={`Continue to ${portal}`}
                onPress={onConnect}
                disabled={registration === null || unregistered}
              />

              {unregistered ? (
                <>
                  <Text style={[font('subhead'), s.blocked]}>
                    Ciatta is early, and is not yet registered with the provider networks that hospitals require, so
                    this cannot open yet. Nothing about your record has changed.
                  </Text>
                  {!showsTestProviders ? null : showSetup ? (
                    <View style={s.setup}>
                      <Text style={[font('caption1'), s.note]}>
                        Paste the client ID from your provider registration. It is public rather than a secret, and it
                        stays on this phone.
                      </Text>
                      <TextInput
                        value={draftId}
                        onChangeText={setDraftId}
                        placeholder="Client ID"
                        placeholderTextColor={G.meta}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[font('body'), s.idInput]}
                        accessibilityLabel="Client ID"
                      />
                      <SecondaryButton label="Save and enable" onPress={() => void onRegister(draftId)} />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setShowSetup(true)}
                      accessibilityRole="button"
                      style={({ pressed }) => [s.close, pressed && s.pressed]}
                    >
                      <Text style={[font('subhead'), s.closeText]}>I have a client ID</Text>
                    </Pressable>
                  )}
                </>
              ) : null}
            </>
          )}
        </View>

        <Pressable onPress={onBack} accessibilityRole="button" style={({ pressed }) => [s.close, pressed && s.pressed]}>
          <Text style={[font('subhead'), s.closeText]}>Not this one</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Bullet({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.bullet}>
      <Text style={[font('subhead', 'semibold'), s.bulletTitle]}>{title}</Text>
      <Text style={[font('subhead'), s.bulletBody]}>{displayCopy(body)}</Text>
    </View>
  );
}

const st = StyleSheet.hairlineWidth;

const s = StyleSheet.create({
  fill: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: GUTTER,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: TILE_RADIUS,
    backgroundColor: G.card,
    overflow: 'hidden',
  },
  search: { flex: 1, color: G.ink },
  ways: { flexDirection: 'row', gap: SPACE.grid, marginHorizontal: GUTTER, marginBottom: SPACE.near },
  way: {
    flex: 1,
    padding: 14,
    borderRadius: TILE_RADIUS,
    backgroundColor: G.fill,
    overflow: 'hidden',
  },
  sectionHead: { marginHorizontal: GUTTER, marginTop: SPACE.block },
  fastenSection: { marginHorizontal: GUTTER, marginTop: SPACE.section },
  fastenNote: { color: G.meta, marginTop: 8, lineHeight: 19 },
  centreSmall: { alignItems: 'center', paddingVertical: SPACE.near },
  wayAction: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: G.card },

  centre: { alignItems: 'center', gap: 10, paddingVertical: SPACE.block },
  note: { color: G.meta, marginHorizontal: GUTTER, marginTop: 12, lineHeight: 19 },
  empty: { color: G.body, marginHorizontal: GUTTER, marginTop: SPACE.block, lineHeight: 22 },
  message: { color: G.ink, marginHorizontal: GUTTER, marginTop: SPACE.near, lineHeight: 22 },

  group: { marginTop: SPACE.block, marginHorizontal: GUTTER },
  groupTitle: { color: G.ink },
  groupLine: { color: G.meta, marginTop: 2 },
  place: { color: G.meta, marginTop: 2 },
  groupBody: { marginTop: 10, gap: 1 },
  viewAll: { color: HUE.measured, marginTop: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: G.fill,
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
  },
  rowAlone: { marginTop: SPACE.grid, marginHorizontal: GUTTER },
  rowName: { color: G.ink },
  sandbox: { color: HUE.uncertainty, marginTop: 2 },

  // The sheet sits at the foot of the screen; the scrim is painted on
  // this container rather than on a sibling that would take up height.
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  sheetWrap: {
    maxHeight: '88%',
    backgroundColor: L.canvas,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: st,
    borderColor: G.rule,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: G.rule, marginBottom: 12 },
  sheet: { paddingHorizontal: GUTTER, paddingBottom: SPACE.section },
  close: { alignSelf: 'center', marginTop: SPACE.block, paddingVertical: 12, paddingHorizontal: 20 },
  closeText: { color: G.meta },
  setup: { marginTop: SPACE.near, gap: 12 },
  idInput: {
    color: G.ink,
    backgroundColor: G.fill,
    borderRadius: 12,
    borderWidth: st,
    borderColor: G.rule,
    paddingHorizontal: 14,
    height: 48,
  },
  sheetTitle: { color: G.ink, letterSpacing: -0.4 },
  sheetPlace: { color: G.meta, marginTop: 6 },
  sheetLede: { color: G.body, lineHeight: 24, marginTop: 12, marginBottom: SPACE.block },
  bullets: { marginTop: SPACE.tight, gap: SPACE.near },
  bullet: {
    backgroundColor: G.fill,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: G.rule,
    padding: 16,
  },
  bulletTitle: { color: G.ink },
  bulletBody: { color: G.body, marginTop: 4, lineHeight: 21 },
  blocked: { color: G.body, lineHeight: 22, marginTop: SPACE.near },
  action: { marginTop: SPACE.section },
  pressed: { opacity: 0.55 },
});
