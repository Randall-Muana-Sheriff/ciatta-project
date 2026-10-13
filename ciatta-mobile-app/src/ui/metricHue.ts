// One colour per metric, so the six on Today's grid, and each metric's own
// screen, are told apart at a glance. An exception to the meaning palette:
// every one of these is measured, so the meaning colour would paint all six
// the same. Red stays out, kept for escalation.
export const METRIC_HUE: Record<string, string> = {
  sleep: '#8E9BFF',
  hrv: '#5ED3C4',
  steps: '#E8C46A',
  bp: '#F27D9B',
  temp: '#F09A5B',
  spo2: '#6FB6F5',
};
