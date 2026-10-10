// What the connect screen says, and which apps it names.
//
// Pure data and pure strings, so the copy can be held to the rules in tests
// rather than read off a screenshot: no dashes, no claim about what a
// reading means, and no promise about data handling that the app does not
// keep.

export function healthDisclosureParagraph(): string {
  return 'Connect Apple Health to import your sleep patterns, activity levels, and heart rate data for a complete health picture.';
}

// The encryption line.
//
// Kept here beside the other copy so the same tests cover it. This is the
// one sentence on the screen that is a promise about handling rather than a
// description of a feature, which is exactly why it should be hard to edit
// casually: in transit it is TLS, at rest it is the database's own
// encryption, and "never shared without your permission" has to stay true of
// every later feature that moves her data anywhere.
export function encryptionNote(): string {
  return 'Your data is encrypted and never shared without your permission.';
}

// Apps that write into Apple Health, which is how their data reaches Ciatta.
//
// Ciatta does not integrate with any of these. It reads Apple Health, and
// these are apps that write there, so naming them answers "will my ring
// work" without claiming a partnership that does not exist. The heading
// above the list carries that distinction and must keep carrying it.
//
// `mark` is the key into the app's image map. Null means no artwork has been
// supplied and the tile falls back to a monogram, which is a visible gap
// rather than a wrong logo. Every app has its own mark now, each taken from
// that company's own site and checked by eye before being committed, so the
// fallback is kept for the next app added rather than for these.
export type SyncAppMark = 'oura' | 'whoop' | 'eightsleep' | 'withings' | 'garmin' | 'strava' | 'omron';

export type SyncApp = { name: string; mark: SyncAppMark | null };

export const SYNC_APPS: readonly SyncApp[] = [
  { name: 'Oura', mark: 'oura' },
  { name: 'Whoop', mark: 'whoop' },
  { name: '8 Sleep', mark: 'eightsleep' },
  { name: 'Withings', mark: 'withings' },
  { name: 'Garmin', mark: 'garmin' },
  { name: 'Strava', mark: 'strava' },
  { name: 'Omron', mark: 'omron' },
];

// The letter shown when a brand has no artwork. Two characters for a name
// that starts with a digit, so "8 Sleep" reads as 8S rather than 8.
export function monogram(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Which apps are still waiting on their mark. Not an error: a name with no
// logo is honest, where a wrong logo is not. It exists so the gap can be
// listed rather than discovered on a screen.
export function appsMissingArtwork(): string[] {
  return SYNC_APPS.filter((a) => a.mark === null).map((a) => a.name);
}

// What came in, in her words.
//
// Built from the counted result rather than from the fact that a connection
// happened. Every branch below is reachable and they say different things:
// a run that imported nothing is not a failure and must not read as one, and
// a run that failed must not read as a success with a small number in it.
export type ImportSummary = { observations: number; metrics: number; failed: number; top: { metric: string; observations: number }[] };

// Internal metric names are not words she uses. Anything unmapped falls back
// to its name with the underscores opened out, which is wrong looking enough
// to notice and never a claim about what the metric is.
const METRIC_WORDS: Record<string, string> = {
  steps: 'steps',
  exercise_time: 'exercise minutes',
  active_energy: 'active energy',
  resting_heart_rate: 'resting heart rate',
  heart_rate: 'heart rate',
  hrv: 'heart rate variability',
  sleep_analysis: 'sleep',
  workout: 'workouts',
  respiratory_rate: 'breathing rate',
  oxygen_saturation: 'blood oxygen',
  wrist_temperature: 'wrist temperature',
  basal_body_temperature: 'basal body temperature',
};

export function metricWords(metric: string): string {
  return METRIC_WORDS[metric] ?? metric.replace(/_/g, ' ');
}

export function importSummaryLine(imported: ImportSummary | null): string {
  if (!imported) return '';
  if (imported.observations === 0) {
    // Nothing arrived, and that is usually because Apple Health holds
    // nothing for these types yet rather than because anything broke.
    return 'Nothing to import yet. Ciatta will pick up new readings as your devices record them.';
  }
  const names = imported.top.map((t) => metricWords(t.metric));
  const list = names.length <= 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const reading = imported.observations === 1 ? 'reading' : 'readings';
  const across = imported.metrics === 1 ? '1 kind' : `${imported.metrics} kinds`;
  const tail = imported.failed > 0 ? ' Some kinds did not come through, and Ciatta will try them again.' : '';
  return `Imported ${imported.observations} ${reading} across ${across}, including ${list}.${tail}`;
}
