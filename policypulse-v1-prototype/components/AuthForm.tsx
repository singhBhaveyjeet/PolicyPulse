"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { startDemoSession } from "@/lib/demo-auth";
import styles from "./AuthForm.module.css";

type AuthFormProps = { mode: "login" | "signup" };

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const isSignup = mode === "signup";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      startDemoSession(email);
      router.replace("/dashboard");
    } catch {
      setError("Demo access could not be started in this browser. Check your browser storage settings and try again.");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <Link href="/" className={styles.backLink}><ArrowLeft size={15} /> Back to PolicyPulse</Link>
      <section className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="PolicyPulse home">
          <span className={styles.brandMark}><Activity size={19} strokeWidth={2.5} /></span>
          <span>Policy<span>Pulse</span></span>
        </Link>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>POLICYPULSE DEMO</span>
          <h1>{isSignup ? "Create your demo access" : "Welcome back"}</h1>
          <p>{isSignup ? "Set up a browser-only session to explore the workspace." : "Sign in to continue to your PolicyPulse demo workspace."}</p>
        </div>

        <div className={styles.authNotice}>
          <ShieldCheck size={17} />
          <p><strong>Prototype access only.</strong> Passwords are checked for length, never stored or verified. Use synthetic data and a demo-only password.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Demo password
            <input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} placeholder="At least 8 characters" required minLength={8} />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.submit}>
            {isSignup ? "Create demo access" : "Continue to workspace"} <ArrowRight size={16} />
          </button>
        </form>

        <p className={styles.switchMode}>
          {isSignup ? "Already explored PolicyPulse?" : "New to PolicyPulse?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create demo access"}</Link>
        </p>
      </section>
      <p className={styles.footer}>No account is created. Demo access lasts for this browser tab only.</p>
    </main>
  );
}
