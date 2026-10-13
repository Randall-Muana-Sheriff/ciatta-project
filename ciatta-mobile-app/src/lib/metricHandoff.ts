// Which metric the detail screen opens on. Navigation carries a screen
// name only, so the card that was tapped leaves its key here first.
import type { MetricKey } from './metricDetail';

let chosen: MetricKey = 'sleep';

export const chooseMetric = (key: MetricKey) => {
  chosen = key;
};

export const chosenMetric = (): MetricKey => chosen;
