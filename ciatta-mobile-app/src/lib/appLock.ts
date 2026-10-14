// When Ciatta asks for Face ID. On when she turns it on in Settings: at
// every open, and again after she has been away for more than a minute, so
// a quick switch to another app does not ask again.

export const LOCK_AFTER_MS = 60_000;

export function shouldLock({ on, backgroundedAt, now, unlocked = false }: { on: boolean; backgroundedAt: number | null; now: number; unlocked?: boolean }): boolean {
  if (!on) return false;
  if (!unlocked) return true;
  return backgroundedAt != null && now - backgroundedAt > LOCK_AFTER_MS;
}
