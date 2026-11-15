"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PolicyPulseApp from "@/components/PolicyPulseApp";
import { LoadingScreen } from "@/components/Loading";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
// @ts-ignore Next.js processes this global stylesheet import at build time.
import "./dashboard.css";

export default function DashboardPage() {
  const router = useRouter();
  const [account, setAccount] = useState<{ id: string; email: string } | null>(null);
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setAuthLoading(true);
    setError("");
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured. Add the project URL and publishable key to .env.local, then restart the app.");
      setAuthLoading(false);
      return () => { active = false; };
    }
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setAccount(null);
        router.replace("/login");
      } else {
        setAccount({ id: session.user.id, email: session.user.email ?? "" });
        setAuthLoading(false);
      }
    });
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError) throw authError;
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setAccount({ id: data.user.id, email: data.user.email ?? "" });
    }).catch((authError: unknown) => {
      if (active) setError(authError instanceof Error ? authError.message : "Could not verify your session.");
    }).finally(() => {
      if (active) setAuthLoading(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [router, retryCount]);

  function retryAuthentication() {
    setAccount(null);
    setError("");
    setAuthLoading(true);
    setRetryCount((count) => count + 1);
  }

  async function signOut() {
    const { error: authError } = await getSupabaseClient().auth.signOut();
    if (authError) throw new Error(`Could not sign out: ${authError.message}`);
    router.replace("/login");
  }

  if (authLoading) return <LoadingScreen message="Verifying your PolicyPulse session…" />;
  if (error) return <LoadingScreen message="Your workspace is waiting." error={`${error} Check your connection or Supabase configuration, then retry.`} onRetryAction={retryAuthentication} />;
  if (!account) return <LoadingScreen message="Redirecting to sign in…" />;
  return <PolicyPulseApp key={account.id} userId={account.id} userEmail={account.email} onSignOutAction={signOut} />;
}
