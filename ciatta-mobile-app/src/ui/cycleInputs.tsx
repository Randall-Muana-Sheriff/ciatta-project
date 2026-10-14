import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { Observation } from '../lib/cyclePatterns';
import { useCycle } from '../state/cycleStore';
import { C, font, RADIUS } from '../theme';
import { L } from './surface';
import { Panel } from './chrome';
import { Icon } from './icons';
import { G } from './scheme';

// Inputs and read outs for the Cycle experience, built on the app's chips,
// cards and controls.

export function StepHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.header}>
      <Text style={[font('title2', 'semibold'), { color: G.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {hint ? <Text style={[font('subhead'), { color: G.body, marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function FieldLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={s.fieldLabel}>
      <Text style={[font('headline'), { color: G.ink }]}>{children}</Text>
      {hint ? <Text style={[font('footnote'), { color: G.body, marginTop: 2 }]}>{hint}</Text> : null}
    </View>
  );
}

// Selectable chips. The check mark carries the selected state alongside
// the color.
export function ChoiceChips({
  options,
  selected,
  onToggle,
  single = false,
}: {
  options: readonly string[];
  selected: readonly string[];
  onToggle: (option: string) => void;
  single?: boolean;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <Pressable
            key={o}
            onPress={() => onToggle(o)}
            accessibilityRole={single ? 'radio' : 'checkbox'}
            accessibilityState={{ checked: on }}
            hitSlop={4}
            style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.pressed]}
          >
            {on ? <Icon name="check" size={14} color={G.ink} weight={2.4} /> : null}
            <Text style={[font('subhead', on ? 'semibold' : 'regular'), { color: on ? G.ink : G.ink }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RemovableChips({ items, onRemove }: { items: readonly string[]; onRemove: (item: string) => void }) {
  return (
    <View style={s.chips}>
      {items.map((o) => (
        <Pressable
          key={o}
          onPress={() => onRemove(o)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${o}`}
          hitSlop={4}
          style={({ pressed }) => [s.chip, s.chipOn, pressed && s.pressed]}
        >
          <Text style={[font('subhead', 'semibold'), { color: G.ink }]}>{o}</Text>
          <Icon name="xmark" size={13} color={G.ink} weight={2.2} />
        </Pressable>
      ))}
    </View>
  );
}

// 0 to 10 intensity. Kept visually apart from how much the pain affected
// someone, which is asked separately.
export function SeverityScale({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <View>
      <View style={s.scale} accessibilityRole="radiogroup">
        {Array.from({ length: 11 }, (_, n) => {
          const on = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${n} out of 10`}
              style={[s.dot, value != null && n < value && s.dotBelow, on && s.dotOn]}
            >
              <Text style={[font('footnote', 'semibold'), { color: on ? G.onPill : G.ink }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={s.scaleEnds}>
        <Text style={[font('caption1'), { color: G.body }]}>No pain</Text>
        <Text style={[font('caption1'), { color: G.body }]}>Worst imaginable</Text>
      </View>
    </View>
  );
}

export function Stepper({
  label,
  value,
  onEarlier,
  onLater,
  laterDisabled = false,
}: {
  label: string;
  value: string;
  onEarlier: () => void;
  onLater: () => void;
  laterDisabled?: boolean;
}) {
  return (
    <View style={s.stepper}>
      <Text style={[font('body'), { color: G.ink, flex: 1 }]}>{label}</Text>
      <Pressable onPress={onEarlier} accessibilityRole="button" accessibilityLabel={`${label}, earlier`} style={s.stepButton}>
        <Icon name="chevronLeft" size={18} color={G.ink} weight={2} />
      </Pressable>
      <Text style={[font('body', 'semibold'), s.stepValue]} accessibilityLiveRegion="polite">
        {value}
      </Text>
      <Pressable
        onPress={onLater}
        disabled={laterDisabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, later`}
        accessibilityState={{ disabled: laterDisabled }}
        style={[s.stepButton, laterDisabled && s.faded]}
      >
        <Icon name="chevronRight" size={18} color={G.ink} weight={2} />
      </Pressable>
    </View>
  );
}

export function BarRow({ label, count, max, color, unit = '' }: { label: string; count: number; max: number; color: string; unit?: string }) {
  return (
    <View style={s.bar} accessible accessibilityLabel={`${label}, ${count}${unit}`}>
      <View style={s.barHead}>
        <Text style={[font('subhead'), { color: G.ink }]}>{label}</Text>
        <Text style={[font('footnote'), { color: G.body }]}>
          {count}
          {unit}
        </Text>
      </View>
      <View style={s.track}>
        <View style={[s.trackFill, { width: `${max ? (count / max) * 100 : 0}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function ObservationCard({ observation }: { observation: Observation }) {
  const { watching, setWatching } = useCycle();
  const on = watching[observation.id] ?? true;
  return (
    <Panel style={s.observation}>
      <Text style={[font('body'), { color: C.text }]}>{observation.text}</Text>
      {observation.detail ? (
        <Text style={[font('subhead'), { color: C.secondary, marginTop: 6 }]}>{observation.detail}</Text>
      ) : null}
      {observation.context ? (
        <Text style={[font('subhead'), { color: C.secondary, marginTop: 6 }]}>{observation.context}</Text>
      ) : null}
      <View style={s.watchRow}>
        <Text style={[font('subhead'), { color: C.text, flex: 1 }]}>Keep watching this relationship</Text>
        <Switch
          value={on}
          onValueChange={(v) => setWatching(observation.id, v)}
          trackColor={{ false: C.fill, true: C.green }}
          ios_backgroundColor={C.fill}
          accessibilityLabel="Keep watching this relationship"
        />
      </View>
    </Panel>
  );
}

const s = StyleSheet.create({
  pressed: { opacity: 0.55 },
  faded: { opacity: 0.3 },

  header: { marginTop: 4, marginBottom: 16 },
  fieldLabel: { marginTop: 24, marginBottom: 10 },

  track: { height: 6, borderRadius: 3, backgroundColor: G.fill, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 3, backgroundColor: G.ink },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: L.recessed,
  },
  chipOn: { backgroundColor: 'rgba(242,149,122,0.16)', borderColor: C.tint },

  scale: { flexDirection: 'row', gap: 2 },
  dot: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 40,
    borderRadius: 20,
    backgroundColor: C.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotBelow: { backgroundColor: 'rgba(242,149,122,0.25)' },
  dotOn: { backgroundColor: G.ink },
  scaleEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: 16,
    marginTop: 8,
    borderRadius: RADIUS,
    backgroundColor: G.fill,
  },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: G.ink, minWidth: 116, textAlign: 'center' },


  bar: { gap: 6, paddingVertical: 8 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between' },

  observation: { marginBottom: 12 },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
  },
});
