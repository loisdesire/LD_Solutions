'use client';

import { useEffect, useRef, useState } from 'react';

// Lightweight scroll-triggered fade/slide-in, no animation library needed -
// this is the only page in the app that wants scroll-linked motion, so a
// small IntersectionObserver wrapper is enough rather than a new dependency.
//
// `eager` opts a usage out of the scroll trigger entirely. Content starts
// at opacity-0 by default (both in the server-rendered HTML and on first
// client paint) and only becomes visible once the IntersectionObserver's
// first callback fires after mount - for anything already in the initial
// viewport (the hero, above the fold) that reads as the page loading
// blank for a beat. Pass `eager` there: it skips the observer and the
// opacity/transform state altogether, so that content is just there on
// first paint like everything not wrapped in Reveal. Scroll-triggered
// reveal stays the default for below-the-fold sections, where it's a
// deliberate effect rather than a loading artifact.
export default function Reveal({
  children,
  delay = 0,
  className = '',
  eager = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (eager) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager]);

  if (eager) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}
