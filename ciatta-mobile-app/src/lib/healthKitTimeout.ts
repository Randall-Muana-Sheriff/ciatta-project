export const MANUAL_SYNC_LIMIT_MS = 30_000;
export const MANUAL_SYNC_BUDGET_MS = 25_000;

export function createAbortSignal(): { aborted: boolean } {
  return { aborted: false };
}

export function remainingMs(startedAt: number, budgetMs: number, now: number): number {
  return budgetMs - (now - startedAt);
}

export function shouldStop(startedAt: number, budgetMs: number, now: number): boolean {
  return remainingMs(startedAt, budgetMs, now) <= 0;
}
