/**
 * "Bring the story with you."
 *
 * The health brief: six months of her record as one page, in the registers
 * the product already uses. It is set as a document on White rather than as
 * the dark product panel, because that is what it becomes the moment it is
 * printed or handed across a desk.
 */

const BRIEF: [string, string[]][] = [
  ['What changed', ['Symptoms increased over 6 weeks.']],
  ['What was happening around it', [
    'Sleep decreased.',
    'Medication changed on 3 Mar.',
    'Cycle shortened by three days.',
  ]],
  ['What you tried', [
    'A 7-day sleep experiment, from 10 Mar.',
    'Earlier wind-down on 5 of 7 nights.',
  ]],
  ['What happened next', [
    'Sleep returned closer to your usual on 5 of 7 nights.',
    'Fatigue was reported less often.',
  ]],
  ['Questions to discuss', [
    'Could the sleep and cycle changes be worth evaluating together?',
    'Is the ferritin trend worth repeating?',
  ]],
];

export function BriefSection() {
  return (
    <section className="section brief" aria-labelledby="brief-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="brief-heading" className="band-title">Bring the story with you.</h2>
          <p className="band-sub">
            You shouldn’t have to reconstruct six months of your health from
            memory before an appointment.
          </p>
        </div>

        <article className="bf-doc" aria-label="An example health brief">
          <header className="bf-head">
            <span className="bf-kind">Health brief</span>
            <span className="bf-range">1 Oct 2025 to 1 Apr 2026</span>
          </header>

          <dl className="bf-body">
            {BRIEF.map(([label, lines]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </dd>
              </div>
            ))}
          </dl>

          <footer className="bf-foot">
            <span className="bf-cta" aria-hidden="true">Create health brief</span>
            <p className="bf-note">
              Yours to take or to ignore. Ciatta does not diagnose or replace
              medical care.
            </p>
          </footer>
        </article>
      </div>
    </section>
  );
}
