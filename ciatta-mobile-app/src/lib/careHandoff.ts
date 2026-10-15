// A question handed to Care from elsewhere in the app, such as Explore on
// a body system. Care, if it is listening, asks it at once; otherwise it
// asks it the next time it reads. Delivered once either way.

// What she attached in the chat box on Today, carried with the message
// she sent from there.
type Files = readonly import('./attachments').Attachment[];
let pending: string | null = null;
let pendingFiles: Files = [];
const listeners = new Set<(prompt: string, files: Files) => void>();

export function askCare(prompt: string, files: Files = []): void {
  if (listeners.size) {
    for (const l of listeners) l(prompt, files);
    return;
  }
  pending = prompt;
  pendingFiles = files;
}

export function takeCareAsk(): { prompt: string; files: Files } | null {
  const p = pending;
  const f = pendingFiles;
  pending = null;
  pendingFiles = [];
  return p == null ? null : { prompt: p, files: f };
}

export function onCareAsk(listener: (prompt: string, files: Files) => void): () => void {
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

// Which research insight its screen opens on.
let insightOpen: string | null = null;
export const openInsight = (id: string) => {
  insightOpen = id;
};
export const takeInsight = (): string | null => {
  const id = insightOpen;
  insightOpen = null;
  return id;
};

// What Discuss on an insight asks the concierge.
export const discussPrompt = (title: string) => `I read "${title}" How does it relate to my record?`;
