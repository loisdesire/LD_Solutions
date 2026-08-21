import Skeleton from '@/components/Skeleton';

// Every admin page is a server component that queries Supabase before it can
// render, and there was no loading.tsx anywhere in the app - so switching
// tabs did nothing visible at all until the query came back and the whole
// page appeared at once. The navigation was not especially slow; it just
// gave no sign it had started, which reads as frozen.
//
// One file at the /admin segment covers every nested admin route, because
// Next uses the nearest ancestor loading.tsx as the Suspense fallback. The
// shell (sidebar, mobile nav) stays put and only this region swaps, so the
// tab change registers instantly.
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="mb-6">
        <Skeleton className="h-3 w-16 rounded-full mb-2.5" />
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-3.5 w-64 rounded-full mt-2.5" delay={0.05} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" delay={i * 0.06} />
        ))}
      </div>

      <div className="border-2 border-line rounded-2xl overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`px-4 py-4 ${i !== 4 ? 'border-b border-line' : ''}`}>
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" delay={i * 0.07} />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-3.5 w-1/3 rounded-full" delay={i * 0.07} />
                <Skeleton className="h-3 w-1/2 rounded-full mt-2" delay={i * 0.07 + 0.03} />
              </div>
              <Skeleton className="h-6 w-16 rounded-full shrink-0" delay={i * 0.07} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
