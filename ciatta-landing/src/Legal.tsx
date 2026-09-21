import { Fragment } from 'react';
import { Wordmark } from './components/Wordmark';
import { LEGAL } from './legal/config';
import type { Block, LegalDoc } from './legal/types';
import { CookieBanner, CookieChoicesLink } from './components/CookieBanner';

/**
 * The Privacy Policy and the Terms of Use, one layout for both, to the shape of
 * whoop.com's Terms of Use: a black band carrying the title on two staggered
 * lines, then the document in a single column indented from the left edge of
 * the row. Inside that column there is one size of type — headings are the
 * same size as the text and are told apart by weight alone — which is what
 * makes it read as a legal document rather than as a page about one.
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
      <CookieBanner />
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

      <div className="legal-band">
        <div className="shell">
          <h1 className="legal-band-title">
            <span>{LEGAL.operator}</span>
            <span>{doc.title}</span>
          </h1>
        </div>
      </div>

      <main id="legal-main" className="legal">
        <div className="shell">
          <div className="legal-doc">
            <p className="legal-updated">Last updated {LEGAL.updated}</p>
            <p className="legal-summary">{doc.summary}</p>

            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="legal-section" aria-labelledby={`${s.id}-title`}>
                <h2 id={`${s.id}-title`}>{s.title}</h2>
                {s.blocks.map(renderBlock)}
              </section>
            ))}
          </div>
        </div>
      </main>

      <footer className="footer shell">
        <span className="sr-only">Ciatta</span>
        <Wordmark size="sm" />
        <nav className="footer-nav" aria-label="Footer">
          <a href="/">Home</a>
          <a href="/briefs/">Briefs</a>
          <a href="/privacy/" aria-current={current === 'privacy' ? 'page' : undefined}>
            Privacy Policy
          </a>
          <a href="/terms/" aria-current={current === 'terms' ? 'page' : undefined}>
            Terms of Use
          </a>
          <CookieChoicesLink />
        </nav>
        <p className="footer-copy">&copy; {new Date().getFullYear()} Ciatta</p>
      </footer>
    </>
  );
}
