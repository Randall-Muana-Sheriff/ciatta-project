// What Fasten's search says back while she uses it. Only enough to run the
// sheet: whether to close, and whether to say a connection failed. Which
// provider she connected is never read here; the server learns that from
// Fasten's signed webhook.

export type StitchOutcome = { kind: 'complete' } | { kind: 'connected' } | { kind: 'failed'; message: string };

export function stitchOutcome(event: unknown): StitchOutcome | null {
  const type = (event as { event_type?: unknown } | null)?.event_type;
  if (type === 'widget.complete') return { kind: 'complete' };
  if (type === 'patient.connection_success') return { kind: 'connected' };
  if (type === 'patient.connection_failed') return { kind: 'failed', message: 'That provider did not connect. Nothing was shared.' };
  return null;
}
