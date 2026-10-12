// What she attached, and what Ciatta is allowed to say about it.
//
// A photo of a lab report and a PDF from a clinic are the two documents a
// woman actually has to hand, and both arrive here as a file reference: a
// kind, a name, and a URI on this phone. That is the whole of it, and the
// honesty of this module is in what it does not do.
//
// Ciatta has not read the file. Nothing in here parses a PDF, runs OCR, or
// turns a page of bloodwork into values, so an attachment is never evidence
// of a reading and must never be summarized as though it were. It is a
// pointer she chose to keep with an episode, so that when she reads the
// episode back, or takes it to an appointment, the document is named.
//
// The file itself stays on the phone. There is no bucket yet, so the URI is
// local and the copy in the interface says so rather than implying an
// upload that has not happened.

export type AttachmentKind = 'photo' | 'document' | 'video';

export type Attachment = {
  // Stable for the life of the attachment, so removing one does not depend
  // on its position in the list.
  id: string;
  kind: AttachmentKind;
  // What to call it on screen. A document carries its own filename; a photo
  // taken in the moment has none, so one is made from the time it was taken.
  name: string;
  // Where it is on this phone. Never shown.
  uri: string;
  addedAt: string;
};

const MAX = 6;

// Names are identifiers, not copy: "lab-results.pdf" renamed to "lab results
// .pdf" is a file she can no longer find. So a document keeps its filename
// exactly, and displayCopy's hyphen rule does not reach it. Everything this
// module writes itself is already free of dashes.
export function photoName(at: Date): string {
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `Photo at ${time}`;
}

// A video taken in the moment has no filename either. Named the same way,
// by when it was taken, because that is the only thing true about it that
// she will recognise later.
export function videoName(at: Date): string {
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `Video at ${time}`;
}

// A filename from the picker, trimmed to something that fits a chip without
// losing the extension, which is the part that says what the file is.
export function shortName(name: string, limit = 26): string {
  const clean = name.trim();
  if (!clean) return 'Document';
  if (clean.length <= limit) return clean;
  const dot = clean.lastIndexOf('.');
  // No extension to protect: cut the tail.
  if (dot <= 0 || clean.length - dot > 6) return `${clean.slice(0, limit - 1)}…`;
  const ext = clean.slice(dot);
  const head = clean.slice(0, Math.max(1, limit - ext.length - 1));
  return `${head}…${ext}`;
}

// Six is the cap, because a list longer than that is a folder and this is a
// log entry. The cap is enforced here rather than in the screen so every
// caller gets it.
export function canAttach(list: readonly Attachment[]): boolean {
  return list.length < MAX;
}

export function addAttachment(list: readonly Attachment[], next: Attachment): Attachment[] {
  if (!canAttach(list)) return [...list];
  return [...list, next];
}

export function removeAttachment(list: readonly Attachment[], id: string): Attachment[] {
  return list.filter((x) => x.id !== id);
}

// How the episode's summary names them. Counted by kind, because "2 photos
// and a PDF" is what she would say, and never described: Ciatta has not
// looked inside either one.
export function attachmentLine(list: readonly Attachment[]): string | null {
  if (!list.length) return null;
  const count = (k: AttachmentKind) => list.filter((x) => x.kind === k).length;
  const say = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : null);
  const parts = [
    say(count('photo'), 'photo', 'photos'),
    say(count('video'), 'video', 'videos'),
    say(count('document'), 'document', 'documents'),
  ].filter((x): x is string => x != null);
  const joined =
    parts.length <= 1 ? (parts[0] ?? '') : parts.length === 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${joined}, kept on this phone`;
}

// Back from the episode's metadata column, which is jsonb and so can hold
// anything. An entry missing a URI or a kind is dropped rather than repaired:
// a half attachment would render as a file that cannot be opened.
export function normalizeAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  const out: Attachment[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const x = raw as Record<string, unknown>;
    const kind = x.kind === 'photo' || x.kind === 'document' || x.kind === 'video' ? x.kind : null;
    if (!kind || typeof x.uri !== 'string' || !x.uri) continue;
    out.push({
      id: typeof x.id === 'string' && x.id ? x.id : `${kind}-${out.length}`,
      kind,
      name:
        typeof x.name === 'string' && x.name.trim()
          ? x.name
          : kind === 'photo'
            ? 'Photo'
            : kind === 'video'
              ? 'Video'
              : 'Document',
      uri: x.uri,
      addedAt: typeof x.addedAt === 'string' ? x.addedAt : '',
    });
  }
  return out.slice(0, MAX);
}
