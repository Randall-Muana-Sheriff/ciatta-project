import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import { CookieBanner } from './components/CookieBanner';
import { QuizFlow } from './components/SymptomQuiz';

/**
 * The symptom check, as a page.
 *
 * The same twelve questions and the same ending as the popup, from the same
 * component: one implementation, so the questions and what they conclude
 * cannot drift into two versions of themselves.
 *
 * What differs is the framing. A popup interrupts and has to earn a minute;
 * a page was chosen, so it can say what this is for before it starts asking,
 * and it does not need a way out — the way out of a page is the back button.
 */
export default function Quiz() {
  return (
    <>
      <a className="skip" href="#quiz-main">Skip to the symptom check</a>

      <SiteHeader current="/quiz/" />

      <main id="quiz-main">
        <section className="section qz-page" aria-labelledby="quiz-heading">
          <div className="shell">
            <div className="band-head">
              <h1 id="quiz-heading" className="band-title">
                What would you want a clinician to know?
              </h1>
              <p className="band-sub">
                Twelve questions, about a minute. It does not diagnose
                anything and it does not say whether you have any condition.
                It turns what you already know about your own symptoms into
                something you can take to an appointment.
              </p>
            </div>

            <div className="qz-page-card">
              <QuizFlow />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <CookieBanner />
    </>
  );
}
