// One colour per metric, so the six on Today's grid, and each metric's own
// screen, are told apart at a glance. An exception to the meaning palette:
// every one of these is measured, so the meaning colour would paint all six
// the same. Red stays out, kept for escalation.
//
// Pastels on dark; the same hues deepened on light, where a pastel mark
// would fade into the paper.

import { G, type Mode } from './scheme';

const DARK: Record<string, string> = {
  sleep: '#8E9BFF',
  hrv: '#5ED3C4',
  rhr: '#F2A4B8',
  steps: '#E8C46A',
  bp: '#F27D9B',
  temp: '#F09A5B',
  spo2: '#6FB6F5',
};

const LIGHT: Record<string, string> = {
  sleep: '#4F5FD6',
  hrv: '#1C8A7E',
  rhr: '#C24A6E',
  steps: '#A27A12',
  bp: '#C8385E',
  temp: '#B85A1C',
  spo2: '#2A78BE',
};

export const metricHues = (mode: Mode) => (mode === 'light' ? LIGHT : DARK);

// Read once, after Boot has resolved the scheme.
export const METRIC_HUE: Record<string, string> = metricHues(G.mode);
