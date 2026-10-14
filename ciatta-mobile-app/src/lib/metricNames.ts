// The one place a metric and a group are named. Today, the dashboard, the
// list, each metric's own screen and the vitals all read their labels from
// here, so the same reading is never called two things. Full names
// everywhere, in title case as Apple Health sets them; a short form only on
// Today's small cards, where a third of a row cannot hold the full name.
// Groups follow the Log's own categories (Mind, Nutrition, Gut), so what she
// logs under a name is shown under the same name.

export const NAME = {
  sleep: 'Sleep',
  timeAsleep: 'Time Asleep',
  timeInBed: 'Time in Bed',
  deep: 'Deep',
  rem: 'REM',
  light: 'Light',
  awake: 'Awake',
  hrv: 'Heart Rate Variability',
  rhr: 'Resting Heart Rate',
  bp: 'Blood Pressure',
  spo2: 'Blood Oxygen',
  temp: 'Skin Temperature',
  weight: 'Weight',
  steps: 'Steps',
  active: 'Active Minutes',
  workouts: 'Workouts',
  cycleDay: 'Cycle Day',
  energy: 'Energy',
  mood: 'Mood',
  stress: 'Stress',
  caffeine: 'Caffeine',
  alcohol: 'Alcohol',
  foods: 'Foods',
  gutSymptoms: 'Gut Symptoms',
  bowel: 'Bowel Movements',
} as const;

export const SHORT = {
  hrv: 'HRV',
  rhr: 'RHR',
  bp: 'BP',
  spo2: 'SpO2',
  temp: 'Skin Temp',
} as const;

export const GROUP = {
  sleep: 'Sleep',
  heart: 'Heart',
  vitals: 'Vitals',
  movement: 'Movement',
  cycle: 'Cycle',
  mind: 'Mind',
  nutrition: 'Nutrition',
  gut: 'Gut',
  symptoms: 'Symptoms',
  medications: 'Medications',
  labs: 'Labs',
  weather: 'Weather',
} as const;

export const GROUP_ORDER: string[] = [
  GROUP.sleep, GROUP.heart, GROUP.vitals, GROUP.movement, GROUP.cycle, GROUP.mind,
  GROUP.nutrition, GROUP.gut, GROUP.symptoms, GROUP.medications, GROUP.labs, GROUP.weather,
];
