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
