// "View by Day", the window picker Journey opens with, shared so a metric's
// own screen reads its timeline the same way: Day, Week, Month, Year, as a
// dropdown rather than four fixed spans.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Scale, SCALES } from '../lib/timeAxis';
import { C, font } from '../theme';
import { Icon } from './icons';
import { L, TILE_RADIUS } from './surface';
import { G } from './scheme';

export function ViewByPicker({ scale, onChange }: { scale: Scale; onChange: (scale: Scale) => void }) {
  const [open, setOpen] = useState(false);
  const label = SCALES.find((v) => v.key === scale)?.label;
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`View by ${label}`}
        style={s.picker}
      >
        <Text style={[font('subhead', 'semibold'), { color: G.ink }]}>View by {label}</Text>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} color={G.body} />
      </Pressable>
      {open ? (
        <View style={s.menu}>
          {SCALES.map((v) => (
            <Pressable
              key={v.key}
              onPress={() => {
                onChange(v.key);
                setOpen(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: v.key === scale }}
              style={s.item}
            >
              <Text style={[font('subhead', v.key === scale ? 'semibold' : 'regular'), { color: C.text }]}>{v.label}</Text>
              {v.key === scale ? <Icon name="check" size={16} color={C.text} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: TILE_RADIUS,
    backgroundColor: G.fill,
    overflow: 'hidden',
  },
  menu: {
    marginTop: 6,
    borderRadius: TILE_RADIUS,
    backgroundColor: L.field,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 14,
  },
});
