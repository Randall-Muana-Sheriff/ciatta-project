// Which procedure the Procedure screen shows, and a name for the add form
// to start from. Navigation carries no parameters, so each waits in a slot
// that is emptied when read.

import type { ProcedureEntry } from './procedureEffect';

let chosen: ProcedureEntry | null = null;
let prefill: string | null = null;

export const chooseProcedure = (p: ProcedureEntry) => {
  chosen = p;
};
export const takeProcedure = () => {
  const p = chosen;
  chosen = null;
  return p;
};
export const prefillProcedure = (name: string) => {
  prefill = name;
};
export const takePrefill = () => {
  const n = prefill;
  prefill = null;
  return n;
};
