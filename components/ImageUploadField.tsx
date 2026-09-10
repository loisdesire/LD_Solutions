'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Icon from './Icon';

// Replaces what used to be a raw "paste a URL" text input - nobody
// actually wants to host an image somewhere else first just to link it
// here. This uploads straight to the backend (/api/upload, which puts it
// in Supabase Storage) and hands back a real, working URL.
//
// Layout is the same shape for both variants now, confirmed live ("I
// dont like how they are positioned"): the image (or, when empty, a
// dashed upload prompt matching the Stitch Settings screen) sits in its
// own frame, and the Change / Remove controls sit UNDERNEATH it - not
// off to the right of the avatar the way they used to, which read as
// cramped and inconsistent with the banner below it.
export default function ImageUploadField({
  slug,
  value,
  onChange,
  shape = 'banner',
  label,
}: {
  slug: string;
  value: string | null;
  onChange: (url: string | null) => void;
  shape?: 'avatar' | 'banner';
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    // try/finally, because a network failure here used to throw straight
    // out of this function - setUploading(false) never ran and the
    // spinner sat on the image forever with no error and no way back.
    try {
      const res = await fetch(`/api/upload?slug=${slug}`, { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? 'Upload failed. Please try again.');
        return;
      }

      onChange(data.url);
    } catch {
      setError('Upload failed - check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets picking the same file again re-trigger onChange
    if (file) handleFile(file);
  }

  function pick() {
    inputRef.current?.click();
  }

  const frameSize = shape === 'avatar' ? 'h-24 w-24' : 'h-36 w-full max-w-md';
  const frameRadius = shape === 'avatar' ? 'rounded-2xl' : 'rounded-xl';

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleSelect}
        className="hidden"
      />

      {value ? (
        <div className={`relative overflow-hidden border border-line-strong bg-paper ${frameSize} ${frameRadius}`}>
          {/* `value` only ever holds the persisted URL /api/upload hands
              back once the upload finished - never a local blob: preview -
              so this is safe for next/image. */}
          <Image
            src={value}
            alt={`${label} preview`}
            fill
            sizes={shape === 'avatar' ? '96px' : '448px'}
            className="object-cover"
          />
          {uploading && <UploadingOverlay />}
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className={`relative flex flex-col items-center justify-center gap-1.5 border border-dashed border-line-strong bg-paper text-ink-faint transition-colors hover:border-accent hover:text-accent disabled:opacity-50 ${frameSize} ${frameRadius}`}
        >
          <Icon name="add_photo_alternate" size={shape === 'avatar' ? 20 : 24} />
          <span className="text-[12px] font-medium">Upload {label.toLowerCase()}</span>
          {uploading && <UploadingOverlay />}
        </button>
      )}

      {value && (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            className="inline-flex h-8 items-center rounded-md border border-line-strong px-3 text-[12.5px] font-semibold text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : `Change ${label.toLowerCase()}`}
          </button>
          {!uploading && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[12.5px] font-medium text-ink-faint hover:text-error transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      )}

      <p className="text-ink-faint text-[11.5px] mt-1.5">JPG, PNG, WEBP or GIF, up to 5MB.</p>
      {error && <p className="text-[12px] text-error mt-1">{error}</p>}
    </div>
  );
}

function UploadingOverlay() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
    >
      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
      </svg>
    </div>
  );
}
