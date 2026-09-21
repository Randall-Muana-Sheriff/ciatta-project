import { useState } from 'react';
import { Phone } from './PhoneChrome';

/**
 * A module: a numbered accordion, and the screen it is about.
 *
 * Built for /how-it-works/, where a run of these carries the page, and now
 * shared with the home page's safety section. It lives in one file because
 * two copies of an accordion drift: one gains a keyboard fix, the other
 * keeps the bug, and nobody notices until a screen reader finds it.
 *
 * The screens are built the way the hero's screen is built, which is the
 * only way anything renders on a real iPhone: the hero's device, plain rem
 * sizes, no query container, and no unit derived from something a browser
 * has to agree about.
 *
 * Four shapes carry all of them: a figure, a list of rows, dated notes, and
 * a finding.
 */

export type Item = { n: string; title: string; body: string; Screen: () => React.ReactNode };

export type Row = [string, string, string];

/** A measurement, at the size a measurement is read at. */
export function Figure({
  title, head, big, sub, rows,
}: { title: string; head: [string, string]; big: string; sub: string; rows?: Row[] }) {
  return (
    <Phone title={title} className="is-rows">
      <div className="product hw-frag">
        <div className="hw-frag-head"><span>{head[0]}</span><i>{head[1]}</i></div>
        <p className="hf-big">{big}</p>
        <p className="hf-sub">{sub}</p>
        {rows && (
          <div className="ps-rows">
            {rows.map(([k, why, v]) => (
              <div className="ps-row" key={k}>
                <div className="ps-row-line">
                  <span className="ps-row-k"><b>{k}</b>{why && <i>{why}</i>}</span>
                  <span className="ps-row-v">{v}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Phone>
  );
}

/** A list: results across time, things to try, the parts of a brief. */
export function Rows({
  title, head, rows, caret,
}: { title: string; head: [string, string]; rows: Row[]; caret?: boolean }) {
  return (
    <Phone title={title} className="is-rows is-brief">
      <div className="product hw-frag">
        <div className="hw-frag-head"><span>{head[0]}</span><i>{head[1]}</i></div>
        <div className="ps-rows">
          {rows.map(([k, why, v]) => (
            <div className="ps-row" key={k + v}>
              <div className="ps-row-line">
                <span className="ps-row-k"><b>{k}</b>{why && <i>{why}</i>}</span>
                {caret ? (
                  <svg viewBox="0 0 8 14" className="ps-caret" aria-hidden="true">
                    <path d="m1 1 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="ps-row-v">{v}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

/** What she told Ciatta, dated as she wrote it. */
export function Notes({ notes }: { notes: [string, string][] }) {
  return (
    <Phone title="Your own words" className="is-rows">
      <div className="product hw-frag">
        <div className="hw-frag-head"><span>What you told Ciatta</span><i>3 notes</i></div>
        <div className="hf-notes">
          {notes.map(([when, what]) => (
            <div key={when}>
              <span>{when}</span>
              <p>{what}</p>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

/** A finding, or a plain statement, and what it rests on. */
export function Finding({
  tag, finding, basis, title = 'Today',
}: { tag: string; finding: string; basis: string; title?: string }) {
  return (
    <Phone title={title} className="is-rows">
      <div className="product hw-frag">
        <div className="hw-frag-ins is-alone">
          <span className="hw-frag-tag">{tag}</span>
          <p>{finding}</p>
          <span className="hw-frag-basis">{basis}</span>
        </div>
      </div>
    </Phone>
  );
}

/**
 * The module itself. The first item is open on arrival, because a column of
 * closed headings tells her nothing about what is behind them.
 */
export function Module({
  id, kind, title, lede, items, reversed, foot,
}: {
  id: string;
  kind: string;
  title: string;
  lede?: string;
  items: Item[];
  reversed?: boolean;
  /** A line under the body: where the binding version of this lives. */
  foot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(0);
  const Screen = items[open].Screen;

  return (
    <section className="section hw2-module" aria-labelledby={id}>
      <div className="shell">
        <div className="band-head">
          <span className="hw2-kind">{kind}</span>
          <h2 id={id} className="band-title">{title}</h2>
          {lede && <p className="band-sub">{lede}</p>}
        </div>

        <div className={reversed ? 'hw2-body is-reversed' : 'hw2-body'}>
          <div className="hw2-list">
            {items.map((item, i) => {
              const isOpen = i === open;
              return (
                <div className={isOpen ? 'hw2-item is-open' : 'hw2-item'} key={item.n}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`${id}-${item.n}`}
                      onClick={() => setOpen(i)}
                    >
                      <span className="hw2-n">{item.n}</span>
                      <span className="hw2-t">{item.title}</span>
                      <span className="hw2-mark" aria-hidden="true" />
                    </button>
                  </h3>
                  <div id={`${id}-${item.n}`} className="hw2-panel" hidden={!isOpen}>
                    <p>{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hw2-media">
            <Screen />
          </div>
        </div>

        {foot && <p className="sf-foot">{foot}</p>}
      </div>
    </section>
  );
}
