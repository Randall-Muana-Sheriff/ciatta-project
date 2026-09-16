// The facts both legal pages depend on, in one place.
//
// Everything in these two documents was written against what the site
// actually does today (see src/legal/privacy.ts for the inventory). What only
// the business can supply is here. Review with a lawyer before relying on it,
// and bump `updated` whenever either document changes in substance.

export const LEGAL = {
  /** The legal name of whoever operates ciatta.io, e.g. "Ciatta Health, Inc.". */
  operator: 'Ciatta LLC',
  /** Where requests about personal data go. This mailbox must exist and be read. */
  privacyEmail: 'privacy@ciatta.io',
  /** General questions about the terms. */
  contactEmail: 'privacy@ciatta.io',
  /** Whose courts and laws govern the terms, e.g. "the State of Delaware, United States".
      Left empty until the operating entity is settled; the terms then fall back
      to wording that does not name a jurisdiction. */
  governingLaw: '' as string,
  /** Shown as "Last updated". */
  updated: '16 September 2026',
} as const;
