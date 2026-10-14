// One list in its own sheet: a search bar to find or add, her picks as
// filled chips, and the common ones as chips to tap. Used for every list in
// Health Details, so each is kept the same way.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { font } from '../theme';
import { Icon } from './icons';
import { G } from './scheme';
import { Sheet } from './Sheet';

export function PickListSheet({
  visible,
  title,
  placeholder,
  options,
  selected,
  onChange,
  onClose,
  allowCustom = true,
  note,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  options: readonly string[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
  // Off for a closed set, where only the listed options mean anything.
  allowCustom?: boolean;
  note?: string;
}) {
  const [q, setQ] = useState('');
  const query = q.trim();
  const lower = query.toLowerCase();
  const isPicked = (x: string) => selected.some((s) => s.toLowerCase() === x.toLowerCase());
  const shown = options.filter((o) => !isPicked(o) && (!lower || o.toLowerCase().includes(lower)));
  const known = [...options, ...selected].some((o) => o.toLowerCase() === lower);
  const add = (x: string) => {
    if (!isPicked(x)) onChange([...selected, x]);
  };
  const remove = (x: string) => onChange(selected.filter((s) => s !== x));

  return (
    <Sheet
      visible={visible}
      title={title}
      onDone={() => {
        setQ('');
        onClose();
      }}
    >
      <View style={s.search}>
        <Icon name="search" size={18} color={G.meta} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={placeholder}
          placeholderTextColor={G.meta}
          style={[font('body'), s.input]}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (allowCustom && query && !known) {
              add(query);
              setQ('');
            }
          }}
          accessibilityLabel={placeholder}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10}>
            <Icon name="xmark" size={16} color={G.meta} />
          </Pressable>
        ) : null}
      </View>

      {allowCustom && query && !known ? (
        <Pressable
          onPress={() => {
            add(query);
            setQ('');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [s.addRow, pressed && s.pressed]}
        >
          <Icon name="plus" size={16} color={G.ink} />
          <Text style={[font('subhead', 'semibold'), { color: G.ink }]}>{`Add “${displayCopy(query)}”`}</Text>
        </Pressable>
      ) : null}

      {selected.length ? (
        <>
          <Text style={[font('footnote', 'semibold'), s.label]}>Yours</Text>
          <View style={s.chips}>
            {selected.map((x) => (
              <Pressable key={x} onPress={() => remove(x)} accessibilityRole="button" accessibilityLabel={`Remove ${x}`} style={({ pressed }) => [s.chip, s.chipOn, pressed && s.pressed]}>
                <Text style={[font('subhead'), { color: G.onPill }]}>{displayCopy(x)}</Text>
                <Icon name="xmark" size={12} color={G.onPill} weight={2} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {shown.length ? (
        <>
          <Text style={[font('footnote', 'semibold'), s.label]}>{lower ? 'Matches' : 'Common'}</Text>
          <View style={s.chips}>
            {shown.map((x) => (
              <Pressable key={x} onPress={() => add(x)} accessibilityRole="button" accessibilityLabel={`Add ${x}`} style={({ pressed }) => [s.chip, pressed && s.pressed]}>
                <Text style={[font('subhead'), { color: G.ink }]}>{displayCopy(x)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {note ? <Text style={[font('footnote'), s.note]}>{note}</Text> : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: G.card, borderRadius: 999, paddingHorizontal: 16, minHeight: 46, marginTop: 4 },
  input: { flex: 1, color: G.ink, paddingVertical: 10 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: G.fill, alignSelf: 'flex-start' },
  label: { color: G.meta, marginTop: 22, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: G.fill },
  chipOn: { backgroundColor: G.ink },
  pressed: { opacity: 0.7 },
  note: { color: G.meta, marginTop: 20 },
});
