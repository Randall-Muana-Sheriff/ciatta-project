// Every period product rule Ciatta uses, in its source's words, with the
// source named under each. The warning signs of toxic shock syndrome come
// first, because they are the ones that need acting on.

import { StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { RULES, TSS_SIGNS } from '../lib/productSafety';
import { useNav } from '../navigation';
import { font } from '../theme';
import { DetailScreen } from '../ui/kit';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';
import { G } from '../ui/scheme';

export function ProductSafetyScreen() {
  const nav = useNav();
  const tss = RULES.find((r) => r.id === 'tss')!;
  return (
    <DetailScreen title="Product Safety" onBack={nav.back}>
      <View style={s.urgent}>
        <Text style={[font('headline'), s.ink]}>Warning signs of toxic shock syndrome</Text>
        {TSS_SIGNS.map((t) => (
          <Text key={t.sign} style={[font('body'), s.ink]}>
            {displayCopy(t.sign)}
          </Text>
        ))}
        <Text style={[font('subhead', 'semibold'), s.ink, { marginTop: SPACE.tight }]}>
          With a tampon, cup or disc in, remove it and get medical care now.
        </Text>
        <Text style={[font('caption1'), s.meta]}>{tss.source}</Text>
      </View>

      {RULES.filter((r) => r.id !== 'tss').map((r) => (
        <View key={r.id} style={s.rule}>
          <Text style={[font('body'), s.ink]}>{displayCopy(r.text)}</Text>
          <Text style={[font('caption1'), s.meta]}>{r.source}</Text>
        </View>
      ))}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  urgent: {
    gap: 4,
    padding: 16,
    borderRadius: TILE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EC5D4A',
    backgroundColor: 'rgba(236, 93, 74, 0.10)',
    marginBottom: SPACE.block,
  },
  rule: { gap: 4, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: G.rule },
  ink: { color: G.ink, lineHeight: 22 },
  meta: { color: G.meta },
});
