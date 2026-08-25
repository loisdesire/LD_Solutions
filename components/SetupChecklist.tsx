'use client';

import { useState } from 'react';
import Link from 'next/link';

type Step = {
  key: string;
  title: string;
  blurb: string;
  href: string;
  done: boolean;
  optional?: boolean;
};

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// First five minutes after signup, made visible on the one screen every
// new business actually lands on. Disappears entirely once the required
// steps (profile, services, hours) are done - an established business
// shouldn't carry permanent onboarding chrome on a screen it opens every
// day. Payment is listed but never counts toward "done": not every
// business takes deposits, so it can't gate the checklist away.
export default function SetupChecklist({
  slug,
  profileDone,
  servicesDone,
  hoursDone,
  paymentDone,
}: {
  slug: string;
  profileDone: boolean;
  servicesDone: boolean;
  hoursDone: boolean;
  paymentDone: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const requiredSteps: Step[] = [
    {
      key: 'profile',
      title: 'Add your business profile',
      blurb: 'A description, logo and cover photo so your page looks like you, not a placeholder.',
      href: `/${slug}/admin/settings?section=profile`,
      done: profileDone,
    },
    {
      key: 'services',
      title: 'Add what you offer',
      blurb: 'At least one bookable service, with a price and duration.',
      href: `/${slug}/admin/services`,
      done: servicesDone,
    },
    {
      key: 'hours',
      title: 'Set your hours',
      blurb: "When you're open decides what times customers can even pick.",
      href: `/${slug}/admin/hours`,
      done: hoursDone,
    },
  ];

  const requiredDone = requiredSteps.every((s) => s.done);
  if (requiredDone) return null;

  const doneCount = requiredSteps.filter((s) => s.done).length;

  const steps: Step[] = [
    ...requiredSteps,
    {
      key: 'payment',
      title: 'Connect payments',
      blurb: 'Take a deposit or full payment at booking time. Skip this if you collect payment in person.',
      href: `/${slug}/admin/settings?section=rules`,
      done: paymentDone,
      optional: true,
    },
  ];

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Deliberately lighter than NextAppointmentCard below it - no shadow,
  // warm-surface instead of white - this is a temporary onboarding nudge
  // (it disappears entirely once done), not today's actual content, and
  // shouldn't visually compete with the real work item on the same page.
  return (
    <div className="rounded-2xl bg-warm-surface border border-line mb-8 overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display text-[17px] font-semibold text-ink">Get your booking page ready</h2>
            <p className="text-caption text-ink-soft mt-0.5">
              {doneCount} of {requiredSteps.length} done - customers can't book until all three are set.
            </p>
          </div>
          <div className="h-1.5 w-28 rounded-full bg-line shrink-0 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(doneCount / requiredSteps.length) * 100}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>
      </div>

      <div className="px-5">
        {steps.map((step) => (
          <div key={step.key} className="flex items-start gap-3.5 py-4 border-t border-line">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                step.done ? 'text-white' : 'border-2 border-line-strong'
              }`}
              style={step.done ? { background: 'var(--success)' } : undefined}
              aria-hidden="true"
            >
              {step.done && <CheckIcon />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[14px] text-ink">{step.title}</span>
                {step.optional && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">Optional</span>
                )}
              </div>
              <p className="text-caption text-ink-soft mt-0.5">{step.blurb}</p>
            </div>
            <Link
              href={step.href}
              className="shrink-0 rounded-full border border-line-strong px-3.5 py-2 min-h-[36px] flex items-center text-caption font-medium text-ink hover:border-accent hover:text-accent transition-colors"
            >
              {step.done ? 'Edit' : 'Set up'}
            </Link>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-line bg-warm-surface flex flex-wrap items-center gap-3">
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-caption font-semibold hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Preview your page
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M7 17L17 7M8 7h9v9" /></svg>
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="text-caption font-medium text-ink-faint hover:text-ink transition-colors"
        >
          {copied ? 'Link copied' : 'Copy booking link'}
        </button>
      </div>
    </div>
  );
}
