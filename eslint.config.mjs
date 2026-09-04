import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// next/core-web-vitals + next/typescript - Next's own recommended set
// (React hooks rules, a11y, import hygiene, the Core Web Vitals checks,
// plus TS-aware rules), same as what `next lint`'s "Strict" wizard
// option would have generated. Nothing project-specific overridden yet -
// see what real findings look like before deciding what's worth a rule
// tweak versus a real fix.
const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // next-env.d.ts is Next's own generated file (never hand-edited, and
    // its triple-slash reference is the correct form for it regardless
    // of what the TS rule below says). "landing page/" is an untracked,
    // gitignored scaffold sitting locally in this checkout - not part of
    // the real app, never built or deployed - so it has no business
    // being linted as if it were.
    // *.cjs at the root: untracked, one-off local scratch scripts (not
    // part of the app - `git ls-files` confirms none of these are
    // committed), legitimately using require() the way a plain Node
    // script is supposed to.
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'landing page/**', '*.cjs'],
  },
  {
    rules: {
      // Only flag a destructuring `let` if EVERY bound name in it is
      // genuinely never reassigned - the default ('any') flags the whole
      // declaration the moment one sibling binding isn't, which is a real
      // false positive against a pattern used deliberately in a few
      // places here (`let { data, error } = await query(); ... data =
      // fallback` a few lines later) - `error` alone never being
      // reassigned doesn't mean the declaration can become `const`.
      'prefer-const': ['error', { destructuring: 'all' }],
      // First real lint pass on a codebase that had none: ~90 existing
      // hits between these two rules (mostly deliberate `any` at
      // external-API/error boundaries, and straight apostrophes in
      // marketing/legal copy) would otherwise fail every build right out
      // of the gate. Kept as warnings so they stay visible for real
      // cleanup rather than hidden, without turning "add a lint config"
      // into "rewrite ~90 unrelated lines under time pressure."
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
];

export default eslintConfig;
