// A source's publisher, by its own mark: the logo where Ciatta has a clear
// one, a lettered badge where it does not. Shown for attribution only.

import { Image, StyleSheet, Text, View } from 'react-native';

import type { PublisherLogo as Logo } from '../lib/insights';
import { font } from '../theme';

const LOGOS: Partial<Record<Logo, number>> = {
  nice: require('../../assets/images/publishers/nice.png'),
  nih: require('../../assets/images/publishers/nih.png'),
  cmaj: require('../../assets/images/publishers/cmaj.png'),
  jmir: require('../../assets/images/publishers/jmir.png'),
  elsevier: require('../../assets/images/publishers/elsevier.png'),
  tandf: require('../../assets/images/publishers/tandf.png'),
  ata: require('../../assets/images/publishers/ata.png'),
  nhs: require('../../assets/images/publishers/nhs.png'),
};
const BADGE: Partial<Record<Logo, { text: string; color: string }>> = {
  aha: { text: 'AHA', color: '#C8102E' },
  degruyter: { text: 'DG', color: '#1F3B57' },
};

export function PublisherLogo({ logo, size = 22 }: { logo: Logo; size?: number }) {
  const src = LOGOS[logo];
  if (src) {
    return (
      <View style={[s.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image source={src} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
    );
  }
  const b = BADGE[logo] ?? { text: '·', color: '#5A5F6A' };
  return (
    <View style={[s.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: b.color }]}>
      <Text style={[font('caption2', 'semibold'), { color: '#FFFFFF', fontSize: size * 0.34 }]}>{b.text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
});
