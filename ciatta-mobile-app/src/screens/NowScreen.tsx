import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, type } from '../theme/tokens';
import ScreenContainer from '../components/ScreenContainer';
import EditorialHeader from '../components/EditorialHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import GhostButton from '../components/GhostButton';
import { displayCopy } from '../lib/displayCopy';
import type { NowComposition } from '../lib/nowComposition';

export default function NowScreen({
  composition,
  receipt,
  onAdd,
  onConnectCare,
}: {
  composition: NowComposition;
  receipt: string | null;
  onAdd: () => void;
  onConnectCare: () => void;
}) {
  return (
    <ScreenContainer>
      <EditorialHeader title={displayCopy('Now')} subtitle={displayCopy('What to pay attention to.')} />
      {receipt ? (
        <View style={styles.receipt}>
          <Text style={styles.receiptText}>{displayCopy(receipt)}</Text>
        </View>
      ) : null}

      {composition.kind === 'building' ? (
        <Card>
          <Text style={styles.kicker}>{displayCopy('Building')}</Text>
          <Text style={styles.lead}>{composition.buildingHas}</Text>
          <Text style={styles.body}>{composition.buildingMissing}</Text>
        </Card>
      ) : null}

      {composition.kind === 'quiet' ? (
        <Card>
          <Text style={styles.kicker}>{displayCopy('Nothing to surface')}</Text>
          <Text style={styles.lead}>{composition.quietMessage}</Text>
        </Card>
      ) : null}

      {composition.kind === 'surfaced' && composition.change ? (
        <View style={styles.stack}>
          <Card>
            <Text style={styles.kicker}>{displayCopy('Change')}</Text>
            <Text style={styles.lead}>{composition.change.statement}</Text>
            <Text style={styles.body}>{composition.change.comparedWith}</Text>
            <Text style={styles.body}>{composition.change.period}</Text>
            {composition.change.observed ? (
              <Text style={styles.observed}>{composition.change.observed}</Text>
            ) : null}
          </Card>

          {composition.pattern ? (
            <Card>
              <Text style={styles.kicker}>{displayCopy('What kept happening')}</Text>
              <Text style={styles.body}>{composition.pattern}</Text>
            </Card>
          ) : null}

          {composition.context ? (
            <Card>
              <Text style={styles.kicker}>{displayCopy('Context')}</Text>
              <Text style={styles.body}>{composition.context.observed}</Text>
              <Text style={[styles.body, styles.gap]}>{composition.context.interpretation}</Text>
              <Text style={[styles.body, styles.gap]}>{composition.context.limits}</Text>
              <Text style={[styles.body, styles.gap]}>{composition.context.doesNotMean}</Text>
            </Card>
          ) : null}

          {composition.action ? (
            <Card>
              <Text style={styles.kicker}>{displayCopy('You could consider')}</Text>
              <Text style={styles.body}>{displayCopy('Pay attention to this over the next nights.')}</Text>
              <Text style={[styles.body, styles.gap]}>{displayCopy('Gather more by adding what you notice.')}</Text>
              <Text style={[styles.body, styles.gap]}>
                {displayCopy('A question you could bring: Could we look at how this compares with my usual?')}
              </Text>
              {composition.action.guidance ? (
                <Text style={[styles.body, styles.gap]}>{composition.action.guidance}</Text>
              ) : null}
              {composition.action.careEligible ? (
                <GhostButton label={displayCopy('Connect to care')} onPress={onConnectCare} tone="ink" />
              ) : null}
            </Card>
          ) : null}
        </View>
      ) : null}

      {composition.userNote ? (
        <Card style={styles.noteCard}>
          <Text style={styles.kicker}>{displayCopy('From you')}</Text>
          <Text style={styles.body}>{composition.userNote}</Text>
          <Text style={styles.fine}>{displayCopy('This is what you added. It is not a Ciatta finding.')}</Text>
        </Card>
      ) : null}

      <View style={styles.addWrap}>
        <PrimaryButton label={displayCopy('Add')} onPress={onAdd} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  kicker: {
    ...type.caption1,
    color: colors.ink3,
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  lead: {
    ...type.title3,
    color: colors.ink,
  },
  body: {
    ...fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink2,
    marginTop: 8,
  },
  observed: {
    ...fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    marginTop: 10,
  },
  gap: { marginTop: 10 },
  fine: {
    ...type.footnote,
    color: colors.ink3,
    marginTop: 8,
  },
  receipt: {
    borderWidth: 1,
    borderColor: colors.ink,
    padding: 12,
    marginBottom: 16,
  },
  receiptText: {
    ...fonts.sans,
    fontSize: 14,
    color: colors.ink,
  },
  noteCard: { marginTop: 12 },
  addWrap: { marginTop: 24 },
});
