// How to make each app hand its data to Apple Health.
//
// Ciatta reads Apple Health and nothing else, so an app that is not writing
// there is invisible to Ciatta no matter how good its own data is. These are
// the steps that turn that on, one app at a time.
//
// Two of these were read off the vendor's own support page: Oura and Whoop.
// Garmin's is the route through the Health app, because Garmin Connect has
// no reliable in app switch and the Health side works whatever version she
// is on. The rest follow the shape every one of these apps uses, named at
// the level that does not move: open the app, find its settings, find Apple
// Health, turn it on.
//
// Menu labels in other companies' apps change without warning and nothing
// here can test against them. `checked` is the date a human last looked, so
// a stale instruction can be found rather than trusted.
//
// The last step is the same everywhere and is the one that matters: the
// toggles in Apple's own sheet are what actually grant access.

export type SyncGuide = {
  // Matches SYNC_APPS name, which is how the screen pairs them.
  app: string;
  title: string;
  steps: string[];
  checked: string;
};

export const SYNC_GUIDES: readonly SyncGuide[] = [
  {
    app: 'Oura',
    title: 'Connect your Oura to Apple Health',
    steps: [
      'Open the Oura app',
      'Tap the menu icon in the upper left',
      'Select Settings > Data sharing > Apple Health',
      'Enable Connect to Health',
      'Tap Turn On All, then Allow',
    ],
    checked: '2026-10-10',
  },
  {
    app: 'Whoop',
    title: 'Connect your Whoop to Apple Health',
    steps: [
      'Open the WHOOP app',
      'Tap the menu icon in the bottom right corner',
      'Scroll down and select Integrations',
      'Tap Apple Health > Connect',
      'Select categories to share and tap Allow',
    ],
    checked: '2026-10-10',
  },
  {
    app: '8 Sleep',
    title: 'Connect your 8 Sleep to Apple Health',
    steps: [
      'Open the Eight Sleep app',
      'Open Settings from your profile',
      'Find Apple Health in the list of integrations',
      'Turn the connection on',
      'Tap Turn On All, then Allow',
    ],
    checked: '2026-10-10',
  },
  {
    app: 'Withings',
    title: 'Connect your Withings to Apple Health',
    steps: [
      'Open the Health Mate app',
      'Tap your profile, then Settings',
      'Select Apple Health',
      'Turn the connection on',
      'Tap Turn On All, then Allow',
    ],
    checked: '2026-10-10',
  },
  {
    app: 'Garmin',
    title: 'Connect your Garmin to Apple Health',
    steps: [
      'Open Garmin Connect once, so it is running',
      'Open the Apple Health app',
      'Tap your profile picture in the top right',
      'Select Privacy > Apps > Garmin Connect',
      'Toggle the categories you want on',
    ],
    checked: '2026-10-10',
  },
  {
    app: 'Strava',
    title: 'Connect your Strava to Apple Health',
    steps: [
      'Open the Strava app',
      'Tap the gear icon in the top right',
      'Select Applications, Services, and Devices > Health',
      'Tap the plus icon, then Connect',
      'Enable Workouts and tap Allow',
    ],
    checked: '2026-10-10',
  },
  {
    app: 'Omron',
    title: 'Connect your Omron to Apple Health',
    steps: [
      'Open the OMRON connect app',
      'Open Settings from your account',
      'Select Apple Health',
      'Turn the connection on',
      'Tap Turn On All, then Allow',
    ],
    checked: '2026-10-10',
  },
];

export function guideFor(app: string): SyncGuide | null {
  return SYNC_GUIDES.find((g) => g.app === app) ?? null;
}
