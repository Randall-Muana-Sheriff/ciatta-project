// Search on Health: labs, documents, provider records and the places in the
// app, from what is already loaded on the phone. Pure, so the matching and
// where each result opens are tested.
//
// A match is the start of any word, whatever the case: "ferr" finds
// Ferritin, "hydroxy" finds Vitamin D, 25 hydroxy, and "itin" finds nothing.

import type { Screen } from '../navigation';

export type HealthIndex = {
  labs: readonly { name: string }[];
  documents: readonly { id: string; title: string; type: string }[];
  records: readonly { name: string }[];
};

export type HealthOpen =
  | { kind: 'lab'; name: string }
  | { kind: 'document'; id: string }
  | { kind: 'screen'; screen: Screen }
  | { kind: 'view'; view: 'Body' }
  | { kind: 'tab'; tab: import('../navigation').Tab };

export type HealthResult = { key: string; title: string; sub: string; open: HealthOpen };

const PLACES: { title: string; words: string; open: HealthOpen }[] = [
  { title: 'Timeline', words: 'timeline journey', open: { kind: 'screen', screen: 'journey' } },
  { title: 'Cycle', words: 'cycle period', open: { kind: 'screen', screen: 'cycle' } },
  { title: 'Body systems', words: 'body systems', open: { kind: 'view', view: 'Body' } },
  { title: 'Labs', words: 'labs records results', open: { kind: 'tab', tab: 'records' } },
  { title: 'Medications', words: 'medications medicines', open: { kind: 'screen', screen: 'medications' } },
  { title: 'Symptoms', words: 'symptoms', open: { kind: 'screen', screen: 'symptoms' } },
  { title: 'Journal', words: 'journal notes', open: { kind: 'screen', screen: 'journal' } },
  { title: 'Your providers', words: 'providers hospital chart', open: { kind: 'screen', screen: 'chart' } },
];

const MAX = 20;
const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function matches(query: string[], text: string): boolean {
  const have = words(text);
  return query.every((q) => have.some((w) => w.startsWith(q)));
}

export function searchHealth(raw: string, index: HealthIndex): HealthResult[] {
  const query = words(raw);
  if (!query.length || query.join('').length < 2) return [];
  const out: HealthResult[] = [];
  for (const p of PLACES) if (matches(query, `${p.title} ${p.words}`)) out.push({ key: `place:${p.title}`, title: p.title, sub: 'In Ciatta', open: p.open });
  const seenLabs = new Set<string>();
  for (const l of index.labs) {
    if (seenLabs.has(l.name) || !matches(query, l.name)) continue;
    seenLabs.add(l.name);
    out.push({ key: `lab:${l.name}`, title: l.name, sub: 'Lab', open: { kind: 'lab', name: l.name } });
  }
  for (const d of index.documents) if (matches(query, `${d.title} ${d.type}`)) out.push({ key: `doc:${d.id}`, title: d.title, sub: d.type, open: { kind: 'document', id: d.id } });
  const seenRecords = new Set<string>();
  for (const r of index.records) {
    if (seenRecords.has(r.name) || !matches(query, r.name)) continue;
    seenRecords.add(r.name);
    out.push({ key: `rec:${r.name}`, title: r.name, sub: 'From your providers', open: { kind: 'screen', screen: 'chart' } });
  }
  return out.slice(0, MAX);
}
