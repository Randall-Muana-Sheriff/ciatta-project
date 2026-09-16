// Pure mapping from a Connect a Source attempt to the source status it
// leaves behind and the copy that describes it. Kept apart from
// ProfileScreen.tsx, which has no render harness in this repo, so the rule
// (all succeeded goes to active, some failed goes to active with a
// warning, none succeeded goes to error, refused stays refused, unavailable
// stays unsupported) can be proven directly, without a renderer.
import type { DbSourceStatus } from '../data/rows';
import type { SyncResult } from './healthSync';

export type ConnectAttempt =
  | { kind: 'unavailable' }
  | { kind: 'refused' }
  | { kind: 'synced'; result: SyncResult };

export type ConnectOutcome = { status: DbSourceStatus; message: string };

export function outcomeForConnectAttempt(attempt: ConnectAttempt): ConnectOutcome {
  if (attempt.kind === 'unavailable') {
    return {
      status: 'unsupported',
      message: 'Apple Health is not available on this device. Nothing was read.',
    };
  }
  if (attempt.kind === 'refused') {
    return {
      status: 'refused',
      message: 'Access to Apple Health was not given. Nothing was read, and nothing will be sent unless access is given later.',
    };
  }

  const { metrics, failed } = attempt.result;
  if (failed.length === 0) {
    return {
      status: 'active',
      message: 'Apple Health is connected. Your data has been read and sent to your record.',
    };
  }
  const succeeded = metrics.length - failed.length;
  if (succeeded > 0) {
    return {
      status: 'active',
      message: 'Apple Health is connected. Some of your data has been read and sent, but some did not arrive. You can try again from this screen.',
    };
  }
  return {
    status: 'error',
    message: 'Apple Health connected, but none of your data could be sent right now. You can try again from this screen.',
  };
}
