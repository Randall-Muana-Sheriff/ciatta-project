import { useState } from 'react';

/**
 * The symptom check: twelve questions, and what to do with the answers.
 *
 * WHAT THIS DOES NOT DO, AND WHY.
 *
 * The quiz it is modelled on ends on "Low Likelihood — your answers indicate
 * a low likelihood of having endometriosis". Ciatta cannot end there. The
 * site's own FAQ says naming a condition is a clinician's job and that
 * Ciatta "does not do it, suggest it, or hint at it", and the footer of
 * every page says it does not diagnose, treat or prevent any condition. A
 * likelihood band is a hint at a condition, and it would have put the
 * loudest claim on the site in the one place nothing supports it.
 *
 * So the questions are the same kind of questions, and the ending is
 * Ciatta's: what she has just told it, sorted into what is worth raising
 * first and what is worth mentioning, in words she can say out loud in an
 * appointment. That is "Prepare for care" from the membership card, done
 * once, for free, before she has an account. No score, no band, no verdict,
 * and no condition named anywhere in it.
 *
 * It lives at /quiz/ and nowhere else. It was a popup first; a page is a
 * better home for something that asks twelve questions about your body,
 * because a page is chosen rather than sprung, and nobody has to find the
 * way out of it.
 */

type Weight = 0 | 1 | 2;

/** A question, its domain, and three answers from least to most. */
type Q = {
  /** What this question is about, in the words the result uses. */
  domain: string;
  q: string;
  /** Each answer carries how much it is worth raising, not how likely anything is. */
  a: [string, Weight][];
};

const QUESTIONS: Q[] = [
  { domain: 'Period pain',
    q: 'How would you describe your period pain?',
    a: [
      ['Uncomfortable, but nothing I would call painful', 0],
      ['Painful, though over-the-counter painkillers handle it', 1],
      ['Bad enough that I cannot work or do my usual day', 2],
    ] },
  { domain: 'Pain between periods',
    q: 'Do you get pelvic pain when you are not on your period?',
    a: [
      ['Rarely or never', 0],
      ['Sometimes, around ovulation or before my period', 1],
      ['Often, at any point in the month', 2],
    ] },
  { domain: 'How heavy your periods are',
    q: 'Are your periods heavy?',
    a: [
      ['No, ordinary protection is enough', 0],
      ['Sometimes heavy enough to need changing more often', 1],
      ['Almost always heavy, and I plan around it', 2],
    ] },
  { domain: 'How long your periods last',
    q: 'How long does your period usually last?',
    a: [
      ['Around five days or fewer', 0],
      ['Six or seven days', 1],
      ['More than seven days, or it is hard to say where it ends', 2],
    ] },
  { domain: 'Digestive symptoms',
    q: 'How often do you get bloating, nausea, constipation or diarrhoea?',
    a: [
      ['Rarely', 0],
      ['Sometimes, often around my period', 1],
      ['Most of the time', 2],
    ] },
  { domain: 'Bladder symptoms',
    q: 'Do you get pain or urgency when you empty your bladder?',
    a: [
      ['No', 0],
      ['Occasionally, usually during my period', 1],
      ['Often, period or not', 2],
    ] },
  { domain: 'Pain during or after sex',
    q: 'Do you get pain during or after sex?',
    a: [
      ['No, or this does not apply to me', 0],
      ['Sometimes', 1],
      ['Often, and it has changed what I do', 2],
    ] },
  { domain: 'Fatigue',
    q: 'How often are you tired in a way that rest does not fix?',
    a: [
      ['Rarely', 0],
      ['Some weeks, usually around my period', 1],
      ['Most weeks', 2],
    ] },
  { domain: 'Whether pain relief works',
    q: 'When you take something for the pain, does it help?',
    a: [
      ['Yes, it settles', 0],
      ['Somewhat, or it comes back', 1],
      ['Not really, whatever I take', 2],
    ] },
  { domain: 'The effect on your life',
    q: 'Have symptoms changed your work, study or plans?',
    a: [
      ['No', 0],
      ['Occasionally I have had to change something', 1],
      ['Regularly, and I plan around them', 2],
    ] },
  { domain: 'How long this has gone on',
    q: 'How long have you been noticing these symptoms?',
    a: [
      ['Under a year', 0],
      ['One to three years', 1],
      ['More than three years', 2],
    ] },
  { domain: 'What you have been told before',
    q: 'Have you raised this with a clinician before?',
    a: [
      ['No, not yet', 0],
      ['Yes, and I am still working it out with them', 1],
      ['Yes, and I was told it was normal or nothing was found', 2],
    ] },
];

/** The quiz itself. Rendered by /quiz/, in the card on that page. */
export function QuizFlow() {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Weight[]>([]);

  const done = answers.length === QUESTIONS.length;
  const answer = (w: Weight) => {
    const next = [...answers.slice(0, i), w];
    setAnswers(next);
    setI(i + 1);
  };
  const back = () => setI(Math.max(0, i - 1));
  const restart = () => { setAnswers([]); setI(0); };

  /* The result: her own answers, sorted. Nothing is scored and nothing is
     named. "Worth raising first" is simply where she chose the strongest
     answer, said back to her in the order she gave it. */
  const first = QUESTIONS.filter((_, n) => answers[n] === 2).map((q) => q.domain);
  const also = QUESTIONS.filter((_, n) => answers[n] === 1).map((q) => q.domain);

  return (
    <>
      {!done ? (
          <>
            <div className="qz-bar" role="presentation">
              <span style={{ width: `${(i / QUESTIONS.length) * 100}%` }} />
            </div>
            <p className="qz-n">{i + 1} of {QUESTIONS.length}</p>

            <h3 className="qz-q">{QUESTIONS[i].q}</h3>
            <ul className="qz-a">
              {QUESTIONS[i].a.map(([label, w]) => (
                <li key={label}>
                  <button type="button" onClick={() => answer(w)}>{label}</button>
                </li>
              ))}
            </ul>

            <div className="qz-foot">
              {i > 0 && <button type="button" className="qz-back" onClick={back}>Back</button>}
            </div>
          </>
        ) : (
          <>
            <p className="qz-kind">Your answers</p>
            <h2 className="qz-h">What to take to your clinician</h2>

            {first.length > 0 && (
              <>
                <p className="qz-sub">Worth raising first</p>
                <ul className="qz-list">{first.map((d) => <li key={d}>{d}</li>)}</ul>
              </>
            )}
            {also.length > 0 && (
              <>
                <p className="qz-sub">Worth mentioning</p>
                <ul className="qz-list is-quiet">{also.map((d) => <li key={d}>{d}</li>)}</ul>
              </>
            )}
            {first.length === 0 && also.length === 0 && (
              <p className="qz-lede">
                Nothing you answered stood out as something to raise. That is
                worth knowing too, and it is still worth saying to a clinician
                if something feels wrong to you.
              </p>
            )}

            <p className="qz-note">
              This is not a diagnosis and it does not say whether you have any
              condition. Only a clinician can do that. It is a way of arriving
              with your own answers already written down.
            </p>

            <div className="qz-cta">
              <a className="qz-go" href="/member/#membership">Reserve your place</a>
              <button type="button" className="qz-back" onClick={restart}>Start again</button>
            </div>
          </>
        )}
    </>
  );
}

