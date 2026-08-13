'use client';

import { useRef, useState } from 'react';

// Replaces what used to be a raw "paste a URL" text input — nobody
// actually wants to host an image somewhere else first just to link it
// here. This uploads straight to the backend (/api/upload, which puts it
// in Supabase Storage) and hands back a real, working URL, same as any
// normal "upload a photo" control.
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

    const res = await fetch(`/api/upload?slug=${slug}`, { method: 'POST', body: formData });
    const data = await res.json();

    setUploading(false);

    if (!res.ok) {
      setError(data.error ?? 'Upload failed. Please try again.');
      return;
    }

    onChange(data.url);
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets picking the same file again re-trigger onChange
    if (file) handleFile(file);
  }

  const previewClass =
    shape === 'avatar'
      ? 'h-16 w-16 rounded-2xl'
      : 'h-32 w-full rounded-xl';

  return (
    <div className={shape === 'avatar' ? 'flex items-center gap-4' : ''}>
      <div className={`relative shrink-0 overflow-hidden border-2 border-line-strong bg-paper ${previewClass} ${shape === 'banner' ? 'mb-2' : ''}`}>
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-ink-faint">
            <svg width={shape === 'avatar' ? 20 : 26} height={shape === 'avatar' ? 20 : 26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.5" />
              <path d="M21 15l-5-5-9 9" />
            </svg>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-ink/40 flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          </div>
        )}
      </div>

      <div className={shape === 'avatar' ? 'flex-1' : ''}>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleSelect} className="hidden" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-xl border-2 border-line-strong px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : value ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          </button>
          {value && !uploading && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[12.5px] font-medium text-ink-faint hover:text-red-600 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-ink-faint text-[11.5px] mt-1.5">JPG, PNG, WEBP, or GIF — up to 5MB.</p>
        {error && <p className="text-[12px] text-red-600 mt-1">{error}</p>}
      </div>
    </div>
  );
}
