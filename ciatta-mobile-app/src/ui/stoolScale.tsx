import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { STOOL_TYPES } from '../data/cycleLog';
import { displayCopy } from '../lib/displayCopy';
import { C, font, RADIUS } from '../theme';

// Simple line pictures for the seven stool types, drawn in one weight.
function Picture({ type, color }: { type: number; color: string }) {
  const line = { stroke: color, strokeWidth: 1.5, fill: 'none' } as const;
  return (
    <Svg width={44} height={24} viewBox="0 0 44 24">
      {type === 1 ? [8, 17, 27, 36].map((cx, i) => <Circle key={cx} cx={cx} cy={i % 2 ? 9 : 15} r={3.5} {...line} />) : null}
      {type === 2 ? (
        <Path d="M6 12a5 5 0 0 1 8-4a5 5 0 0 1 8 0a5 5 0 0 1 8 0a5 5 0 0 1 8 4a5 5 0 0 1-8 4a5 5 0 0 1-8 0a5 5 0 0 1-8 0a5 5 0 0 1-8-4z" {...line} />
      ) : null}
      {type === 3 ? (
        <>
          <Rect x={4} y={7} width={36} height={10} rx={5} {...line} />
          <Path d="M14 7v3M22 17v-3M30 7v3" {...line} />
        </>
      ) : null}
      {type === 4 ? <Rect x={4} y={7} width={36} height={10} rx={5} {...line} /> : null}
      {type === 5 ? [10, 22, 34].map((cx) => <Ellipse key={cx} cx={cx} cy={12} rx={5} ry={4} {...line} />) : null}
      {type === 6 ? <Path d="M5 14c2-5 5-2 7-5s5 3 8 0 5-2 7 1 6-2 8 2-2 5-6 4-6 2-10 1-8 1-12-1-5-1-2-3z" {...line} /> : null}
      {type === 7 ? <Path d="M4 10c4-3 8 3 12 0s8 3 12 0 8 3 12 0M4 16c4-3 8 3 12 0s8 3 12 0 8 3 12 0" {...line} /> : null}
    </Svg>
  );
}

export function StoolScale({ value, onChange }: { value: number | null; onChange: (type: number) => void }) {
  return (
    <View style={s.list}>
      {STOOL_TYPES.map(({ type, word }) => {
        const on = value === type;
        return (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Type ${type}, ${displayCopy(word)}`}
            style={[s.row, on && s.on]}
          >
            <Picture type={type} color={on ? C.text : C.secondary} />
            <Text style={[font('subhead', on ? 'semibold' : 'regular'), { color: on ? C.text : C.secondary, flex: 1 }]}>{displayCopy(word)}</Text>
            <Text style={[font('footnote'), { color: C.secondary }]}>Type {type}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: RADIUS, backgroundColor: C.card },
  on: { backgroundColor: C.cardHi },
});
