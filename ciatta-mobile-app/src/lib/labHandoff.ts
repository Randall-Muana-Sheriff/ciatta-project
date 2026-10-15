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

// A file a document reading found to be a lab report, handed to Add a Lab
// Report so it is read there, once.
let pendingLabFile: { base64: string; kind: 'image' | 'pdf' } | null = null;
export const chooseLabFile = (f: { base64: string; kind: 'image' | 'pdf' }) => {
  pendingLabFile = f;
};
export const takeLabFile = () => {
  const f = pendingLabFile;
  pendingLabFile = null;
  return f;
};
