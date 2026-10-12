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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { connectProvider, loadConnections, loadDirectory } from '../data/providers';
import { clientId as readClientId, setClientId } from '../data/providerAccess';
import type { Endpoint } from '../lib/providers/directory';
import { groupLine, hasMore, noResults, PREVIEW, type ResultGroup, search } from '../lib/providers/directory';
import { isSandbox } from '../lib/providers/epicDirectory';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { font, GUTTER } from '../theme';
import { Eyebrow } from '../ui/bento';
import { Icon } from '../ui/icons';
import { DetailScreen, PrimaryButton, SecondaryButton } from '../ui/kit';
import { HUE, L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';

export function ProviderConnectScreen() {
  const nav = useNav();
  const [directory, setDirectory] = useState<Endpoint[] | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [picked, setPicked] = useState<Endpoint | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  // Read rather than compiled in, so a registration approved today works
  // today. Null while the read is in flight, which is not the same as
  // absent and must not render as it.
  const [registration, setRegistration] = useState<string | null>(null);

  useEffect(() => {
    void readClientId().then(setRegistration);
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

  const connect = useCallback(async () => {
    if (!picked || connecting) return;
    setConnecting(true);
    setMessage('');
    const out = await connectProvider(picked, registration ?? '');
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
      <View style={s.searchWrap}>
        <Icon name="search" size={18} color={L.meta} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Hospital or clinic name"
          placeholderTextColor={L.meta}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          style={[font('body'), s.search]}
          accessibilityLabel="Search for your health institution"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
            <Icon name="xmark" size={15} color={L.meta} />
          </Pressable>
        ) : null}
      </View>

      {message ? <Text style={[font('subhead'), s.message]}>{displayCopy(message)}</Text> : null}

      {directory === null ? (
        <View style={s.centre}>
          <ActivityIndicator color={L.meta} />
        </View>
      ) : null}

      {/*
        One row of real hospitals is the whole directory when the fetch
        did not land. Said plainly, because an empty search otherwise
        reads as "your hospital is not supported".
      */}
      {directory !== null && directory.length <= 1 ? (
        <Text style={[font('caption1'), s.note]}>
          The full directory could not be reached just now. You can still connect to the test server below.
        </Text>
      ) : null}

      {query.trim().length >= 2 && groups.length === 0 && directory !== null ? (
        <Text style={[font('subhead'), s.empty]}>{displayCopy(noResults(query))}</Text>
      ) : null}

      {groups.map((group) => (
        <Group
          key={group.title}
          group={group}
          open={expanded === group.title}
          onToggle={() => setExpanded(expanded === group.title ? null : group.title)}
          onPick={setPicked}
        />
      ))}
      </DetailScreen>

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
              registration={registration}
              onRegister={async (value) => {
                await setClientId(value);
                setRegistration(await readClientId());
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
  const shown = open ? group.endpoints : group.endpoints.slice(0, PREVIEW);
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
      {hasMore(group) ? (
        <Pressable onPress={onToggle} accessibilityRole="button" style={({ pressed }) => [pressed && s.pressed]}>
          <Text style={[font('subhead', 'semibold'), s.viewAll]}>
            {open ? 'Show fewer' : `View all ${group.endpoints.length}`}
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
      accessibilityLabel={endpoint.name}
      style={({ pressed }) => [s.row, standalone && s.rowAlone, pressed && s.pressed]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[font('subhead'), s.rowName]}>{displayCopy(endpoint.name)}</Text>
        {isSandbox(endpoint) ? <Text style={[font('caption1'), s.sandbox]}>Test server, not a hospital</Text> : null}
      </View>
      <Icon name="chevronRight" size={15} color={L.meta} />
    </Pressable>
  );
}

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
              <ActivityIndicator color={L.ink} />
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
                  {showSetup ? (
                    <View style={s.setup}>
                      <Text style={[font('caption1'), s.note]}>
                        Paste the client ID from your provider registration. It is public rather than a secret, and it
                        stays on this phone.
                      </Text>
                      <TextInput
                        value={draftId}
                        onChangeText={setDraftId}
                        placeholder="Client ID"
                        placeholderTextColor={L.meta}
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
    borderRadius: 24,
    backgroundColor: L.recessed,
    borderWidth: st,
    borderColor: L.rule,
  },
  search: { flex: 1, color: L.ink },

  centre: { alignItems: 'center', gap: 10, paddingVertical: SPACE.block },
  note: { color: L.meta, marginHorizontal: GUTTER, marginTop: 12, lineHeight: 19 },
  empty: { color: L.body, marginHorizontal: GUTTER, marginTop: SPACE.block, lineHeight: 22 },
  message: { color: L.ink, marginHorizontal: GUTTER, marginTop: SPACE.near, lineHeight: 22 },

  group: { marginTop: SPACE.block, marginHorizontal: GUTTER },
  groupTitle: { color: L.ink },
  groupLine: { color: L.meta, marginTop: 2 },
  groupBody: { marginTop: 10, gap: 1 },
  viewAll: { color: HUE.measured, marginTop: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: L.recessed,
    borderWidth: st,
    borderColor: L.rule,
    borderRadius: 12,
  },
  rowAlone: { marginTop: SPACE.grid, marginHorizontal: GUTTER },
  rowName: { color: L.ink },
  sandbox: { color: HUE.uncertainty, marginTop: 2 },

  // The sheet sits at the foot of the screen; the scrim is painted on
  // this container rather than on a sibling that would take up height.
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  sheetWrap: {
    maxHeight: '88%',
    backgroundColor: L.canvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: st,
    borderColor: L.rule,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: L.rule, marginBottom: 12 },
  sheet: { paddingHorizontal: GUTTER, paddingBottom: SPACE.section },
  close: { alignSelf: 'center', marginTop: SPACE.block, paddingVertical: 12, paddingHorizontal: 20 },
  closeText: { color: L.meta },
  setup: { marginTop: SPACE.near, gap: 12 },
  idInput: {
    color: L.ink,
    backgroundColor: L.recessed,
    borderRadius: 12,
    borderWidth: st,
    borderColor: L.rule,
    paddingHorizontal: 14,
    height: 48,
  },
  sheetTitle: { color: L.ink, letterSpacing: -0.4 },
  sheetLede: { color: L.body, lineHeight: 24, marginTop: 12, marginBottom: SPACE.block },
  bullets: { marginTop: SPACE.tight, gap: SPACE.near },
  bullet: {
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: L.rule,
    padding: 16,
  },
  bulletTitle: { color: L.ink },
  bulletBody: { color: L.body, marginTop: 4, lineHeight: 21 },
  blocked: { color: L.body, lineHeight: 22, marginTop: SPACE.near },
  action: { marginTop: SPACE.section },
  pressed: { opacity: 0.55 },
});
