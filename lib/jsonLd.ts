// Both call sites (app/page.tsx, app/[slug]/page.tsx) build a plain JS
// object and JSON.stringify it straight into a <script type="application/
// ld+json"> via dangerouslySetInnerHTML - the standard way to emit
// structured data for SEO. JSON.stringify escapes quotes and backslashes
// for valid JSON, but NOT `<` or `/` - so a value containing a literal
// "</script>" breaks out of the script tag as raw HTML, followed by
// whatever comes after it (a real "<script>...</script>" would then
// execute). app/[slug]/page.tsx's jsonLd includes business.name and each
// service's name - both plain, unrestricted text fields the business
// owner sets themselves via BusinessProfileManager/ServicesManager, with
// nothing stopping either from containing that sequence. Escaping "<" to
// its unicode escape neutralizes "</script>" (and the lesser-known
// "<!--" HTML-comment bypass) without changing the JSON's meaning -
// < is still parsed as a literal "<" by any real JSON parser (a
// browser's <script type="application/ld+json"> included), so search
// engines see identical structured data either way.
export function safeJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
