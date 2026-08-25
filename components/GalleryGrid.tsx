'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useDialog } from './useDialog';

// The gallery grid used to be click-nothing - a photo a customer wanted to
// actually look at only ever showed at the same small square-cropped size
// as every other thumbnail. This adds a simple full-screen lightbox with
// prev/next, no new data (there's no caption field on gallery_urls, so this
// stays image-only rather than inventing captions that don't exist).
export default function GalleryGrid({ images }: { images: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Was below an early return for `images.length === 0`, which meant this
  // hook simply never ran on that render - a real Rules of Hooks
  // violation (hook call order has to be identical on every render of a
  // given component instance), not just a lint nit. All hooks now run
  // unconditionally; the empty-gallery early return happens after.
  const dialogRef = useDialog(openIndex !== null, () => setOpenIndex(null));

  useEffect(() => {
    if (openIndex === null) return;
    // Escape is owned by useDialog now (it already closes on Escape and
    // traps focus/locks scroll while open) - this only needs to add the
    // arrow-key nav useDialog doesn't know about.
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setOpenIndex((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === 'ArrowLeft') setOpenIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIndex, images.length]);

  // A business with the section switched on but nothing uploaded yet used
  // to render a page titled "Gallery" over a blank grid - worse than not
  // shipping the section at all, since it looks broken rather than simply
  // sparse.
  if (images.length === 0) {
    return (
      <div className="border-2 border-dashed border-line-strong rounded-3xl py-14 text-center px-6">
        <p className="text-ink-soft text-[14px]">No photos here yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square rounded-2xl overflow-hidden bg-surface border-2 border-line transition-transform hover:scale-[1.02]"
          >
            <Image
              src={url}
              alt={`Gallery photo ${i + 1}`}
              fill
              sizes="(min-width: 640px) 33vw, 50vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 sm:p-10 animate-fade"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Close"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
                }}
                aria-label="Previous"
                className="absolute left-3 sm:left-6 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIndex((i) => (i === null ? i : (i + 1) % images.length));
                }}
                aria-label="Next"
                className="absolute right-3 sm:right-6 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}

          {/* Plain <img>, not next/image - it's a single on-demand image
              shown at whatever size fits the viewport (object-contain,
              no fixed box), opened synchronously on click rather than
              loaded ahead of time, so there's no real lazy-loading or
              CLS benefit to claim here, and forcing it into next/image's
              fill+sized-container shape would be churn for no gain. */}
          <img
            src={images[openIndex]}
            alt={`Gallery photo ${openIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}
