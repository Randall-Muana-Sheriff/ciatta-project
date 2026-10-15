// Every Explore health topic, two to a row.

import { StyleSheet, View } from 'react-native';

import { EXPLORE_TOPICS } from '../lib/exploreHealth';
import { useNav } from '../navigation';
import { TopicTile } from '../ui/ExploreHealthRow';
import { DetailScreen } from '../ui/kit';

export function ExploreAllScreen() {
  const nav = useNav();
  return (
    <DetailScreen title="Explore" onBack={nav.back}>
      <View style={a.grid}>
        {EXPLORE_TOPICS.map((t) => (
          <TopicTile key={t.key} topicKey={t.key} label={t.label} wide />
        ))}
      </View>
    </DetailScreen>
  );
}

const a = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
});
