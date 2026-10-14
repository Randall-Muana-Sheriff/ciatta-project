// Add something to her records, any way it reaches her: said out loud,
// typed, a photo of the letter on the table, an image she already has, or
// the PDF a clinic emailed. One box, the same one every log uses: the mic
// in its corner, and the camera, images, PDF and video behind its plus.
//
// Kept as a note filed to records, with its files on this phone. Nothing is
// read off a page.

import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { Attachment } from '../lib/attachments';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { Composer } from '../ui/composer';
import { ListGroup, ListRow } from '../ui/chrome';
import { DetailScreen, SaveBar } from '../ui/kit';
import { L, SPACE } from '../ui/surface';
import { G } from '../ui/scheme';

export function AddRecordScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!text.trim() || files.length > 0;

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await repo.addRecord(text.trim(), files);
      nav.back();
    } catch (e) {
      setError(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen title="Add to Your Records" onBack={nav.back} footer={<SaveBar label={saving ? 'Saving' : 'Save'} disabled={!ready || saving} onPress={() => void save()} />}>
      <Text style={[font('subhead'), a.lead]}>Say it, type it, take a photo, or add a PDF.</Text>
      <Text style={[font('caption1'), a.hint]}>Tap the microphone to speak. Tap the plus for the camera, an image, a PDF or a video.</Text>
      <Composer
        value={text}
        onChange={(v) => setText(v)}
        placeholder="For example, iron results from my GP"
        label="Describe the record in your own words"
        attachments={files}
        onAttachments={setFiles}
        onSend={() => void save()}
      />
      <Text style={[font('footnote'), a.note]}>Files stay on this phone. Ciatta does not read inside them.</Text>

      {/* A procedure needs its date, so it has its own short form. */}
      <ListGroup header="Or" style={{ marginTop: SPACE.block }}>
        <ListRow first icon="plus" title="Add a Procedure" sub="A surgery or procedure, with its date" onPress={() => nav.push('addProcedure')} />
      </ListGroup>
      {error ? <Text style={[font('footnote'), a.note]}>{displayCopy(error)}</Text> : null}
    </DetailScreen>
  );
}

const a = StyleSheet.create({
  lead: { color: G.ink, marginBottom: 6 },
  hint: { color: G.meta, marginBottom: SPACE.near },
  note: { color: L.meta, marginTop: 8 },
});
