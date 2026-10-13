// Logging from Today, in one step: what it is about (symptoms, cycle,
// food), then how she wants to say it: speak, type or take a photo. Each
// opens the Log screen already doing it, so the effortless way is the
// first thing offered and the forms stay a link away inside.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CategoryKey } from '../lib/logCategories';
import type { LogMode } from '../lib/logHandoff';
import { font } from '../theme';
import { Icon, type IconName } from './icons';
import { L } from './surface';

const TOPICS: { key: CategoryKey; label: string; prompt: string }[] = [
  { key: 'body', label: 'Symptoms', prompt: 'How are you feeling today?' },
  { key: 'cycle', label: 'Cycle', prompt: 'Bleeding, pain or anything about your cycle?' },
  { key: 'nutrition', label: 'Food', prompt: 'What did you eat or drink?' },
];
const MODES: { key: LogMode; label: string; icon: IconName }[] = [
  { key: 'voice', label: 'Speak', icon: 'mic' },
  { key: 'type', label: 'Type', icon: 'chat' },
  { key: 'camera', label: 'Photo', icon: 'camera' },
];

export function LogBox({ onLog }: { onLog: (topic: CategoryKey, mode: LogMode) => void }) {
  const [topic, setTopic] = useState<CategoryKey>('body');
  const prompt = TOPICS.find((t) => t.key === topic)!.prompt;
  return (
    <View style={s.box}>
      <View style={s.topics}>
        {TOPICS.map((t) => {
          const on = t.key === topic;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTopic(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [s.topic, on && s.topicOn, pressed && s.pressed]}
            >
              <Text style={[font('footnote', on ? 'semibold' : 'regular'), { color: on ? L.canvas : L.body }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[font('headline'), s.prompt]}>{prompt}</Text>
      <View style={s.modes}>
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => onLog(topic, m.key)}
            accessibilityRole="button"
            accessibilityLabel={`${m.label} to log ${TOPICS.find((t) => t.key === topic)!.label.toLowerCase()}`}
            style={({ pressed }) => [s.mode, pressed && s.pressed]}
          >
            <View style={[s.modeIcon, m.key === 'voice' && s.modeIconLead]}>
              <Icon name={m.icon} size={22} color={m.key === 'voice' ? L.canvas : L.ink} />
            </View>
            <Text style={[font('caption1', 'semibold'), { color: L.body }]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { padding: 16, gap: 14 },
  topics: { flexDirection: 'row', gap: 6 },
  topic: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    backgroundColor: L.recessed,
  },
  topicOn: { backgroundColor: L.ink, borderColor: L.ink },
  prompt: { color: L.ink },
  modes: { flexDirection: 'row', justifyContent: 'space-around' },
  mode: { alignItems: 'center', gap: 6, minWidth: 72 },
  modeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.statement,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  // Voice leads: the most effortless way in is the most prominent.
  modeIconLead: { backgroundColor: L.ink, borderColor: L.ink },
  pressed: { opacity: 0.6 },
});
