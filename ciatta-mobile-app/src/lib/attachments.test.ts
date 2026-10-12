import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addAttachment,
  type Attachment,
  attachmentLine,
  canAttach,
  normalizeAttachments,
  photoName,
  removeAttachment,
  shortName,
  videoName,
} from './attachments';

const made = (id: string, kind: Attachment['kind'] = 'photo'): Attachment => ({
  id,
  kind,
  name: id,
  uri: `file:///${id}`,
  addedAt: '2026-10-11T09:00:00.000Z',
});

// ── Names ────────────────────────────────────────────────────────────

test('a photo is named by the time it was taken', () => {
  assert.equal(photoName(new Date(2026, 9, 11, 9, 5)), 'Photo at 9:05 AM');
});

test('a filename short enough is left exactly as it is', () => {
  assert.equal(shortName('bloods.pdf'), 'bloods.pdf');
});

test('a long filename keeps its extension, because that says what it is', () => {
  const out = shortName('full-blood-count-and-thyroid-panel-2026.pdf');
  assert.ok(out.endsWith('.pdf'), out);
  assert.ok(out.length <= 26, out);
});

test('a hyphen in a filename survives, because a renamed file cannot be found', () => {
  assert.equal(shortName('lab-results.pdf'), 'lab-results.pdf');
});

test('a long name with no extension is simply cut', () => {
  assert.ok(shortName('a'.repeat(60)).endsWith('…'));
});

test('an empty name still has something to show', () => {
  assert.equal(shortName('   '), 'Document');
});

// ── The list ─────────────────────────────────────────────────────────

test('six is the cap, and the seventh is refused rather than dropped silently', () => {
  let list: Attachment[] = [];
  for (let i = 0; i < 6; i += 1) list = addAttachment(list, made(`p${i}`));
  assert.equal(canAttach(list), false);
  assert.equal(addAttachment(list, made('p6')).length, 6);
});

test('removing goes by id, not by position', () => {
  const list = [made('a'), made('b'), made('c')];
  assert.deepEqual(removeAttachment(list, 'b').map((x) => x.id), ['a', 'c']);
});

// ── What may be said about them ──────────────────────────────────────

test('nothing attached says nothing at all', () => {
  assert.equal(attachmentLine([]), null);
});

test('they are counted by kind and never described', () => {
  const line = attachmentLine([made('a'), made('b'), made('c', 'document')]);
  assert.equal(line, '2 photos and 1 document, kept on this phone');
});

test('one photo is singular', () => {
  assert.equal(attachmentLine([made('a')]), '1 photo, kept on this phone');
});

test('the line never claims Ciatta read the file', () => {
  const line = attachmentLine([made('a', 'document')]) as string;
  for (const word of ['shows', 'says', 'result', 'value', 'read']) {
    assert.ok(!line.toLowerCase().includes(word), `${line} must not say ${word}`);
  }
});

// ── Coming back from jsonb ───────────────────────────────────────────

test('a column that holds something else at all gives an empty list', () => {
  assert.deepEqual(normalizeAttachments(null), []);
  assert.deepEqual(normalizeAttachments('photo'), []);
  assert.deepEqual(normalizeAttachments({ kind: 'photo' }), []);
});

test('an entry with no uri is dropped, not repaired into a broken file', () => {
  assert.deepEqual(normalizeAttachments([{ kind: 'photo', name: 'x' }]), []);
});

test('an entry with an unknown kind is dropped', () => {
  assert.deepEqual(normalizeAttachments([{ kind: 'audio', uri: 'file:///a' }]), []);
});

test('a good entry round trips, and a missing name gets one', () => {
  const out = normalizeAttachments([{ kind: 'document', uri: 'file:///a', id: 'z' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Document');
  assert.equal(out[0].id, 'z');
});

test('a column holding more than the cap is trimmed to it', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ kind: 'photo', uri: `file:///${i}` }));
  assert.equal(normalizeAttachments(many).length, 6);
});

// ── Video, the fourth way in ─────────────────────────────────────────

test('a video is named by the time it was taken, like a photo', () => {
  assert.equal(videoName(new Date(2026, 9, 11, 14, 30)), 'Video at 2:30 PM');
});

test('three kinds are counted separately and read as a sentence', () => {
  const list: Attachment[] = [made('a'), made('b'), made('c', 'video'), made('d', 'document')];
  assert.equal(attachmentLine(list), '2 photos, 1 video and 1 document, kept on this phone');
});

test('two kinds join with and, not a comma', () => {
  assert.equal(attachmentLine([made('a'), made('c', 'video')]), '1 photo and 1 video, kept on this phone');
});

test('a video round trips from the metadata column', () => {
  const out = normalizeAttachments([{ kind: 'video', uri: 'file:///v' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'video');
  assert.equal(out[0].name, 'Video');
});

test('the line still never claims Ciatta watched the video', () => {
  const line = attachmentLine([made('a', 'video')]) as string;
  for (const word of ['shows', 'says', 'watched', 'contains', 'read']) {
    assert.ok(!line.toLowerCase().includes(word), `${line} must not say ${word}`);
  }
});
