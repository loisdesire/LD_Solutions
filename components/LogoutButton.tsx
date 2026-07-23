'use client';

import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push('/account/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-[13px] font-medium text-ink-faint hover:text-ink transition-colors"
    >
      Log out
    </button>
  );
}
