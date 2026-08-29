import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts, type } from '../theme/tokens';
import BottomSheet from '../components/BottomSheet';
import type { UnderstandingRow } from '../lib/queries';

export default function TodayInfoSheet({
  visible,
  understandings,
  onClose,
}: {
  visible: boolean;
  understandings: UnderstandingRow[];
  onClose: () => void;
}) {
  const formed = understandings.length;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPct={0.7}>
      <Text style={styles.title}>Where this comes from.</Text>

      <Text style={styles.body}>
        Everything on this screen is drawn from what you've shared and what
        your devices have recorded, never from averages for people like you.
      </Text>

      {formed > 0 ? (
        <Text style={styles.body}>
          The sentence at the center is what Ciatta understands right now, from
          the Understanding that changed most recently.
        </Text>
      ) : (
        <Text style={styles.body}>
          When there is enough to notice, a sentence will sit at the center of
          this screen.
        </Text>
      )}

      <Text style={styles.body}>
        Why opens the evidence behind that sentence, including the readings that
        explain it. Core is the longer picture of you, not a dashboard of
        numbers.
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    ...type.title2,
    color: colors.ink,
    marginBottom: 16,
  },
  body: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.ink2,
    marginBottom: 16,
  },
});
