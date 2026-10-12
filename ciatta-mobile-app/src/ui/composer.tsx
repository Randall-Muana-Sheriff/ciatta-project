// One textbox, used wherever she writes in her own words.
//
// Onboarding's "What has been changing?" box set the shape: one control in
// the corner rather than a row of buttons underneath, and the control is the
// gesture. Empty box, a mic. Text in the box, send. Listening, stop, and it
// stays stop even once words have arrived, because a send button that
// replaced the only way to end the recording would leave her holding a live
// microphone with no way to stop it.
//
// This is that box, extracted, with the ways a document reaches a health
// record behind a plus on the left: the camera for the lab report on the
// kitchen table, a video for the thing that is easier shown than written,
// the library for what she already has, and the file picker for the PDF a
// clinic emailed. Behind a plus rather than in the box, because four
// buttons sitting in a textbox make it a toolbar instead of a place to
// write.
//
// What Ciatta does with an attachment is nothing, deliberately. See
// lib/attachments.ts: no OCR, no parsing, no values read off a page. It is
// named and kept with the entry, and the copy here says it stays on the
// phone, because there is no bucket yet and an upload she was told happened
// would be worse than one that did not.

import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import {
  addAttachment,
  type Attachment,
  type AttachmentKind,
  canAttach,
  photoName,
  removeAttachment,
  shortName,
  videoName,
} from '../lib/attachments';
import { useDictation } from '../lib/dictation';
import { displayCopy } from '../lib/displayCopy';
import { font } from '../theme';
import { Icon, type IconName } from './icons';
import { L, TILE_RADIUS } from './surface';

export type ComposerProps = {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  // What the field is, for a screen reader. Not drawn: the question above
  // the box is the visible label.
  label: string;
  attachments?: readonly Attachment[];
  onAttachments?: (next: Attachment[]) => void;
  // Given only where sending is a real action. Without it the corner control
  // is the mic alone, because a send button that duplicates Continue is a
  // second button for the same thing.
  onSend?: () => void;
  minHeight?: number;
};

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// The four ways something gets into a health record, behind one plus.
//
// They were two buttons sitting in the box. Four will not fit there, and
// four buttons in a textbox is a toolbar rather than a place to write. So
// the plus holds them and the box stays a box.
type Way = { key: string; label: string; icon: IconName };

const WAYS: Way[] = [
  { key: 'camera', label: 'Take a photo', icon: 'camera' },
  { key: 'video', label: 'Record a video', icon: 'video' },
  { key: 'library', label: 'Photo or video', icon: 'image' },
  { key: 'file', label: 'PDF or file', icon: 'doc' },
];

export function Composer({
  value,
  onChange,
  placeholder,
  label,
  attachments = [],
  onAttachments,
  onSend,
  minHeight = 148,
}: ComposerProps) {
  // Why a picker did not open. Permission refused is the common one and is
  // not an error she did anything wrong, so it reads as a fact and says
  // where to change it.
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  // Dictation appends. She may type a sentence, speak the next and correct
  // both; a recogniser that replaced the field would destroy what she wrote.
  const dictation = useDictation((text) => {
    onChange(value.trim() ? `${value.trim()} ${text}` : text);
  });

  const files = attachments;
  const canAdd = !!onAttachments && canAttach(files);

  const keep = (next: Attachment) => {
    setNote('');
    onAttachments?.(addAttachment(files, next));
  };

  // From the camera, either still or moving.
  const capture = async (kind: 'photo' | 'video') => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setNote('Ciatta needs camera permission for this. You can turn it on in Settings.');
        return;
      }
      const shot = await ImagePicker.launchCameraAsync(
        kind === 'photo'
          ? { mediaTypes: ['images'], quality: 0.7 }
          : // Capped, because a health record does not need ten minutes of
            // footage and the file stays on her phone either way.
            { mediaTypes: ['videos'], videoMaxDuration: 180 },
      );
      if (shot.canceled || !shot.assets?.length) return;
      const now = new Date();
      keep({
        id: id(),
        kind,
        name: kind === 'photo' ? photoName(now) : videoName(now),
        uri: shot.assets[0].uri,
        addedAt: now.toISOString(),
      });
    } catch {
      setNote('The camera did not open. You can add it from your library instead.');
    }
  };

  // From what she already has.
  const pickFromLibrary = async () => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      const now = new Date();
      // The picker says which it gave back, so the kind is read rather than
      // assumed: a video filed as a photo would render as a broken image.
      // The picker reports livePhoto and pairedVideo as well as image and
      // video. Anything that moves is filed as a video, because that is
      // what will and will not render as a still.
      const kind: AttachmentKind = asset.type === 'video' || asset.type === 'pairedVideo' ? 'video' : 'photo';
      keep({
        id: id(),
        kind,
        name: asset.fileName ? shortName(asset.fileName) : kind === 'photo' ? photoName(now) : videoName(now),
        uri: asset.uri,
        addedAt: now.toISOString(),
      });
    } catch {
      setNote('That did not open.');
    }
  };

  // From a file, which is how a clinic sends anything.
  const pickDocument = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'video/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const file = picked.assets[0];
      const now = new Date();
      const kind: AttachmentKind = file.mimeType?.startsWith('image/')
        ? 'photo'
        : file.mimeType?.startsWith('video/')
          ? 'video'
          : 'document';
      keep({ id: id(), kind, name: shortName(file.name), uri: file.uri, addedAt: now.toISOString() });
    } catch {
      setNote('That file did not open.');
    }
  };

  const choose = async (key: string) => {
    setOpen(false);
    if (!canAdd) return;
    if (key === 'camera') return capture('photo');
    if (key === 'video') return capture('video');
    if (key === 'library') return pickFromLibrary();
    return pickDocument();
  };

  // Listening always wins: it is the state she needs a way out of.
  const action = dictation.listening ? 'stop' : onSend && value.trim() ? 'send' : 'mic';

  return (
    <View>
      {/*
        Above the box, not over it. A sheet covering what she has written
        while she decides what to attach to it is a sheet in the way.
      */}
      {open && canAdd ? (
        <View style={s.menu}>
          {WAYS.map((way, n) => (
            <Pressable
              key={way.key}
              onPress={() => void choose(way.key)}
              accessibilityRole="button"
              accessibilityLabel={way.label}
              style={({ pressed }) => [s.wayRow, n > 0 && s.wayDivided, pressed && s.pressed]}
            >
              <Icon name={way.icon} size={19} color={L.body} />
              <Text style={[font('subhead'), s.wayLabel]}>{way.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={s.wrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={L.meta}
          multiline
          textAlignVertical="top"
          style={[font('body'), s.field, { minHeight }]}
          accessibilityLabel={label}
        />

        <View style={s.foot}>
          {/*
            One plus on the left, away from the control that commits. Gone
            entirely once the list is full rather than shown dead, because a
            button that cannot act is a button she taps.

            It rotates into a cross while the menu is open, so the thing
            that opened it is also the thing that closes it.
          */}
          {canAdd ? (
            <Pressable
              onPress={() => setOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={open ? 'Close attachment options' : 'Add a photo, video or file'}
              accessibilityState={{ expanded: open }}
              hitSlop={8}
              style={({ pressed }) => [s.plus, open && s.plusOn, pressed && s.pressed]}
            >
              <View style={open ? s.turned : undefined}>
                <Icon name="plus" size={20} color={open ? L.canvas : L.body} />
              </View>
            </Pressable>
          ) : (
            <View />
          )}

          <Pressable
            onPress={action === 'stop' ? dictation.stop : action === 'send' ? onSend : dictation.start}
            accessibilityRole="button"
            accessibilityLabel={action === 'stop' ? 'Stop recording' : action === 'send' ? 'Send' : 'Dictate'}
            hitSlop={6}
            style={({ pressed }) => [s.action, action !== 'mic' && s.actionOn, pressed && s.pressed]}
          >
            <Icon
              name={action === 'stop' ? 'stopSquare' : action === 'send' ? 'send' : 'mic'}
              size={19}
              color={action === 'mic' ? L.ink : L.canvas}
              filled={action === 'stop'}
            />
          </Pressable>
        </View>
      </View>

      {/*
        The recogniser's running guess, greyed, so she can see it is not
        committed yet. "Listening" holds the line before the first word, so
        the box does not look broken while it warms up.
      */}
      {dictation.listening ? (
        <Text style={[font('body'), s.partial]}>{dictation.partial || 'Listening'}</Text>
      ) : null}

      {dictation.error || note ? (
        <Text style={[font('caption1'), s.note]} accessibilityLiveRegion="polite">
          {displayCopy(dictation.error || note)}
        </Text>
      ) : null}

      {files.length ? (
        <View style={s.files}>
          {files.map((file) => (
            <View key={file.id} style={s.file}>
              {/*
                A photo shows itself. A video and a PDF have nothing an
                Image can render, so they show what they are: pointing
                Image at a .mov renders a blank box, not a frame.
              */}
              {file.kind === 'photo' ? (
                <Image source={{ uri: file.uri }} style={s.thumb} accessibilityIgnoresInvertColors />
              ) : (
                <View style={[s.thumb, s.thumbDoc]}>
                  <Icon name={file.kind === 'video' ? 'video' : 'doc'} size={16} color={L.body} />
                </View>
              )}
              {/*
                The name is an identifier, not copy: a filename run through
                displayCopy's hyphen rule is a file she can no longer find.
              */}
              <Text style={[font('footnote'), s.fileName]} numberOfLines={1}>
                {file.name}
              </Text>
              <Pressable
                onPress={() => onAttachments?.(removeAttachment(files, file.id))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${file.name}`}
                hitSlop={8}
                style={({ pressed }) => [s.remove, pressed && s.pressed]}
              >
                <Icon name="xmark" size={13} color={L.meta} />
              </Pressable>
            </View>
          ))}
          <Text style={[font('caption1'), s.note]}>
            Kept with this entry and stored on this phone. Ciatta does not read what is inside them.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative' },
  field: {
    color: L.ink,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    padding: 16,
    // Room at the foot for the controls, so a long answer scrolls behind
    // them rather than under them.
    paddingBottom: 56,
  },
  foot: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // The plus. Same 38pt circle the mic uses, so the two ends of the foot
  // row are the same object at different weights.
  plus: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.recessed,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  plusOn: { backgroundColor: L.ink, borderColor: L.ink },
  // A cross is a plus turned, so the open state is the same glyph rotated
  // rather than a second icon that has to be kept looking like the first.
  turned: { transform: [{ rotate: '45deg' }] },

  menu: {
    marginBottom: 8,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    overflow: 'hidden',
  },
  wayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  wayDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: L.rule },
  wayLabel: { color: L.ink },
  action: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.statement,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  actionOn: { backgroundColor: L.ink, borderColor: L.ink },
  pressed: { opacity: 0.55 },
  partial: { color: L.meta, marginTop: 12, fontStyle: 'italic' },
  note: { color: L.meta, marginTop: 10, lineHeight: 18 },
  files: { marginTop: 12, gap: 8 },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: L.recessed,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    paddingRight: 10,
  },
  thumb: { width: 40, height: 40, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, backgroundColor: L.statement },
  thumbDoc: { alignItems: 'center', justifyContent: 'center' },
  fileName: { color: L.body, flex: 1 },
  remove: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
});
