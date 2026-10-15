import type { ReportKey } from './labReport';

// Which test the lab detail screen opens on. Navigation carries a screen
// name only, so the row that was tapped leaves the test's name here first.
let chosen = '';

export const chooseLab = (name: string) => {
  chosen = name;
};

export const chosenLab = () => chosen;

// Which report the report screen opens on, left here by the row or the
// save that opened it.

let report: ReportKey | null = null;

export const chooseReport = (key: ReportKey) => {
  report = key;
};

export const chosenReport = () => report;
