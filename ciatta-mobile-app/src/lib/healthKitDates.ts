/** HealthKit Nitro samples may arrive as Date or ISO string. */
export function sampleIso(value: Date | string): string {
  if (typeof value === 'string') return new Date(value).toISOString();
  return value.toISOString();
}

export function sampleDurationMinutes(start: Date | string, end: Date | string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}
