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

import { useEffect, useRef, useState } from 'react';
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
import { G } from './scheme';
import { PAPER } from './paper';

type Palette = { ink: string; body: string; meta: string; fill: string; fillSelected: string; rule: string; pill: string; onPill: string; card: string };

export type ComposerProps = {
  // Drawn on the chat's white paper rather than the dark ground.
  paper?: boolean;
  // One line, edge to edge in whatever holds it: the plus on the left, the
  // words between, the microphone or send on the right. It grows as she
  // writes, up to a few lines.
  fill?: boolean;
  value: string;
  // The second argument is how the words arrived. Onboarding persists it
  // as input_mode, because "she typed this" and "she said this out loud"
  // are different provenance, and this app does not blur provenance
  // anywhere else either. Callers that do not care may ignore it.
  onChange: (text: string, how: 'typed' | 'spoken') => void;
  placeholder?: string;
  // What the field is, for a screen reader. Not drawn: the question above
  // the box is the visible label.
  label: string;
  attachments?: readonly Attachment[];
  onAttachments?: (next: Attachment[]) => void;
  // What send does here. Required, not optional.
  //
  // It was optional, on the reasoning that a send next to a Continue
  // button is two buttons for one thing. That reasoning was wrong in
  // practice: it meant the Log Cycle box never turned its mic into a send
  // at all, so the same box behaved differently on two screens for a
  // reason only its author knew. Every textbox owes her the same gesture,
  // and a required prop makes the next one decide rather than inherit
  // silence.
  onSend: () => void;
  // Opened from a voice, type or camera button: the box starts doing that,
  // once, as it appears, so the tap that chose it was the only step.
  start?: 'voice' | 'type' | 'camera' | null;
  // The same, on demand: each new n does it again, so buttons beside the
  // box can open the mic, the keyboard or the camera in place.
  command?: { mode: 'voice' | 'type' | 'camera'; n: number } | null;
};

// One size everywhere, the one Care settled on: a single line at rest, so
// the box does not claim the screen before she has anything to say, and it
// grows as she writes. Not a prop, so no screen can drift from it.
const MIN_HEIGHT = 52;

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// The four ways something gets into a health record, behind one plus.
//
// They were two buttons sitting in the box. Four will not fit there, and
// four buttons in a textbox is a toolbar rather than a place to write. So
// the plus holds them and the box stays a box.
// `label` is always the spoken name, so a screen reader hears a sentence
// at every row. `shown` is the one row that also prints it.
//
// A camera, a picture frame and a document are read on sight. A play
// triangle is not: alone it says play, not add a video, and the one row
// whose icon cannot carry its own meaning is the one that keeps its words.
type Way = { key: string; label: string; icon: IconName; shown?: boolean };

const WAYS: Way[] = [
  { key: 'camera', label: 'Take a photo', icon: 'camera' },
  { key: 'image', label: 'Add an image', icon: 'image' },
  { key: 'file', label: 'Add a PDF', icon: 'doc' },
  { key: 'video', label: 'Add a video', icon: 'video', shown: true },
];

export function Composer({
  value,
  onChange,
  placeholder,
  label,
  attachments = [],
  onAttachments,
  onSend,
  start = null,
  command = null,
  paper = false,
  fill = false,
}: ComposerProps) {
  // On the chat's white paper, or on the dark ground.
  const K: Palette = paper ? PAPER : G;
  const s = paper ? ON_PAPER : DARK;
  const field = useRef<TextInput>(null);
  // Why a picker did not open. Permission refused is the common one and is
  // not an error she did anything wrong, so it reads as a fact and says
  // where to change it.
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  // Dictation appends. She may type a sentence, speak the next and correct
  // both; a recogniser that replaced the field would destroy what she wrote.
  const dictation = useDictation((text) => {
    onChange(value.trim() ? `${value.trim()} ${text}` : text, 'spoken');
  });

  const files = attachments;
  const canAdd = !!onAttachments && canAttach(files);

  const keep = (next: Attachment) => {
    setNote('');
    onAttachments?.(addAttachment(files, next));
  };

  // Taking, which is the camera, and the only one of the four that makes
  // something new. The other three add what already exists, which is what
  // their labels say and the reason none of them says record.
  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setNote('Ciatta needs camera permission for this. You can turn it on in Settings.');
        return;
      }
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (shot.canceled || !shot.assets?.length) return;
      const now = new Date();
      keep({ id: id(), kind: 'photo', name: photoName(now), uri: shot.assets[0].uri, addedAt: now.toISOString() });
    } catch {
      setNote('The camera did not open. You can add an image from your library instead.');
    }
  };

  // Adding one she already has. Images and videos come from the same
  // picker, narrowed to one kind each, so each menu row opens on what its
  // label promised rather than on everything.
  const addFromLibrary = async (kind: 'photo' | 'video') => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync(
        kind === 'photo' ? { mediaTypes: ['images'], quality: 0.7 } : { mediaTypes: ['videos'] },
      );
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      const now = new Date();
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
      // PDFs first, since that is what the row says. Images and videos stay
      // accepted so a file she picked from Files still lands rather than
      // being refused for arriving the wrong way.
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
    if (key === 'camera') return takePhoto();
    if (key === 'image') return addFromLibrary('photo');
    if (key === 'video') return addFromLibrary('video');
    return pickDocument();
  };

  useEffect(() => {
    if (start === 'voice') dictation.start();
    else if (start === 'type') setTimeout(() => field.current?.focus(), 250);
    else if (start === 'camera' && canAdd) void takePhoto();
    // Once, as the box appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!command) return;
    if (command.mode === 'voice') {
      if (!dictation.listening) dictation.start();
    } else if (command.mode === 'type') field.current?.focus();
    else if (canAdd) void takePhoto();
    // Once per command.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.n]);

  // Listening always wins: it is the state she needs a way out of, and a
  // send that replaced the only stop would leave a live microphone with no
  // way to end it. Otherwise text in the box means send.
  const action = dictation.listening ? 'stop' : value.trim() ? 'send' : 'mic';

  return (
    <View>
      {/*
        Above the box, not over it. A sheet covering what she has written
        while she decides what to attach to it is a sheet in the way.
      */}
      {open && canAdd ? (
        <View style={s.menu}>
          {WAYS.map((way) => (
            <Pressable
              key={way.key}
              onPress={() => void choose(way.key)}
              accessibilityRole="button"
              // Spoken even where it is not printed, so an icon that says
              // nothing on screen still says something out loud.
              accessibilityLabel={way.label}
              style={({ pressed }) => [s.wayButton, way.shown && s.wayWide, pressed && s.pressed]}
            >
              <Icon name={way.icon} size={19} color={K.body} />
              {way.shown ? <Text style={[font('footnote'), s.wayLabel]}>{way.label}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={s.wrap}>
        <TextInput
          ref={field}
          value={value}
          onChangeText={(t) => onChange(t, 'typed')}
          placeholder={placeholder}
          placeholderTextColor={K.meta}
          multiline
          textAlignVertical="top"
          style={[font('body'), s.field, fill ? s.fillField : { minHeight: MIN_HEIGHT }]}
          accessibilityLabel={label}
        />

        <View style={[s.foot, fill && s.fillFoot]}>
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
                <Icon name="plus" size={20} color={open ? K.onPill : K.body} />
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
              color={action === 'mic' ? K.ink : K.onPill}
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
                  <Icon name={file.kind === 'video' ? 'video' : 'doc'} size={16} color={K.body} />
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
                <Icon name="xmark" size={13} color={K.meta} />
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

const styles = (K: Palette) =>
  StyleSheet.create({
  wrap: { position: 'relative' },
  field: {
    color: K.ink,
    backgroundColor: K.card,
    borderRadius: TILE_RADIUS,
    // On paper the box is the paper: no edge, no tint.
    borderWidth: K === PAPER ? 0 : StyleSheet.hairlineWidth,
    borderColor: K.rule,
    padding: 16,
    // Room at the foot for the controls, so a long answer scrolls behind
    // them rather than under them.
    paddingBottom: 56,
  },
  fillField: { paddingHorizontal: 50, paddingTop: 12, paddingBottom: 12, minHeight: 46, maxHeight: 120 },
  fillFoot: { left: 0, right: 0, bottom: 4 },
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
    backgroundColor: K.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: K.rule,
  },
  plusOn: { backgroundColor: K.ink, borderColor: K.ink },
  // A cross is a plus turned, so the open state is the same glyph rotated
  // rather than a second icon that has to be kept looking like the first.
  turned: { transform: [{ rotate: '45deg' }] },

  // A strip rather than a list, now that three of the four are a glyph
  // each. Four stacked rows of mostly whitespace was a menu pretending to
  // be longer than it is.
  menu: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  // Each way is its own pill, so the tap target stays 44 high even where
  // the glyph inside it is 19.
  wayButton: {
    minWidth: 48,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: K.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: K.rule,
  },
  wayWide: { paddingHorizontal: 16 },
  wayLabel: { color: K.ink },
  action: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: K.fillSelected,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: K.rule,
  },
  actionOn: { backgroundColor: K.ink, borderColor: K.ink },
  pressed: { opacity: 0.55 },
  partial: { color: K.meta, marginTop: 12, fontStyle: 'italic' },
  note: { color: K.meta, marginTop: 10, lineHeight: 18 },
  files: { marginTop: 12, gap: 8 },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: K.fill,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: K.rule,
    paddingRight: 10,
  },
  thumb: { width: 40, height: 40, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, backgroundColor: K.fillSelected },
  thumbDoc: { alignItems: 'center', justifyContent: 'center' },
  fileName: { color: K.body, flex: 1 },
  remove: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
});

const DARK = styles(G);
const ON_PAPER = styles(PAPER);
