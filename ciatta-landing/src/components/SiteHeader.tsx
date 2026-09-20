import { useEffect, useState } from 'react';
import { Wordmark } from './Wordmark';

/**
 * The header every page shares.
 *
 * Above the split the destinations sit in the bar. Below it they sit behind a
 * hamburger, because four links and an action do not fit beside a wordmark on
 * a phone without one of them being cut.
 *
 * The panel is a real disclosure: the button says whether it is open, Escape
 * closes it, and the page behind it does not scroll while it is. Over the
 * home page's film the bar starts transparent and takes its surface once the
 * film has scrolled away, which is what `scrolled` carries.
 */

const LINKS: [string, string][] = [
  ['/how-it-works/', 'How it works'],
  ['/briefs/', 'Briefs'],
];

export function SiteHeader({
  scrolled = true,
  current,
}: {
  /** False only while a film is still behind the bar. */
  scrolled?: boolean;
  current?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  return (
    <header className={scrolled ? 'header is-scrolled' : 'header'}>
      <a href="/" className="header-brand" aria-label="Ciatta, home">
        <Wordmark size="sm" />
      </a>

      <nav className="header-nav" aria-label="Pages">
        {LINKS.map(([href, label]) => (
          <a key={href} href={href} aria-current={current === href ? 'page' : undefined}>
            {label}
          </a>
        ))}
      </nav>

      <div className="header-end">
        <a className="header-cta" href="/member/">Become a member</a>

        <button
          type="button"
          className={open ? 'header-burger is-open' : 'header-burger'}
          aria-expanded={open}
          aria-controls="header-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? 'Close menu' : 'Menu'}</span>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      <div id="header-menu" className="header-menu" hidden={!open}>
        <nav aria-label="Pages">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} aria-current={current === href ? 'page' : undefined}>
              {label}
            </a>
          ))}
          <a href="/member/">Become a member</a>
        </nav>
      </div>
    </header>
  );
}
