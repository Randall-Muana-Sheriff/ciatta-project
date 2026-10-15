// Other providers and insurers, through Fasten Connect.
//
// Fasten's own search, in its own web view, inside a sheet on Ciatta's
// ground. She finds her hospital, clinic or insurer there and signs in to
// its portal; her password goes to them, and Ciatta does not read that
// page. When she is finished the sheet closes and the Providers list reads
// again. Which connection is hers is settled on the server, from Fasten's
// signed webhook, never from anything this screen says.
//
// Not ui/Sheet: that wraps its children in a scroll view, and a web view
// inside a scroll view has no height to fill.

import { FastenStitchElement } from '@fastenhealth/fasten-stitch-element-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { startFasten } from '../data/providers';
import { displayCopy } from '../lib/displayCopy';
import { stitchOutcome } from '../lib/providers/stitch';
import { font, GUTTER } from '../theme';
import { Ground } from '../ui/Ground';
import { PrimaryButton } from '../ui/kit';
import { HUE, SPACE } from '../ui/surface';
import { G } from '../ui/scheme';

type Session = { externalId: string; publicId: string };

export function FastenConnectSheet({ visible, onClose }: { visible: boolean; onClose: (connected: boolean) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  // Bumped to remount the search after a failure, so Try again starts clean.
  const [attempt, setAttempt] = useState(0);

  const begin = useCallback(async () => {
    setMessage('');
    setSession(null);
    const out = await startFasten();
    if (!out.ok) {
      setMessage(out.message);
      return;
    }
    setSession({ externalId: out.externalId, publicId: out.publicId });
  }, []);

  useEffect(() => {
    if (!visible) return;
    setConnected(false);
    void begin();
  }, [visible, begin]);

  const close = useCallback(() => onClose(connected), [onClose, connected]);

  const onEvent = useCallback(
    (event: unknown) => {
      const outcome = stitchOutcome(event);
      if (!outcome) return;
      if (outcome.kind === 'connected') setConnected(true);
      if (outcome.kind === 'failed') setMessage(outcome.message);
      if (outcome.kind === 'complete') onClose(true);
    },
    [onClose],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <Ground from="measured" to="timeDepth">
        <View style={s.head}>
          <Text style={[font('headline'), s.title]} accessibilityRole="header">
            Other providers and insurers
          </Text>
          <Pressable onPress={close} accessibilityRole="button" hitSlop={10}>
            <Text style={[font('body', 'semibold'), s.done]}>Done</Text>
          </Pressable>
        </View>
        <Text style={[font('footnote'), s.sub]}>
          Search for your hospital, clinic, lab or insurance plan, then sign in to its portal. Your password goes to
          them, not to Ciatta. Your records arrive in a few minutes, and you can remove the connection whenever you
          want.
        </Text>

        {message ? (
          <View style={s.notice}>
            <Text style={[font('subhead'), s.message]}>{displayCopy(message)}</Text>
            <PrimaryButton
              label="Try again"
              onPress={() => {
                setAttempt((n) => n + 1);
                void begin();
              }}
            />
          </View>
        ) : null}

        {session ? (
          <View style={s.web}>
            <FastenStitchElement
              key={`${session.externalId}:${attempt}`}
              publicId={session.publicId}
              externalId={session.externalId}
              onEventBus={onEvent}
              renderCloseButton={(dismiss) => (
                <Pressable onPress={dismiss} accessibilityRole="button" style={s.portalClose}>
                  <Text style={[font('body', 'semibold'), s.done]}>Close</Text>
                </Pressable>
              )}
            />
          </View>
        ) : message ? null : (
          <View style={s.centre}>
            <ActivityIndicator color={G.meta} />
          </View>
        )}
      </Ground>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 8 },
  title: { color: G.ink },
  done: { color: HUE.measured },
  sub: { color: G.meta, paddingHorizontal: GUTTER, lineHeight: 18 },
  notice: { paddingHorizontal: GUTTER, marginTop: SPACE.block, gap: SPACE.near },
  message: { color: G.ink, lineHeight: 22 },
  web: { flex: 1, marginTop: SPACE.near, overflow: 'hidden', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  centre: { alignItems: 'center', paddingVertical: SPACE.section },
  portalClose: { alignItems: 'center', paddingVertical: 16 },
});
