// A question handed to Care from elsewhere in the app, such as Explore on
// a body system. Care, if it is listening, asks it at once; otherwise it
// asks it the next time it reads. Delivered once either way.

let pending: string | null = null;
const listeners = new Set<(prompt: string) => void>();

export function askCare(prompt: string): void {
  if (listeners.size) {
    for (const l of listeners) l(prompt);
    return;
  }
  pending = prompt;
}

export function takeCareAsk(): string | null {
  const p = pending;
  pending = null;
  return p;
}

export function onCareAsk(listener: (prompt: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Which request or clinician a pushed screen opens on. Navigation carries
// a screen name only, so the choice is left here first and read once.
export type RequestOpen = { id?: string; draft?: { kind: import('./care').RequestKind; tests?: string[]; medication?: string; clinician?: string | null } };
let requestOpen: RequestOpen | null = null;
export const openRequest = (o: RequestOpen) => {
  requestOpen = o;
};
export const takeRequest = (): RequestOpen | null => {
  const o = requestOpen;
  requestOpen = null;
  return o;
};

let clinicianOpen: string | null = null;
export const openClinician = (id: string | null) => {
  clinicianOpen = id;
};
export const takeClinician = (): string | null => {
  const id = clinicianOpen;
  clinicianOpen = null;
  return id;
};
