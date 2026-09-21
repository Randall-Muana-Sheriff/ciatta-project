/**
 * The device's own furniture: the clock, the island and the three indicators,
 * at iPhone proportions.
 *
 * It lives in one place because the hero and the four steps below it draw the
 * same phone, and a status bar that drifts between two copies of itself is the
 * kind of thing nobody notices until the screens are side by side.
 */
export function StatusBar() {
  return (
    <div className="ha-status">
      <span className="ha-time">9:41</span>
      <span className="ha-island" />
      <span className="ha-sys">
        <svg viewBox="0 0 18 12" className="ha-sig"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity="0.45"/></svg>
        <svg viewBox="0 0 16 12" className="ha-wifi" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1.4 4.2a9.5 9.5 0 0 1 13.2 0"/><path d="M4 6.8a6 6 0 0 1 8 0"/><path d="M6.6 9.3a2.4 2.4 0 0 1 2.8 0"/></svg>
        <svg viewBox="0 0 24 12" className="ha-batt"><rect x="0.6" y="0.6" width="19" height="10.8" rx="3" fill="none" strokeWidth="1.2" stroke="currentColor"/><rect x="2.2" y="2.2" width="13" height="7.6" rx="1.6" fill="currentColor"/><path d="M21.4 4.2v3.6a2.2 2.2 0 0 0 0-3.6Z" fill="currentColor"/></svg>
      </span>
    </div>
  );
}

/**
 * A phone, drawn at whatever size its column gives it.
 *
 * Like the hero's, it is the top of a screen rather than a whole one: it fades
 * out at the foot instead of ending, so the content inside can be set at the
 * size it is read at rather than shrunk until a whole phone fits.
 */
export function Phone({
  title,
  children,
  className = '',
}: {
  /** the screen's own name, under the status bar */
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`hw-phone ${className}`.trim()}>
      <div className="ha">
        <StatusBar />
        {title && <div className="ha-nav">{title}</div>}
        {children}
      </div>
    </div>
  );
}
