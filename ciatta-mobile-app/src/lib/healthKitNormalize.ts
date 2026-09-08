import { sampleIso } from './healthKitDates.ts';

export function menstrualFlowContext(metadata: unknown): { cycleStart: boolean | null } {
  if (metadata == null || typeof metadata !== 'object') {
    return { cycleStart: null };
  }
  const raw = (metadata as { HKMenstrualCycleStart?: unknown }).HKMenstrualCycleStart;
  if (typeof raw === 'boolean') return { cycleStart: raw };
  return { cycleStart: null };
}

export function buildMenstrualObservation(
  startDate: Date | string,
  flow: string,
  metadata?: unknown,
  hkUuid?: string,
) {
  return {
    source: 'apple-health' as const,
    type: 'menstrual_flow',
    value: { flow },
    recordedAt: sampleIso(startDate),
    context: {
      ...menstrualFlowContext(metadata),
      ...(hkUuid ? { hkUuid } : {}),
    },
  };
}

export function buildSleepSegmentObservation(
  startDate: Date | string,
  endDate: Date | string,
  stage: string,
  durationMinutes: number,
  hkUuid?: string,
) {
  return {
    source: 'apple-health' as const,
    type: 'sleep_segment',
    value: { durationMinutes, stage },
    unit: 'minutes',
    recordedAt: sampleIso(endDate),
    context: {
      startTime: sampleIso(startDate),
      ...(hkUuid ? { hkUuid } : {}),
    },
  };
}

export function insertedCount(results: { created: number }[]): number {
  return results.reduce((sum, r) => sum + r.created, 0);
}
