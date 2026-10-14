// The last thing that happened in her record, at the foot of Today: one
// line, replaced by the next as it happens. The history is not kept on
// screen; the record is where it lives.

import { StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { useCareHub } from '../state/careHub';
import { font } from '../theme';
import { Icon, type IconName } from './icons';
import { L, TILE_RADIUS } from './surface';
import { CardFill } from './cardFill';
import { SectionHeading } from './kit';

export function LatestActivity() {
  const latest = useCareHub().activity[0];
  if (!latest) return null;
  return (
    <View>
    <SectionHeading title="Latest activity" />
    <View style={s.row} accessible accessibilityLabel={`Latest activity: ${latest.title}, ${latest.when}`}>
      <CardFill />
      <View style={s.icon}>
        <Icon name={latest.icon as IconName} size={15} color={L.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[font('subhead'), s.ink]} numberOfLines={2}>
          {displayCopy(latest.title)}
        </Text>
      </View>
      <Text style={[font('caption1'), s.meta]}>{latest.when}</Text>
    </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
  },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: L.statement },
  ink: { color: L.ink },
  meta: { color: L.meta },
});
