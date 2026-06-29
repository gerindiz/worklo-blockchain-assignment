'use client';
import { apiFetch } from '@/lib/api-config';
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { RoleSelectLogin } from '@/components/role-select-login';
import { EmailPasswordLogin } from '@/components/email-password-login';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function Page() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const supabaseReady = isSupabaseConfigured();
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  useEffect(() => {
    if (!supabaseReady) return;
    apiFetch('/api/onboarding/check-first-run')
      .then((res) => res.json())
      .then((data) => {
        if (data.firstRun) {
          router.replace('/onboarding');
        }
      })
      .catch(() => {});
  }, [router, supabaseReady]);

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (userProfile && (userProfile as any).is_client) {
        router.replace('/client-portal');
      } else {
        router.replace('/welcome');
      }
    }
  }, [user, userProfile, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-[#080B0F] p-6 md:p-10">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[#00C2A8]"></div>
          <p className="mt-3 text-sm text-[#8B9BB4]">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-[#080B0F] p-6 md:p-10">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[#00C2A8]"></div>
          <p className="mt-3 text-sm text-[#8B9BB4]">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-bg flex min-h-svh w-full items-center justify-center bg-[#080B0F] p-6 md:p-10">
      <div className="w-full max-w-md">
        {!supabaseReady && (
          <div className="mb-6 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
            <h2 className="mb-2 text-sm font-semibold text-yellow-400">Database Not Connected</h2>
            <p className="text-sm text-yellow-400/70">Supabase is not configured.</p>
          </div>
        )}
        <Suspense fallback={<div className="text-sm text-[#8B9BB4]">Loading...</div>}>
          {demoMode ? <RoleSelectLogin /> : <EmailPasswordLogin />}
        </Suspense>
      </div>
    </div>
  );
}