// The identity behind "See the dashboard" on the marketing homepage - a
// real Supabase Auth user, with a real `staff` row (role: owner) on the
// demo business (see DEMO_SLUG in lib/site.ts). That's deliberate: a
// visitor gets the genuine app - real sidebar, real data, every screen an
// owner sees - not a cut-down mockup that drifts out of sync with the real
// admin over time.
//
// The one thing different about this identity is that every write it
// attempts is rejected, two layers deep:
//   1. requireStaffApiSession auto-rejects any non-GET request from this
//      user id, in the one place ~13 admin API routes all share.
//   2. A handful of admin screens write straight from the browser to
//      Supabase, bypassing API routes entirely - a Postgres trigger
//      (reject_demo_viewer_writes, see supabase/schema.sql) rejects those
//      at the database itself, so there's no path around it even for
//      someone calling Supabase directly from devtools.
// Both rejections raise a real, readable message, which surfaces through
// error-handling code every form in the admin already has - no need to
// special-case every Save button individually.
//
// Created via a one-off setup script (not checked in - see git history on
// this file's date), not through the normal signup flow, since it isn't a
// real business owner.
export const DEMO_VIEWER_AUTH_ID = '8b3df1a8-a927-47b1-bc33-f948ca9afd9c';
export const DEMO_VIEWER_EMAIL = 'demo-viewer@vanovahub.internal';
