import { DEVICE_KEY, IMPORTED_KEY } from './deviceImport';
import { LEGACY_OUTBOX_KEY, outboxKey } from './outbox';

// Every app owned key on this phone, and the one place that says which of
// them belong to which account.

// The watch flags and planned actions, kept per account for the same reason
// the outbox is: two people can sign in on the same phone, and what one of
// them chose to watch or try must never be shown as the other's.
export const LOOP_PREFIX = 'ciatta.loop.v1';

// What the loop was keyed as when it was device wide. Never read again, only
// cleared. Losing those flags once is fine; attributing them to somebody
// else is not.
export const LEGACY_LOOP_KEY = LOOP_PREFIX;

export const loopKey = (userId: string) => `${LOOP_PREFIX}.${userId}`;

// Only removeItem is needed to clear, so a caller can pass AsyncStorage or
// any plain object of the same shape.
export type Clearable = { removeItem(key: string): Promise<void> };

// Everything this app has written to this phone for this account, including
// the keys it used before either of them was per account.
export function accountKeys(userId: string): string[] {
  return [IMPORTED_KEY, DEVICE_KEY, LEGACY_OUTBOX_KEY, LEGACY_LOOP_KEY, outboxKey(userId), loopKey(userId)];
}

// Clears the lot after her account is deleted, so "deleted for good" is true
// of this phone too. Returns the keys that could not be cleared, so the
// screen can say so rather than claim the phone is clean.
export async function clearLocalRecord(kv: Clearable, userId: string): Promise<string[]> {
  const failed: string[] = [];
  for (const key of accountKeys(userId)) {
    try {
      await kv.removeItem(key);
    } catch {
      failed.push(key);
    }
  }
  return failed;
}
