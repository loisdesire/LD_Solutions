import { describe, expect, it } from 'vitest';
import { safeJsonLdString } from './jsonLd';

// A real, documented XSS mitigation: JSON.stringify escapes quotes and
// backslashes for valid JSON, but NOT "<" or "/" - so a business name or
// service name (both plain, owner-controlled text fields with nothing
// stopping them from containing "</script>") could break out of the
// <script type="application/ld+json"> tag it's injected into via
// dangerouslySetInnerHTML, followed by a real "<script>" that would then
// execute. This is the actual fix: escaping "<" to its unicode form
// neutralizes both "</script>" and the "<!--" HTML-comment bypass without
// changing what a real JSON parser sees.
describe('safeJsonLdString', () => {
  it('neutralizes a literal "</script>" inside a field value - the actual XSS this function exists to prevent', () => {
    const result = safeJsonLdString({ name: '</script><script>alert(1)</script>' });
    expect(result).not.toContain('</script>');
    expect(result).not.toContain('<script>');
    // Only "<" itself is escaped (not "/" or ">") - still enough to break
    // up every "</script>"/"<script>" sequence, since none of them can
    // form without a literal "<".
    expect(result).toContain('\\u003c/script>\\u003cscript>');
  });

  it('neutralizes the "<!--" HTML-comment bypass too', () => {
    const result = safeJsonLdString({ name: '<!--' });
    expect(result).not.toContain('<!--');
  });

  it('still produces text a real JSON parser reads identically to the unescaped original', () => {
    const data = { name: 'Glow <Salon>', price: 5000 };
    const result = safeJsonLdString(data);
    expect(JSON.parse(result)).toEqual(data);
  });

  it('leaves ordinary text completely untouched', () => {
    expect(safeJsonLdString({ name: 'Glow Salon' })).toBe('{"name":"Glow Salon"}');
  });
});
