/** Mirrors understanding-engine/sleepAnalysis.ts nightKey. Not a new threshold. */
function nightKey(endTime: string): string {
  const d = new Date(new Date(endTime).getTime() - 12 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function isAsleepStage(stage: string | null | undefined): boolean {
  return stage !== 'in_bed' && stage !== 'awake';
}

export interface SleepNightRow {
  type: string;
  recorded_at: string;
  value: unknown;
  context: unknown;
}

/**
 * Distinct nights the Stage 1 sleep processor uses. Canonical with
 * sleepAnalysis.ts nightlySleepMinutes: HealthKit persists sleep_segment,
 * Health Connect persists sleep_session. This is not a UI row count.
 */
export function countEligibleSleepNights(rows: SleepNightRow[]): number {
  const byNight = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== 'sleep_session' && row.type !== 'sleep_segment') continue;
    const value = row.value as { durationMinutes?: number; stage?: string } | null;
    const context = row.context as { startTime?: string } | null;
    const durationMinutes = value?.durationMinutes;
    const startTime = context?.startTime;
    if (typeof durationMinutes !== 'number' || typeof startTime !== 'string') continue;
    if (row.type === 'sleep_segment' && !isAsleepStage(value?.stage)) continue;
    const key = nightKey(row.recorded_at);
    byNight.set(key, (byNight.get(key) ?? 0) + durationMinutes);
  }
  return byNight.size;
}
