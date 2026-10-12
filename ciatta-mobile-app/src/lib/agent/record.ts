// Assembling what the agent is allowed to read.
//
// This was inline in CareScreen and should not have been. The mapping from
// the app's state to the agent's Record is where a capability silently
// starts answering from the wrong field, and a mapping inside a component
// cannot be tested.
//
// It earned its own file immediately. The first version passed
// profile.situations as her conditions, and situations includes Regular
// and Irregular, so Ask would have asked her doctor about "how you are
// managing Irregular". A cycle pattern is not something anyone manages,
// and the two lists only looked alike.

import type { Day } from '../../data/daily';
import type { Episode } from '../../data/cycleLog';
import type { Reported } from '../../data/repo';
import type { Insight } from '../engine';
import type { Record as AgentRecord } from './capabilities';

export type Sources = {
  name: string | null;
  today: Day | null;
  days: readonly Day[];
  episodes: readonly Episode[];
  // What she told Ciatta at onboarding, read from the profile. Null while
  // the read is in flight, which is a different thing from an empty record
  // and must not be turned into one.
  reported: Reported | null;
  // Already ranked and already gated. The agent never ranks or finds.
  insights: readonly Insight[];
  references: AgentRecord['references'];
  cycleDay: number | null;
  cyclePhase: string | null;
  // What her hospitals sent, already read from clinical_records.
  clinical: AgentRecord['clinical'];
};

// How many insights the agent will speak about at once. The ranked list can
// run long, and an agent that recites nine findings is an agent nobody
// reads to the end of.
const SPEAK = 3;

export function buildRecord(src: Sources): AgentRecord {
  return {
    name: src.name,
    today: src.today,
    days: src.days,
    episodes: src.episodes,

    // Conditions are what she said she is managing, and nothing else.
    // Not cycle situations: those describe her cycle, not her health, and
    // Regular is not a thing to raise with a doctor.
    conditions: src.reported?.conditions ?? [],

    // Medicines and supplements together, because the question Ask builds
    // from them is the same question for both: whether this is still the
    // right thing to be taking. Supplements interact and get left off
    // lists, which is a reason to include them rather than to split them.
    medications: [...(src.reported?.medications ?? []), ...(src.reported?.supplements ?? [])],

    insights: src.insights.slice(0, SPEAK).map((i) => ({
      title: i.title,
      whatChanged: i.brief,
      // Carried, always. An insight quoted without what it does not show
      // is the insight quietly becoming a claim.
      notEstablished: i.evidence.notEstablished,
    })),

    references: src.references,
    cycleDay: src.cycleDay,
    cyclePhase: src.cyclePhase,
    clinical: src.clinical,
  };
}
