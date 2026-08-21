// Pulled out of ServicesManager.tsx, ProductsManager.tsx, and StaffManager.tsx,
// where these exact strings were defined byte-for-byte identically (each
// file redeclared its own copy). Pure dedup - no visual change; every class
// here matches what those three files already had inline.
export const inputClass =
  'w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

export const smallInputClass =
  'rounded-xl border-2 border-line-strong bg-surface px-3 py-1.5 text-[13.5px] text-ink outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

export const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5';

export const iconBtnClass =
  'h-8 w-8 flex items-center justify-center rounded-full border-2 border-line-strong text-ink-soft hover:border-accent hover:text-accent transition-colors';

export const pillClass = (active: boolean) =>
  `px-3.5 py-1.5 rounded-full font-mono text-[11px] transition-colors ${
    active ? 'text-white' : 'text-ink-faint hover:text-ink'
  }`;
