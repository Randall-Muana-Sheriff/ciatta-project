// Two pieces every lab screen uses: the status, as a shape and a word so it
// never relies on colour alone, and the range bar, the "visual line" display
// patients read lab values on best (Zikmund-Fisher et al., JMIR 2018): the
// lab's range shaded in the middle, her value marked where it falls.

import { StyleSheet, Text, View } from 'react-native';

import { type LabResult, labStatus, rangePosition, type StatusKey } from '../lib/labs';
import { font } from '../theme';
import { HUE, L } from './surface';
import { onGround } from './scheme';

const TEAL = onGround('#5ED3C4');

export const STATUS_COLOR: Record<StatusKey, string> = {
  inRange: TEAL,
  high: HUE.evidence,
  low: HUE.evidence,
  criticalHigh: HUE.escalation,
  criticalLow: HUE.escalation,
  abnormal: HUE.evidence,
  noRange: L.meta,
};

// A shape for each, so the status reads without colour.
const MARK: Record<StatusKey, string> = {
  inRange: '✓',
  high: '↑',
  low: '↓',
  criticalHigh: '⇈',
  criticalLow: '⇊',
  abnormal: '!',
  noRange: '○',
};

export function LabStatusTag({ result, small = false }: { result: LabResult; small?: boolean }) {
  const s = labStatus(result);
  const color = STATUS_COLOR[s.key];
  return (
    <View style={[t.tag, { borderColor: color }]} accessibilityLabel={s.label}>
      <Text style={[font(small ? 'caption2' : 'caption1', 'semibold'), { color }]}>{`${MARK[s.key]} ${s.label}`}</Text>
    </View>
  );
}

export function LabRangeBar({ result, height = 6, labels = false }: { result: LabResult; height?: number; labels?: boolean }) {
  const pos = rangePosition(result);
  if (!pos) return null;
  const s = labStatus(result);
  const dot = height + 6;
  return (
    <View accessible accessibilityLabel={`Range ${result.rangeText ?? ''}, value ${result.value ?? ''}`}>
      <View style={[t.track, { height, borderRadius: height / 2, marginVertical: (dot - height) / 2 }]}>
        <View style={[t.band, { left: `${pos.low * 100}%`, width: `${(pos.high - pos.low) * 100}%`, borderRadius: height / 2 }]} />
        <View
          style={[
            t.dot,
            { width: dot, height: dot, borderRadius: dot / 2, top: -(dot - height) / 2, left: `${pos.value * 100}%`, marginLeft: -dot / 2, backgroundColor: STATUS_COLOR[s.key] },
          ]}
        />
      </View>
      {labels ? (
        <View style={t.ends}>
          <Text style={[font('caption2'), t.end, { left: `${pos.low * 100}%` }]}>{result.low ?? ''}</Text>
          <Text style={[font('caption2'), t.end, { left: `${pos.high * 100}%` }]}>{result.high ?? ''}</Text>
        </View>
      ) : null}
    </View>
  );
}

const t = StyleSheet.create({
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  track: { backgroundColor: L.rule, position: 'relative' },
  band: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(94, 211, 196, 0.35)' },
  dot: { position: 'absolute', borderWidth: 2, borderColor: L.glass },
  ends: { height: 16, position: 'relative', marginTop: 2 },
  end: { position: 'absolute', color: L.meta, width: 40, marginLeft: -20, textAlign: 'center' },
});
