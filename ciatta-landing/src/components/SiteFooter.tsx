import { useEffect } from 'react';
import { Wordmark } from './Wordmark';
import { CookieChoicesLink } from './CookieBanner';
import { QuizLink } from './SymptomQuiz';
import { LEGAL } from '../legal/config';
import { initReveal } from '../lib/reveal';

/**
 * The footer every page shares, in Suna Health's arrangement: the wordmark
 * and a sentence saying what this is, then three headed columns, then a rule
 * and a line carrying the year and what Ciatta is not.
 *
 * Their structure, Ciatta's contents. Where they have Careers, Press and
 * Science, Ciatta has four pages and one mailbox, and the columns hold those
 * rather than headings pointing at pages that do not exist. A footer full of
 * dead links is a worse impression than a short one.
 */

/**
 * The accounts, at their canonical addresses.
 *
 * Each of these arrived with the parameters a share sheet adds — stkn on
 * Instagram, mibextid on Facebook, _r and _t on TikTok. They are stripped.
 * Two reasons: they are one person's share-session artefacts rather than
 * part of the address, and Instagram's stkn in particular is scoped to the
 * account that generated it, which is not a thing to publish on a website
 * and leave there. The bare profile URLs resolve to the same places.
 */
const SOCIAL: { label: string; href: string }[] = [
  { label: 'Instagram', href: 'https://www.instagram.com/getciatta' },
  { label: 'Facebook', href: 'https://www.facebook.com/share/19caYcZnC9/' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@getciatta' },
];

const COLUMNS: [string, { label: string; href: string }[]][] = [
  ['Company', [
    { label: 'How it works', href: '/how-it-works/' },
    { label: 'Membership', href: '/member/' },
    { label: 'Privacy Policy', href: '/privacy/' },
    { label: 'Terms of Use', href: '/terms/' },
  ]],
  ['Learn', [
    { label: 'Ciatta Briefs', href: '/briefs/' },
    { label: 'Questions', href: '/#q-heading' },
  ]],
];

export function SiteFooter() {
  /* The scroll reveal is armed here because the footer is the last thing
     every page renders: by the time this effect runs the whole document is
     committed, so the observer sees every section rather than whatever had
     mounted when a main.tsx called it. Every page uses this footer, so every
     page gets it, and no page has to remember to. */
  useEffect(() => { initReveal(); }, []);

  return (
    <footer className="ft">
      <div className="shell">
        <div className="ft-top">
          <div className="ft-brand">
            <span className="sr-only">Ciatta</span>
            <Wordmark size="sm" />
            <p>
              The intelligence layer for personal health, connecting what is
              happening across your body, your care and your everyday life.
              Reservations are open; membership opens in Quarter 3 of 2027.
            </p>
          </div>

          <nav className="ft-cols" aria-label="Footer">
            {COLUMNS.map(([head, links]) => (
              <div key={head}>
                <h2>{head}</h2>
                <ul>
                  {links.map((l) => (
                    <li key={l.href}><a href={l.href}>{l.label}</a></li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <h2>Connect</h2>
              <ul>
                {SOCIAL.map((s) => (
                  <li key={s.href}>
                    {/* noreferrer as well as noopener: the target has no
                        business knowing which page sent her. */}
                    <a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>
                  </li>
                ))}
                <li><a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a></li>
                <li><QuizLink /></li>
                <li><CookieChoicesLink /></li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="ft-base">
          <span>&copy; {new Date().getFullYear()} {LEGAL.operator}</span>
          <span>
            Ciatta provides health information, observations and
            recommendations for exploration. It does not diagnose, treat or
            prevent any condition, and it does not replace medical care.
          </span>
        </div>
      </div>
    </footer>
  );
}
