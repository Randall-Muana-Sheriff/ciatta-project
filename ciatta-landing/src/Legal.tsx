import { Fragment } from 'react';
import { Wordmark } from './components/Wordmark';
import { LEGAL } from './legal/config';
import type { Block, LegalDoc } from './legal/types';

/**
 * The privacy notice and the terms, one layout for both.
 *
 * Built to be read, not scrolled past: a plain summary first, a contents list
 * that links to each section, a readable measure, and tables that scroll on a
 * phone rather than crushing their columns.
 */

// An address in running text becomes a mail link; everything else stays text.
function withLinks(text: string) {
  const parts = text.split(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={`mailto:${part}`}>
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function renderBlock(block: Block, key: number) {
  if ('p' in block) return <p key={key}>{withLinks(block.p)}</p>;
  if ('list' in block) {
    return (
      <ul key={key}>
        {block.list.map((item) => (
          <li key={item}>{withLinks(item)}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="legal-table" key={key} role="region" aria-label="Table" tabIndex={0}>
      <table>
        <thead>
          <tr>
            {block.table.head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={i}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Legal({ doc, current }: { doc: LegalDoc; current: 'privacy' | 'terms' }) {
  return (
    <>
      <a className="skip" href="#legal-main">
        Skip to the {doc.title.toLowerCase()}
      </a>

      <header className="header is-scrolled">
        <a href="/" className="header-brand" aria-label="Ciatta, home">
          <Wordmark size="sm" />
        </a>
        <div className="header-end">
          <a className="header-cta" href="/member/">
            Become a member
          </a>
        </div>
      </header>

      <main id="legal-main" className="legal">
        <div className="shell legal-shell">
          <header className="legal-head">
            <h1 className="band-title">{doc.title}</h1>
            <p className="band-sub">{doc.summary}</p>
            <p className="legal-updated">Last updated {LEGAL.updated}</p>
          </header>

          <section className="legal-plainly" aria-labelledby="plainly">
            <h2 id="plainly">In short</h2>
            <ul>
              {doc.plainly.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <nav className="legal-toc" aria-label="Contents">
            <h2>Contents</h2>
            <ol>
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title.replace(/^\d+\.\s*/, '')}</a>
                </li>
              ))}
            </ol>
          </nav>

          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className="legal-section" aria-labelledby={`${s.id}-title`}>
              <h2 id={`${s.id}-title`}>{s.title}</h2>
              {s.blocks.map(renderBlock)}
            </section>
          ))}
        </div>
      </main>

      <footer className="footer shell">
        <span className="sr-only">Ciatta</span>
        <Wordmark size="sm" />
        <nav className="footer-nav" aria-label="Footer">
          <a href="/">Home</a>
          <a href="/briefs/">Briefs</a>
          <a href="/privacy/" aria-current={current === 'privacy' ? 'page' : undefined}>
            Privacy
          </a>
          <a href="/terms/" aria-current={current === 'terms' ? 'page' : undefined}>
            Terms
          </a>
        </nav>
        <p className="footer-copy">&copy; {new Date().getFullYear()} Ciatta</p>
      </footer>
    </>
  );
}
