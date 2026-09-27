// Reads Apple Health again when the app comes to the front. The rule for
// when, and how far back, is planRefresh in src/lib/healthRefresh.ts and
// is proven there; the rule for whose source may be read without asking is
// readsOnItsOwn in src/lib/connectSource.ts. This file only carries them
// out on a phone, and like healthKit.ts has nothing in it to unit test.
import type { Repo } from '../data/repo';
import { planRefresh, recordRefresh } from '../lib/healthRefresh';
import { healthKitAnchors, healthKitPort, isHealthAvailable } from '../lib/healthKit';
import { runHealthSync } from '../lib/healthSync';

// True when a read was made and went through, so the caller knows her
// record may now hold more than the screens are showing. It never asks for
// access: a phone she has not given access on answers every query with
// nothing, and nothing is what is sent.
export async function refreshAppleHealth(userId: string, repo: Repo): Promise<boolean> {
  if (!(await isHealthAvailable())) return false;
  if (!(await repo.appleHealthConnected())) return false;

  const now = new Date();
  const mode = await planRefresh(userId, healthKitAnchors, now);
  if (!mode) return false;

  const result = await runHealthSync(userId, { port: healthKitPort, anchors: healthKitAnchors, mode });
  // A read that did not get through whole is left unrecorded, so the next
  // time the app comes to the front it is made again. The source's status
  // is left as it was: a train tunnel is not something to tell her about.
  if (result.failed.length > 0) return result.observations > 0;

  await recordRefresh(userId, healthKitAnchors, mode, now);
  await repo.saveSourceStatus('apple_health', 'active', now.toISOString());
  return true;
}
