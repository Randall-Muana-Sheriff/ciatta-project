// Connecting Apple Health, as one flow both the Profile screen and the
// first steps run: availability, then permission, then a recovery read,
// writing the source's status at each step so it always reflects what
// actually happened, never what was merely attempted. The note is what she
// is shown while it runs and when it ends; the status is the last outcome,
// so a screen can offer the next step once the source is active. Demo mode
// keeps today's honest notice: nothing there is hers to connect.
import { useCallback, useState } from 'react';

import { outcomeForConnectAttempt } from '../lib/connectSource';
import { healthKitAnchors, healthKitPort, isHealthAvailable, requestHealthPermission, signedInUserId } from '../lib/healthKit';
import { recordRefresh } from '../lib/healthRefresh';
import { portFor, runHealthSync } from '../lib/healthSync';
import { userFacingError } from '../lib/userFacingError';
import { useRepo, useSession } from './session';

export type ConnectStatus = 'idle' | 'running' | 'active' | 'unsupported' | 'refused' | 'error';

export function useConnectAppleHealth(onDone?: () => void) {
  const { mode, userId, reloadRecord } = useSession();
  const repo = useRepo();
  const [note, setNote] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectStatus>('idle');
  const connecting = status === 'running';

  const connect = useCallback(async () => {
    if (mode === 'demo') {
      setNote('This is an example person. Sign in to connect your own sources.');
      return;
    }
    if (!userId || connecting) return;
    setStatus('running');
    setNote('Checking whether Apple Health is available.');
    try {
      const available = await isHealthAvailable();
      if (!available) {
        await repo.saveSourceStatus('apple_health', 'unsupported');
        setNote(outcomeForConnectAttempt({ kind: 'unavailable' }).message);
        setStatus('unsupported');
        onDone?.();
        return;
      }

      const permission = await requestHealthPermission();
      if (!permission.granted) {
        await repo.saveSourceStatus('apple_health', 'refused');
        setNote(outcomeForConnectAttempt({ kind: 'refused' }).message);
        setStatus('refused');
        onDone?.();
        return;
      }

      await repo.saveSourceStatus('apple_health', 'connected');
      setNote('Connected. Reading your Apple Health data now.');

      const result = await runHealthSync(userId, {
        port: portFor(userId, healthKitPort, signedInUserId),
        anchors: healthKitAnchors,
        mode: 'recovery',
        // progress.metric is an internal key (resting_heart_rate, sleep_analysis),
        // not copy fit for her screen, so this only ever says how far along
        // the read is, never which internal field it is on.
        onProgress: (progress) => {
          setNote(`Reading your Apple Health data, ${progress.index} of ${progress.total}.`);
        },
      });

      const outcome = outcomeForConnectAttempt({ kind: 'synced', result });
      await repo.saveSourceStatus('apple_health', outcome.status, outcome.status === 'active' ? new Date().toISOString() : undefined);
      // So the app does not make the same read again on opening. What this
      // one leaves behind is decided where the rule is, in healthRefresh.ts.
      await recordRefresh(userId, healthKitAnchors, 'recovery', result, new Date()).catch(() => {});
      setNote(outcome.message);
      setStatus(outcome.status === 'active' ? 'active' : 'error');
      onDone?.();
      // What was just read is hers to see now, not the next time the app
      // is opened.
      await reloadRecord();
    } catch (e) {
      setNote(userFacingError(e, 'Apple Health did not connect. Try again.'));
      setStatus('error');
    }
  }, [mode, userId, connecting, repo, onDone, reloadRecord]);

  return { note, status, connecting, connect };
}
