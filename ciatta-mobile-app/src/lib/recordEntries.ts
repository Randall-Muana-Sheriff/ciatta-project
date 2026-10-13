// What she added to her records herself: a note, a photo of a letter, the
// PDF a clinic emailed, said or typed. Kept as journal entries filed to
// records, and listed on the Records view newest first.
//
// Named from her own words, or the first file when she wrote none. Nothing
// is read off a page: Ciatta has not looked inside the files.

import type { JournalView } from '../data/rows';
import { type Attachment, attachmentLine } from './attachments';

export type RecordEntry = { key: string; title: string; sub: string };

const TITLE_LIMIT = 40;

export function recordTitle(text: string, attachments: readonly Attachment[]): string {
  const line = text.trim().split('\n')[0].trim();
  if (!line) return attachments[0]?.name ?? 'Record';
  if (line.length <= TITLE_LIMIT) return line;
  const cut = line.slice(0, TITLE_LIMIT);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut).trim();
}

export function recordEntries(view: JournalView): RecordEntry[] {
  return view.months
    .flatMap((m) => m.items)
    .filter((i) => i.filed === 'records')
    .map((i, n) => {
      const files = i.attachments ?? [];
      const line = attachmentLine(files);
      return { key: `${i.at ?? i.date}-${n}`, title: recordTitle(i.text, files), sub: line ? `${i.date} · ${line}` : i.date };
    });
}
