import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';

import { LOCATION_GROUPS } from '../data/cycleLog';
import { C, font } from '../theme';
import { ChoiceChips, FieldLabel, RemovableChips } from './cycleInputs';
import { LinkButton, SegmentedControl } from './kit';

// A quiet outline of a body, not an anatomical drawing. Tap regions to mark
// where pain was felt; everything is also reachable from the list, which is
// what VoiceOver uses.

type Region = { location: string; shape: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number; r?: number };

// Front view: the person faces you, so their left side is on your right.
const FRONT: Region[] = [
  { location: 'Right shoulder', shape: 'ellipse', x: 58, y: 84, w: 16, h: 12 },
  { location: 'Left shoulder', shape: 'ellipse', x: 142, y: 84, w: 16, h: 12 },
  { location: 'Chest', shape: 'rect', x: 72, y: 72, w: 56, h: 32 },
  { location: 'Upper abdomen', shape: 'rect', x: 74, y: 106, w: 52, h: 20 },
  { location: 'Right abdomen', shape: 'rect', x: 68, y: 128, w: 20, h: 34 },
  { location: 'Center abdomen', shape: 'rect', x: 90, y: 128, w: 20, h: 34 },
  { location: 'Left abdomen', shape: 'rect', x: 112, y: 128, w: 20, h: 34 },
  { location: 'Lower abdomen', shape: 'rect', x: 72, y: 164, w: 56, h: 20 },
  { location: 'Right pelvis', shape: 'rect', x: 64, y: 186, w: 16, h: 28 },
  { location: 'Pelvis', shape: 'rect', x: 82, y: 186, w: 36, h: 20 },
  { location: 'Left pelvis', shape: 'rect', x: 120, y: 186, w: 16, h: 28 },
  { location: 'Lower pelvis', shape: 'rect', x: 84, y: 208, w: 32, h: 16 },
  { location: 'Right hip', shape: 'ellipse', x: 58, y: 214, w: 9, h: 14 },
  { location: 'Left hip', shape: 'ellipse', x: 142, y: 214, w: 9, h: 14 },
  { location: 'Right leg', shape: 'rect', x: 68, y: 238, w: 30, h: 180, r: 15 },
  { location: 'Left leg', shape: 'rect', x: 102, y: 238, w: 30, h: 180, r: 15 },
];

// Back view: seen from behind, their left side is on your left.
const BACK: Region[] = [
  { location: 'Left shoulder', shape: 'ellipse', x: 58, y: 84, w: 16, h: 12 },
  { location: 'Right shoulder', shape: 'ellipse', x: 142, y: 84, w: 16, h: 12 },
  { location: 'Upper back', shape: 'rect', x: 72, y: 72, w: 56, h: 36 },
  { location: 'Middle back', shape: 'rect', x: 72, y: 110, w: 56, h: 34 },
  { location: 'Lower back', shape: 'rect', x: 72, y: 146, w: 56, h: 34 },
  { location: 'Buttocks', shape: 'rect', x: 68, y: 186, w: 64, h: 42, r: 18 },
  { location: 'Left hip', shape: 'ellipse', x: 58, y: 206, w: 9, h: 14 },
  { location: 'Right hip', shape: 'ellipse', x: 142, y: 206, w: 9, h: 14 },
  { location: 'Left leg', shape: 'rect', x: 68, y: 238, w: 30, h: 180, r: 15 },
  { location: 'Right leg', shape: 'rect', x: 102, y: 238, w: 30, h: 180, r: 15 },
];

const SIDES = ['Front', 'Back'] as const;

function Silhouette() {
  const body = { fill: C.card, stroke: C.border, strokeWidth: 1.5 };
  return (
    <>
      <Circle cx={100} cy={36} r={22} {...body} />
      <Rect x={92} y={56} width={16} height={12} rx={4} {...body} />
      <Rect x={40} y={74} width={20} height={150} rx={10} {...body} />
      <Rect x={140} y={74} width={20} height={150} rx={10} {...body} />
      <Rect x={68} y={226} width={30} height={196} rx={15} {...body} />
      <Rect x={102} y={226} width={30} height={196} rx={15} {...body} />
      <Rect x={64} y={170} width={72} height={66} rx={26} {...body} />
      <Rect x={66} y={66} width={68} height={118} rx={24} {...body} />
    </>
  );
}

export function BodyMap({ selected, onToggle }: { selected: string[]; onToggle: (location: string) => void }) {
  const [side, setSide] = useState<(typeof SIDES)[number]>('Front');
  const [list, setList] = useState(false);
  const regions = side === 'Front' ? FRONT : BACK;

  return (
    <View>
      <SegmentedControl segments={SIDES} active={side} onChange={setSide} style={{ marginBottom: 12 }} />
      <View style={s.map} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height="100%" viewBox="0 0 200 430">
          <Silhouette />
          {regions.map((r) => {
            const on = selected.includes(r.location);
            const paint = {
              fill: on ? C.coral : C.white,
              fillOpacity: on ? 0.7 : 0.001,
              stroke: on ? C.coral : C.tertiary,
              strokeWidth: 1,
              onPress: () => onToggle(r.location),
            };
            return r.shape === 'ellipse' ? (
              <Ellipse key={r.location} cx={r.x} cy={r.y} rx={r.w} ry={r.h} {...paint} />
            ) : (
              <Rect key={r.location} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.r ?? 8} {...paint} />
            );
          })}
        </Svg>
      </View>
      <Text style={[font('footnote'), s.caption]}>
        {side === 'Front' ? 'Front view: your left side is on the right.' : 'Back view: your left side is on the left.'}
      </Text>

      <FieldLabel hint={selected.length ? 'Tap a location to remove it.' : 'Tap where you felt it. You can choose more than one.'}>
        {selected.length ? 'Selected' : 'Nothing selected yet'}
      </FieldLabel>
      {selected.length ? <RemovableChips items={selected} onRemove={onToggle} /> : null}
      <View style={{ marginTop: 12 }}>
        <ChoiceChips options={['Whole body', 'Both legs', 'Other']} selected={selected} onToggle={onToggle} />
      </View>

      <LinkButton label={list ? 'Hide the list' : 'Choose from a list'} onPress={() => setList((v) => !v)} />
      {list
        ? LOCATION_GROUPS.map((g) => (
            <View key={g.group}>
              <FieldLabel>{g.group}</FieldLabel>
              <ChoiceChips options={g.items} selected={selected} onToggle={onToggle} />
            </View>
          ))
        : null}
    </View>
  );
}

const s = StyleSheet.create({
  map: { height: 340, alignItems: 'center' },
  caption: { color: C.secondary, textAlign: 'center', marginTop: 6 },
});
