import { useState } from 'react';
import {
  TRACKS, next, progress, result, get,
  type Given, type Track, type Weight,
} from '../lib/quiz';

/**
 * The quiz: where to start, what it asks, and what you take away.
 *
 * THREE STEPS.
 *
 *   1. Where to start. Six ways in, named for what she arrived with rather
 *      than for a body system: "My cycle or my periods", not "Hormones &
 *      cycle". The last one is for the largest group of all, the people who
 *      know something is wrong and cannot say which box it belongs in, and
 *      it is not labelled as a lesser path.
 *
 *   2. The questions, which follow what she answers. The rules live in
 *      lib/quiz.ts and they are rules you can read, not a model: answer at
 *      the top of the scale and the questions that follow from that answer
 *      are asked next; answer at the bottom and they are never asked. If the
 *      opening questions all come back quiet it stops early rather than
 *      working through nine to arrive at the same place.
 *
 *   3. What to take to your clinician: what she just said, sorted into what
 *      is worth raising first and what is worth mentioning.
 *
 * WHAT IT DOES NOT DO, AND WHY.
 *
 * It does not name a condition, in any form, at any strength. The quiz this
 * was modelled on ends on a likelihood band for one; the site's own FAQ says
 * naming a condition is a clinician's job and that Ciatta "does not do it,
 * suggest it, or hint at it", and the footer of every page says it does not
 * diagnose, treat or prevent. A band would have put the loudest claim on the
 * site in the one place nothing supports it.
 *
 * It is also never described as intelligent, adaptive or AI, here or in the
 * copy around it. It follows what you answer. That is a sentence anyone can
 * check, and it is the whole truth about what is happening.
 *
 * It lives on the home page and at /quiz/, and it is not a popup: a page is
 * chosen rather than sprung, and nobody has to find the way out of something
 * that asks twelve questions about their body.
 */

/* The note stands through the whole flow, not just at the ends. It was in
   the lede before the first question and in the note after the last one,
   which is the two moments anyone is least likely to be reading it. */
function Note({ long = false }: { long?: boolean }) {
  return (
    <p className="qz-note">
      This is not a diagnosis. It cannot tell you whether you have any
      condition, and it is not a substitute for medical advice. Only a
      clinician can do that.
      {long && ' What it is for is arriving with your own answers already written down.'}
    </p>
  );
}

export function QuizFlow() {
  const [track, setTrack] = useState<Track | null>(null);
  const [given, setGiven] = useState<Given[]>([]);

  const q = track ? next(track, given) : null;
  const info = TRACKS.find((t) => t.key === track);

  const answer = (w: Weight) => q && setGiven([...given, { id: q.id, w }]);
  const back = () => setGiven(given.slice(0, -1));
  const restart = () => { setGiven([]); setTrack(null); };

  /* ---- 1 · where to start --------------------------------------------- */
  if (!track) {
    return (
      <>
        <p className="qz-kind">Where would you like to start?</p>
        <h3 className="qz-q">What is on your mind?</h3>
        <ul className="qz-tracks">
          {TRACKS.map((t) => (
            <li key={t.key}>
              <button type="button" onClick={() => setTrack(t.key)}>
                <b>{t.label}</b>
                <span>{t.line}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="qz-hint">
          The questions follow what you answer, so this is usually five or six
          of them rather than a form.
        </p>
        <Note />
      </>
    );
  }

  /* ---- 2 · the questions ---------------------------------------------- */
  if (q) {
    return (
      <>
        <div className="qz-bar" role="presentation">
          <span style={{ width: `${progress(track, given) * 100}%` }} />
        </div>
        <p className="qz-n">
          <span>{info?.head}</span>
          {given.length > 0 && <i>Question {given.length + 1}</i>}
        </p>

        <h3 className="qz-q">{q.q}</h3>
        <ul className="qz-a">
          {q.a.map((opt) => (
            <li key={opt.label}>
              <button type="button" onClick={() => answer(opt.w)}>{opt.label}</button>
            </li>
          ))}
        </ul>

        <div className="qz-foot">
          {given.length > 0
            ? <button type="button" className="qz-back" onClick={back}>Back</button>
            : <button type="button" className="qz-back" onClick={restart}>Start somewhere else</button>}
        </div>

        <Note />
      </>
    );
  }

  /* ---- 3 · what to take with you --------------------------------------- */
  const { first, also } = result(given);

  return (
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
          Nothing you answered stood out as something to raise. That is worth
          knowing too, and it is still worth saying to a clinician if
          something feels wrong to you.
        </p>
      )}

      {/* What she said, in her own words, under what it is filed as. The
          list above is the page she takes in; this is where each line on it
          came from, so nothing on it is a claim she cannot account for. */}
      <details className="qz-said">
        <summary><span>What you answered</span><i aria-hidden="true" /></summary>
        <dl>
          {given.map((g) => {
            const src = get(g.id);
            return (
              <div key={g.id}>
                <dt>{src?.q}</dt>
                <dd>{src?.a.find((x) => x.w === g.w)?.label}</dd>
              </div>
            );
          })}
        </dl>
      </details>

      <Note long />

      <div className="qz-cta">
        <a className="qz-go" href="/member/#membership">Reserve your place</a>
        <button type="button" className="qz-back" onClick={restart}>Start again</button>
      </div>
    </>
  );
}
