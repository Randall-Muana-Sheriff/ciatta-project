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
// supplied yet and the row falls back to a monogram, which is a visible gap
// rather than a wrong logo.
export type SyncApp = { name: string; mark: 'oura' | 'whoop' | null };

export const SYNC_APPS: readonly SyncApp[] = [
  { name: 'Oura', mark: 'oura' },
  { name: 'Whoop', mark: 'whoop' },
  { name: '8 Sleep', mark: null },
  { name: 'Withings', mark: null },
  { name: 'Garmin', mark: null },
  { name: 'Strava', mark: null },
  { name: 'Omron', mark: null },
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
