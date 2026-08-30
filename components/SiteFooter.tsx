type Business = {
  name: string;
  logo_url: string | null;
  description: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
};

export default function SiteFooter({
  business,
  hoursSummary,
  showContact,
}: {
  business: Business;
  hoursSummary: string | null;
  // Settings' "Contact page" toggle promises these fields only show up
  // "if the toggle above is on" - that was only ever true for the
  // dedicated /contact page; this footer rendered them unconditionally on
  // every page regardless of the toggle. Defaults true so pages that
  // don't pass it (there shouldn't be any left) keep the old behavior
  // rather than silently hiding contact info.
  showContact?: boolean;
}) {
  const hasSocial =
    showContact !== false &&
    (business.contact_phone || business.contact_email || business.instagram_url || business.facebook_url);

  return (
    <footer className="bg-[var(--line)] border-t border-line mt-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full px-4 sm:px-10 py-10 sm:py-12 max-w-5xl mx-auto text-center sm:text-left">
        <div>
          <div className="flex items-center gap-2.5 mb-3 justify-center sm:justify-start">
            {business.logo_url ? (
              <img src={business.logo_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
            ) : (
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center font-display text-[13px] font-semibold shrink-0"
                style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                {business.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="font-display text-[18px] font-semibold" style={{ color: 'var(--accent)' }}>
              {business.name}
            </span>
          </div>
          {business.description && (
            <p className="text-[14px] text-ink-soft max-w-sm mx-auto sm:mx-0">{business.description}</p>
          )}
        </div>
        <div className="flex flex-col items-center sm:items-end justify-center gap-3">
          {hasSocial && (
            <div className="flex items-center gap-4">
              {business.instagram_url && (
                <a
                  href={business.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-medium text-ink-soft hover:text-[var(--accent)] transition-colors"
                >
                  Instagram
                </a>
              )}
              {business.facebook_url && (
                <a
                  href={business.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-medium text-ink-soft hover:text-[var(--accent)] transition-colors"
                >
                  Facebook
                </a>
              )}
              {business.contact_phone && (
                <a
                  href={`tel:${business.contact_phone}`}
                  className="text-[14px] font-medium text-ink-soft hover:text-[var(--accent)] transition-colors"
                >
                  Call
                </a>
              )}
              {business.contact_email && (
                <a
                  href={`mailto:${business.contact_email}`}
                  className="text-[14px] font-medium text-ink-soft hover:text-[var(--accent)] transition-colors"
                >
                  Email
                </a>
              )}
            </div>
          )}
          {hoursSummary && <p className="text-[13px] text-ink-faint">{hoursSummary}</p>}
          <p className="text-[12.5px] text-ink-faint">
            © {new Date().getFullYear()} {business.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
