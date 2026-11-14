"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PolicyPulseApp from "@/components/PolicyPulseApp";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
// @ts-ignore Next.js processes this global stylesheet import at build time.
import "./dashboard.css";

export default function DashboardPage() {
  const router = useRouter();
  const [account, setAccount] = useState<{ id: string; email: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured. Add the project URL and publishable key to .env.local, then restart the app.");
      return;
    }
    const supabase = getSupabaseClient();
    let active = true;
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError || !data.user) {
        router.replace("/login");
        return;
      }
      setAccount({ id: data.user.id, email: data.user.email ?? "" });
    }).catch((authError: unknown) => {
      if (active) setError(authError instanceof Error ? authError.message : "Could not verify your session.");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setAccount(null);
        router.replace("/login");
      } else {
        setAccount({ id: session.user.id, email: session.user.email ?? "" });
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [router]);

  async function signOut() {
    const { error: authError } = await getSupabaseClient().auth.signOut();
    if (authError) {
      setError(`Could not sign out: ${authError.message}`);
      return;
    }
    router.replace("/login");
  }

  if (error) return <main className="auth-loading" role="alert">{error} <a href="/login">Return to sign in</a></main>;
  if (!account) return <main className="auth-loading" aria-live="polite">Opening your workspace…</main>;
  return <PolicyPulseApp key={account.id} userId={account.id} userEmail={account.email} onSignOutAction={signOut} />;
}
