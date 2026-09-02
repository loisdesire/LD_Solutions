// Email HTML is not web HTML. Outlook renders via Word's engine, Gmail
// strips <style> blocks in some contexts, and neither flexbox nor CSS
// custom properties are safe. So: table-based layout, every style inline,
// 600px max width, web-safe font stack. This is deliberately "old" markup.
//
// Branding is the BUSINESS's, not Vanova's - the customer booked with
// Glow Salon and has often never heard of the platform. Same split the
// public booking page already makes (see AccentScope): business brand
// front of house, platform brand only in the small print.

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Every value below reaches an HTML context, and several (customer name,
// service name, business name) are user-supplied. Without escaping, a
// customer booking as `<img src=x onerror=...>` would inject markup into
// an email the business's other staff might open.
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type EmailRow = { label: string; value: string };

export type EmailOptions = {
  businessName: string;
  accentColor?: string | null;
  logoUrl?: string | null;
  // Short line shown in the inbox preview next to the subject.
  preheader: string;
  heading: string;
  intro: string;
  rows?: EmailRow[];
  cta?: { label: string; url: string } | null;
  footerNote?: string | null;
};

export function renderEmail(opts: EmailOptions): string {
  const {
    businessName,
    accentColor,
    logoUrl,
    preheader,
    heading,
    intro,
    rows = [],
    cta = null,
    footerNote = null,
  } = opts;

  // Fall back to the platform terracotta if the business hasn't set one.
  const accent = accentColor && /^#[0-9a-fA-F]{3,8}$/.test(accentColor) ? accentColor : '#c4512d';
  const safeName = escapeHtml(businessName);

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="${safeName}" style="display:block;border:0;border-radius:12px;object-fit:cover;" />`
    : `<div style="width:48px;height:48px;border-radius:12px;background:${accent};color:#ffffff;font:600 20px/48px ${FONT_STACK};text-align:center;">${safeName.charAt(0).toUpperCase()}</div>`;

  const rowsBlock = rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0;border-collapse:collapse;">
        ${rows
          .map(
            (r, i) => `<tr>
              <td style="padding:12px 0;${i < rows.length - 1 ? 'border-bottom:1px solid #ede6d9;' : ''}font:400 14px/20px ${FONT_STACK};color:#6b6b6b;">${escapeHtml(r.label)}</td>
              <td align="right" style="padding:12px 0;${i < rows.length - 1 ? 'border-bottom:1px solid #ede6d9;' : ''}font:600 14px/20px ${FONT_STACK};color:#202020;">${escapeHtml(r.value)}</td>
            </tr>`
          )
          .join('')}
      </table>`
    : '';

  // A bulletproof-ish button: a table cell with a bgcolor, not a styled
  // <a>, so Outlook renders the fill.
  const ctaBlock = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
        <tr>
          <td bgcolor="${accent}" style="border-radius:999px;">
            <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:13px 28px;font:600 14px/1 ${FONT_STACK};color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(cta.label)}</a>
          </td>
        </tr>
      </table>`
    : '';

  const footerBlock = footerNote
    ? `<p style="margin:0 0 8px;font:400 12px/18px ${FONT_STACK};color:#9b9691;">${escapeHtml(footerNote)}</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#faf8f3;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#faf8f3;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #ede6d9;border-radius:16px;">
        <tr>
          <td style="padding:32px 32px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:12px;">${logoBlock}</td>
                <td style="font:600 16px/1.3 ${FONT_STACK};color:#202020;">${safeName}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0;">
            <h1 style="margin:0;font:700 24px/1.25 ${FONT_STACK};color:#202020;">${escapeHtml(heading)}</h1>
            <p style="margin:10px 0 0;font:400 15px/22px ${FONT_STACK};color:#6b6b6b;white-space:pre-line;">${escapeHtml(intro)}</p>
            ${rowsBlock}
            ${ctaBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 32px;">
            <div style="border-top:1px solid #ede6d9;padding-top:18px;">
              ${footerBlock}
              <p style="margin:0;font:400 12px/18px ${FONT_STACK};color:#9b9691;">Sent by ${safeName} via Vanova.</p>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
