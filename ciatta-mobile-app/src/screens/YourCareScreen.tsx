// Care team: visits, the care team, referrals and requests. In the corner
// menu rather than a place of its own beside Ciatta, since Ciatta is home.

import { ScrollView, StyleSheet, View } from 'react-native';

import { useNav } from '../navigation';
import { GUTTER } from '../theme';
import { CareHub } from '../ui/CareHub';
import { LargeTitle } from '../ui/chrome';
import { NAV_CLEARANCE } from '../ui/surface';

export function YourCareScreen() {
  const nav = useNav();
  return (
    <ScrollView style={y.fill} contentContainerStyle={y.body}>
      <LargeTitle title="Care team" />
      <View style={y.pad}>
        <CareHub onAsk={() => nav.push('ciatta')} />
      </View>
    </ScrollView>
  );
}

const y = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: NAV_CLEARANCE },
  pad: { paddingHorizontal: GUTTER, paddingTop: 4 },
});
