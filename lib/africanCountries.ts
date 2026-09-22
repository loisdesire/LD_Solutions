// The 54 African Union member states, by ISO 3166-1 alpha-2 code -
// standard, stable reference data, not something that changes. Used only
// to decide which of the "other African country" vs "rest of world"
// subscription pricing tiers a business falls into (see
// lib/subscription.ts's getBillingTier). Nigeria and Ghana are included
// here for completeness of "is this an African country" as a fact, but
// they're checked for and handled as their own separate tiers BEFORE
// this list is ever consulted - see getBillingTier's own ordering.
export const AFRICAN_COUNTRY_CODES: ReadonlySet<string> = new Set([
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD',
  'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET',
  'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG',
  'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW',
  'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG',
  'TN', 'UG', 'ZM', 'ZW',
]);
