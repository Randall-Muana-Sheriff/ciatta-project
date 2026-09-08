import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii, type } from '../theme/tokens';
import BottomSheet from '../components/BottomSheet';
import PrimaryButton from '../components/PrimaryButton';
import GhostButton from '../components/GhostButton';
import { displayCopy } from '../lib/displayCopy';
import { CloseIcon } from '../components/icons';
import { Pressable } from 'react-native';

export default function AddObservationSheet({
  visible,
  saving,
  error,
  onClose,
  onSave,
}: {
  visible: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState('');

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.head}>
        <Text style={styles.title}>{displayCopy('What should Ciatta know?')}</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={displayCopy('Close')}>
          <CloseIcon />
        </Pressable>
      </View>
      <Text style={styles.sub}>
        {displayCopy('This is Observe Again. Saving does not create a finding by itself.')}
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={displayCopy('Last night I slept less and felt low.')}
        placeholderTextColor={colors.ink3}
        style={styles.input}
        multiline
      />
      {error ? <Text style={styles.error}>{displayCopy(error)}</Text> : null}
      <PrimaryButton
        label={displayCopy('Save')}
        loading={saving}
        disabled={!text.trim()}
        onPress={() => onSave(displayCopy(text.trim()))}
      />
      <GhostButton label={displayCopy('Cancel')} onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    ...type.title2,
    color: colors.ink,
    flex: 1,
    paddingRight: 12,
  },
  sub: {
    ...fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink2,
    marginBottom: 12,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    ...fonts.sans,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  error: {
    ...type.footnote,
    color: colors.accent,
    marginBottom: 8,
  },
});
