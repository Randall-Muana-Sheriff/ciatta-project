import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

export default function ConfidenceBar({
  label,
}: {
  label?: string;
  /** Ignored. Kept so existing call sites compile while percents are gone. */
  value?: number;
  showEndpoints?: boolean;
}) {
  const width = fillForLabel(label);
  return (
    <View style={{ marginTop: 18 }}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>HOW THIS IS HELD</Text>
        {label ? <Text style={styles.status}>{label}</Text> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${width}%` }]} />
      </View>
    </View>
  );
}

function fillForLabel(label: string | undefined): number {
  const raw = (label ?? '').toLowerCase();
  if (raw.includes('very confident')) return 90;
  if (raw.includes('fairly confident')) return 50;
  if (raw.includes('still learning')) return 22;
  if (raw.includes('confident')) return 72;
  return 40;
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    ...fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
  },
  status: {
    ...fonts.sansMedium,
    fontSize: 13,
    color: colors.evidence,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.evidence,
    borderRadius: 3,
  },
});
