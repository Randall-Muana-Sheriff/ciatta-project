// The referrals she is tracking: where each one is, and which have stalled.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { chooseReferral } from '../lib/agent/handoff';
import { displayCopy } from '../lib/displayCopy';
import { currentStep, type Referral, stalled } from '../lib/referrals';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { ListGroup, ListRow } from '../ui/chrome';
import { DetailScreen, EmptyNote, PrimaryButton } from '../ui/kit';
import { L, SPACE } from '../ui/surface';
import { G } from '../ui/scheme';

export function ReferralsScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [list, setList] = useState<Referral[] | null>(null);
  useEffect(() => {
    if (nav.depth > 1 && list) return;
    repo.loadReferrals().then(setList).catch(() => setList([]));
    // Read again when she comes back from one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, nav.depth]);
  const now = new Date();

  return (
    <DetailScreen title="Referrals" onBack={nav.back}>
      <Text style={[font('body'), { color: G.ink, lineHeight: 24, marginBottom: SPACE.near }]}>
        From referred to seen, one step at a time. Ciatta prepares each step; you make the calls.
      </Text>
      {list && !list.length ? <EmptyNote text="No referrals yet." /> : null}
      {list?.length ? (
        <ListGroup>
          {list.map((r, n) => {
            const step = currentStep(r);
            const days = stalled(r, now);
            return (
              <ListRow
                key={r.id}
                first={n === 0}
                icon="stethoscope"
                title={r.specialty}
                sub={displayCopy(step ? `Next: ${step.label.toLowerCase()}${days ? ` · waiting ${days} days` : ''}` : 'Seen')}
                onPress={() => {
                  chooseReferral(r.id);
                  nav.push('referral');
                }}
              />
            );
          })}
        </ListGroup>
      ) : null}
      <View style={{ marginTop: SPACE.block }}>
        <PrimaryButton
          label="Track a Referral"
          onPress={() => {
            chooseReferral(null);
            nav.push('referral');
          }}
        />
      </View>
    </DetailScreen>
  );
}
