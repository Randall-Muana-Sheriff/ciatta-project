import { assertEquals } from 'jsr:@std/assert@1';
import { HEALTHKIT_READ_IDENTIFIERS } from './healthKitMap.ts';
import { createBackgroundDeliveryQueue } from './healthKitBackground.ts';

Deno.test('background delivery covers every Ciatta HealthKit identifier', () => {
  assertEquals(HEALTHKIT_READ_IDENTIFIERS.includes('HKQuantityTypeIdentifierStepCount'), true);
  assertEquals(HEALTHKIT_READ_IDENTIFIERS.includes('HKCategoryTypeIdentifierSleepAnalysis'), true);
  assertEquals(HEALTHKIT_READ_IDENTIFIERS.includes('HKWorkoutTypeIdentifier'), true);
});

Deno.test('observer wakes coalesce into one incremental sync of the changed types', async () => {
  const flushed: string[][] = [];
  let scheduled: (() => Promise<void>) | null = null;
  const queue = createBackgroundDeliveryQueue({
    debounceMs: 20,
    schedule: (fn) => {
      scheduled = fn;
      return { cancel: () => { scheduled = null; } };
    },
    sync: async (identifiers) => {
      flushed.push([...identifiers].sort());
    },
  });

  queue.notify('HKQuantityTypeIdentifierStepCount');
  queue.notify('HKQuantityTypeIdentifierHeartRate');
  queue.notify('HKQuantityTypeIdentifierStepCount');
  assertEquals(flushed.length, 0);
  await scheduled!();
  assertEquals(flushed, [[
    'HKQuantityTypeIdentifierHeartRate',
    'HKQuantityTypeIdentifierStepCount',
  ]]);
});
