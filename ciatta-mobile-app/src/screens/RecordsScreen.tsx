// Records: labs, documents and provider records, a place of its own in the
// corner menu rather than a half of Health.

import { ScrollView, StyleSheet, View } from 'react-native';

import { useNav } from '../navigation';
import { GUTTER } from '../theme';
import { LargeTitle } from '../ui/chrome';
import { RecordsView } from '../ui/RecordsView';
import { NAV_CLEARANCE } from '../ui/surface';

export function RecordsScreen() {
  const nav = useNav();
  return (
    <ScrollView style={r.fill} contentContainerStyle={r.body}>
      <LargeTitle title="Records" />
      <View style={r.pad}>
        <RecordsView onOpen={nav.push} />
      </View>
    </ScrollView>
  );
}

const r = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: NAV_CLEARANCE },
  pad: { paddingHorizontal: GUTTER, paddingTop: 4 },
});
