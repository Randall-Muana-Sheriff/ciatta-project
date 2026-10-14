// The mark each headline metric is shown by on Today. The chart lives on
// All and on the metric's own screen; Today names each metric by its icon.
import type { IconName } from './icons';

export const METRIC_ICON: Record<string, IconName> = {
  sleep: 'sleep',
  steps: 'steps',
  hrv: 'heartPulse',
  rhr: 'heart',
  bp: 'dropPulse',
  temp: 'thermometer',
  spo2: 'oxygen',
};
