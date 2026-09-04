// Extracted out of app/page.tsx so both the "Built for businesses that
// take appointments" category chips AND the homepage AI demo's vertical
// picker (components/LandingChatDemo.tsx) share one real source of
// truth instead of two copies quietly drifting apart. Short labels + a
// small icon each, not the long compound names this had before ("Hair
// salons & barbershops", 25 characters) - those were the actual cause
// of the uneven-pill-height bug fixed earlier: a label that long can't
// fit on one line in a two-column layout no matter how the columns are
// built.
export const businessTypes = [
  {
    label: 'Salons & barbers',
    icon: (
      <>
        <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
      </>
    ),
  },
  {
    label: 'Wellness clinics',
    icon: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />,
  },
  {
    label: 'Tutors & coaches',
    icon: <path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />,
  },
  {
    label: 'Consultants',
    icon: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </>
    ),
  },
  {
    label: 'Photographers',
    icon: (
      <>
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
      </>
    ),
  },
  {
    label: 'Personal trainers',
    icon: (
      <>
        <line x1="8" y1="12" x2="16" y2="12" /><rect x="4" y="9" width="4" height="6" rx="1" /><rect x="16" y="9" width="4" height="6" rx="1" />
      </>
    ),
  },
  {
    label: 'Massage therapists',
    icon: (
      <>
        <circle cx="12" cy="5.5" r="2.2" /><ellipse cx="12" cy="13" rx="5.5" ry="2.6" /><ellipse cx="12" cy="18.5" rx="7.5" ry="2.4" />
      </>
    ),
  },
  {
    label: 'Music teachers',
    icon: (
      <>
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </>
    ),
  },
];
