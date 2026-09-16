// The one email shell every Ciatta message is poured into: the confirmation,
// the welcome, and each issue of Ciatta Briefs. Plain JS with no imports so the
// Pages Functions bundle and the Node scheduling script share it unchanged.
//
// Email clients are not browsers. The rules this follows, and why:
//   · tables for structure, because Outlook for Windows renders with Word
//   · every style inline, because Gmail strips <style> in several contexts
//   · a 600px column, which is what every client is tuned around
//   · a hidden preheader, which is the grey line after the subject in the inbox
//   · real text colours on real backgrounds, so dark mode inverts cleanly
//   · a plain-text part alongside, which spam filters weigh and some readers use

export const brand = {
  canvas: '#F7F4EE',
  surface: '#FDFDFC',
  ink: '#18191B',
  body: '#494C4F',
  meta: '#585B5E',
  rule: '#E8E4DC',
  change: '#C7702A',
  font: "Jost, 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** A full-width button that survives Outlook: a bordered cell, not a styled link. */
export function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px 0;">
  <tr>
    <td bgcolor="${brand.ink}" style="border-radius:999px;">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${brand.font};font-size:16px;font-weight:500;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function paragraph(html) {
  return `<p style="margin:0 0 16px 0;font-family:${brand.font};font-size:16px;line-height:26px;color:${brand.body};">${html}</p>`;
}

export function heading(text) {
  return `<h1 style="margin:0 0 16px 0;font-family:${brand.font};font-size:26px;font-weight:500;line-height:32px;color:${brand.ink};">${escapeHtml(text)}</h1>`;
}

/**
 * @param {object} o
 * @param {string} o.title       <title>, also what some clients show in previews
 * @param {string} o.preheader   inbox preview line
 * @param {string} o.bodyHtml    already-built inner HTML
 * @param {string} o.footerHtml  why they got it and how to stop it
 * @param {string} [o.siteUrl]
 */
export function renderEmail({ title, preheader, bodyHtml, footerHtml, siteUrl = 'https://ciatta.io' }) {
  // The run of zero-width joiners after the preheader stops clients from
  // pulling body text into the preview once the preheader runs out.
  const filler = '&#8204;&nbsp;'.repeat(60);
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${brand.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${brand.canvas}">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td style="padding:0 8px 24px 8px;">
            <a href="${escapeHtml(siteUrl)}" target="_blank" style="font-family:${brand.font};font-size:15px;font-weight:500;letter-spacing:4px;color:${brand.ink};text-decoration:none;">CIATTA</a>
          </td>
        </tr>
        <tr>
          <td bgcolor="${brand.surface}" style="border-radius:20px;padding:36px 32px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 8px 0 8px;font-family:${brand.font};font-size:13px;line-height:20px;color:${brand.meta};">
            ${footerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Collapse an HTML body to a readable plain-text part. */
export function toPlainText(html) {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis, (_, href, label) => `${label.replace(/<[^>]+>/g, '')} (${href})`)
    .replace(/<\/(p|h1|h2|h3|li|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '· ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8204;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
