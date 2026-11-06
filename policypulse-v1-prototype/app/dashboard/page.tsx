"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PolicyPulseApp from "@/components/PolicyPulseApp";
import { endDemoSession, getDemoSession } from "@/lib/demo-auth";
import "./dashboard.css";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const activeEmail = getDemoSession();
    if (!activeEmail) {
      router.replace("/login");
      return;
    }
    setEmail(activeEmail);
  }, [router]);

  if (!email) return <main className="auth-loading" aria-live="polite">Opening your demo workspace…</main>;
  return <PolicyPulseApp userEmail={email} onSignOut={() => { endDemoSession(); router.replace("/login"); }} />;
}
