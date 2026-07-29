type Business = {
  name: string;
  logo_url: string | null;
  description: string | null;
};

export default function SiteFooter({
  business,
  hoursSummary,
}: {
  business: Business;
  hoursSummary: string | null;
}) {
  return (
    <footer className="bg-[#ebe8e3] border-t border-line mt-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full px-6 sm:px-10 py-12 max-w-5xl mx-auto text-center sm:text-left">
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
            <p className="text-[13.5px] text-ink-soft max-w-sm mx-auto sm:mx-0">{business.description}</p>
          )}
        </div>
        <div className="flex flex-col items-center sm:items-end justify-center gap-2">
          {hoursSummary && <p className="text-[12.5px] text-ink-faint">{hoursSummary}</p>}
          <p className="text-[11.5px] text-ink-faint">
            © {new Date().getFullYear()} {business.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
