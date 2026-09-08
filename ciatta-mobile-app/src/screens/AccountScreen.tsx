import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import ScreenContainer from '../components/ScreenContainer';
import EditorialHeader from '../components/EditorialHeader';
import DisclosureRow from '../components/DisclosureRow';
import GhostButton from '../components/GhostButton';
import { displayCopy } from '../lib/displayCopy';
import { Platform } from 'react-native';

export default function AccountScreen({
  healthSourceConnected,
  onOpenSources,
  onOpenPrivacy,
  onSignOut,
}: {
  healthSourceConnected: boolean;
  onOpenSources: () => void;
  onOpenPrivacy: () => void;
  onSignOut: () => void;
}) {
  const sourceName = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';
  return (
    <ScreenContainer grouped>
      <EditorialHeader
        title={displayCopy('Account')}
        subtitle={displayCopy('What you share and control.')}
      />
      <View style={styles.group}>
        <DisclosureRow
          label={displayCopy('Sources')}
          value={displayCopy(healthSourceConnected ? `${sourceName} connected` : 'Not connected')}
          onPress={onOpenSources}
        />
        <DisclosureRow label={displayCopy('Privacy')} value={displayCopy('Export and delete')} onPress={onOpenPrivacy} />
      </View>
      <Text style={styles.footer}>
        {displayCopy('Account is not where Ciatta interprets your health.')}
      </Text>
      <GhostButton label={displayCopy('Sign out')} onPress={onSignOut} tone="ink" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  footer: {
    ...fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink3,
    marginTop: 12,
    marginBottom: 20,
  },
});
