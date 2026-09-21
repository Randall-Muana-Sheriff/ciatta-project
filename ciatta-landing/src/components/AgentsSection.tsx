/**
 * Health Agents, and the Provider View.
 *
 * Care does the work a woman is currently doing herself. An agent is the next
 * step: it watches one thing continuously, against a goal she set, and says
 * something before she thinks to ask.
 *
 * Two of the lines this arrived with are not written here as they arrived,
 * and the reasons are the product's own:
 *
 *   · An agent does not spot depression. Naming a condition is a clinician's
 *     job, and the questions page already promises Ciatta does not do it,
 *     suggest it, or hint at it. So the agent surfaces the change and how
 *     long it has held, which is the useful half, and the half that is true.
 *
 *   · A nudge does not promise a result by a date. "Should bring it back
 *     inside 7 days" is a clinical outcome on a deadline; what Ciatta can
 *     honestly offer is the thing to try and the undertaking to show her
 *     what happened. Every figure in the example is kept.
 *
 * Both agents say Coming soon, because they are.
 */

type Agent = {
  key: string;
  name: string;
  claim: string;
  body: string;
  does: string[];
  nudge: string;
};

const TRAITS: [string, string][] = [
  ['Proactive',
   'Surfaces patterns and risks before you think to ask. No waiting for the right question.'],
  ['Specialized',
   'Deep domain expertise per condition. Each agent is tuned for one health outcome rather than being a generalist.'],
  ['Goal-oriented',
   'Tracks progress against the outcome you set, and adjusts as your data changes.'],
];

const AGENTS: Agent[] = [
  {
    key: 'mind',
    name: 'Mental Wellbeing Agent',
    claim: 'An agent that watches how you are doing, not just what you logged.',
    body: 'Continuously connects sleep, activity and mood to surface changes early, and to show how long they have held rather than waiting for you to notice them yourself.',
    does: [
      'Mood and energy patterns across days and weeks',
      'Sleep, mood and activity read against each other',
      'Small things to try: breathwork, a walk, a journalling prompt',
      'A weekly summary you can take to your own clinician',
    ],
    nudge: 'Your mood scores dropped 18% this week and your sleep is 40 minutes shorter than your usual. Three Mondays in a row now. Shall we plan a Monday-morning reset before next week?',
  },
  {
    key: 'glucose',
    name: 'Diabetes Care Agent',
    claim: 'A specialized agent that helps you take charge of your glucose.',
    body: 'Brings CGM, lab markers, meals, activity and medication into one continuous picture, and gives you specific, evidence-based things to try for your HbA1c and your time in range.',
    does: [
      'HbA1c trajectory, with the trend it is on',
      'Meal-timing and carb patterns, from your own data',
      'Activity tuned to your own post-meal glucose response',
      'Medication reminders, and endocrinologist-ready summaries',
    ],
    nudge: 'Your fasting glucose has crept up 8 mg/dL since you shifted dinner past 9pm last week. Here is a 15-minute after-dinner walk to try, and Ciatta will show you what happens over the next week.',
  },
];

const PROVIDER: [string, string][] = [
  ['Pre-visit briefings',
   'A one-page summary before each appointment: what has changed since the last visit, what the agents flagged, and the markers relevant to today’s topic.'],
  ['Between-visit watch lists',
   'Be notified when a patient’s trajectory shifts, such as declining sleep, rising glucose or missed medication, long before the next scheduled visit.'],
  ['Exports for the chart',
   'A clinician-friendly PDF for the chart and a structured export for the EHR. Generated on demand, formatted for a thirty-second scan.'],
  ['Patient-controlled access',
   'The patient grants access, scopes what you see, sets how long it lasts, and revokes it in one click. Every view is audit-logged.'],
];

export function AgentsSection() {
  return (
    <>
      {/* ---- the agents ------------------------------------------------- */}
      <section className="m-band is-alt" aria-labelledby="agents-heading">
        <div className="m-wrap">
          <div className="band-head">
            <span className="m-eyebrow is-ink">Health Agents</span>
            <h2 className="m-h2" id="agents-heading">
              From answering questions to taking action
            </h2>
            <p className="m-h2-sub">
              Agents bring together every signal you generate, look for patterns
              across weeks and months, and work towards the goal you set. The
              next chapter of Ciatta, starting with two areas of real unmet
              need.
            </p>
          </div>

          <ul className="ag-traits">
            {TRAITS.map(([name, line]) => (
              <li key={name}>
                <h3>{name}</h3>
                <p>{line}</p>
              </li>
            ))}
          </ul>

          <div className="ag-grid">
            {AGENTS.map((a) => (
              <article className="ag-card" key={a.key}>
                <header className="ag-card-head">
                  <span className="ag-kind">Specialized health agent</span>
                  <span className="ag-soon">Coming soon</span>
                </header>
                <h3 className="ag-name">{a.name}</h3>
                <p className="ag-claim">{a.claim}</p>
                <p className="ag-body">{a.body}</p>

                <ul className="ag-does">
                  {a.does.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>

                <figure className="ag-nudge">
                  <figcaption>A typical proactive nudge</figcaption>
                  <blockquote>{a.nudge}</blockquote>
                </figure>
              </article>
            ))}
          </div>

          <p className="ag-foot">
            An agent observes, and suggests. It does not diagnose, name a
            condition, or promise a result by a date, and nothing it suggests
            replaces your clinician.
          </p>
        </div>
      </section>

      {/* ---- the provider view ------------------------------------------ */}
      <section className="m-band" aria-labelledby="provider-heading">
        <div className="m-wrap">
          <div className="band-head">
            <span className="m-eyebrow is-ink">Early access · Provider View</span>
            <h2 className="m-h2" id="provider-heading">
              The same record, rendered for the consult room
            </h2>
            <p className="m-h2-sub">
              A view of any patient who grants you access: pre-visit summaries,
              between-visit watch lists, and exports for the chart. The data and
              the agents are the same ones the patient sees. Only the surface
              changes.
            </p>
          </div>

          <dl className="m-care-list is-wide">
            {PROVIDER.map(([name, line]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{line}</dd>
              </div>
            ))}
          </dl>

          <p className="m-care-rule">
            The patient holds the key throughout. Access is granted by her,
            limited to what she chooses and for as long as she chooses, and she
            can withdraw it at any time.
          </p>
        </div>
      </section>
    </>
  );
}
