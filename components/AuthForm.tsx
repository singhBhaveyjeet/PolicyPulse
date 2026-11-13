"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import styles from "./AuthForm.module.css";

type AuthFormProps = { mode: "login" | "signup" | "recover" | "reset-password" };

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";
  const isRecovery = mode === "recover";
  const isReset = mode === "reset-password";

  useEffect(() => {
    if (!isReset || !isSupabaseConfigured()) return;
    getSupabaseClient().auth.getUser().then(({ data, error: authError }) => {
      if (authError || !data.user) setError("This password-reset link is invalid or has expired. Request a new one.");
    }).catch((authError: unknown) => setError(authError instanceof Error ? authError.message : "Could not verify the reset link."));
  }, [isReset]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPending(true);

    try {
      const supabase = getSupabaseClient();
      if (isRecovery) {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (authError) throw authError;
        setNotice("If an account exists for that email, a password-reset link is on its way.");
      } else if (isReset) {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setNotice("Your password has been updated. Taking you to your workspace…");
        window.setTimeout(() => router.replace("/dashboard"), 900);
      } else if (isSignup) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (authError) throw authError;
        if (data.session) router.replace("/dashboard");
        else setNotice("Check your email to confirm your account, then sign in.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace("/dashboard");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function signInWithGoogle() {
    setError("");
    setNotice("");
    setPending(true);
    try {
      const { error: authError } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Google sign-in could not be started.");
      setPending(false);
    }
  }

  const title = isReset ? "Choose a new password" : isRecovery ? "Reset your password" : isSignup ? "Create your account" : "Welcome back";
  const description = isReset
    ? "Choose a new password for your PolicyPulse account."
    : isRecovery
      ? "We’ll email you a secure link to reset your password."
      : isSignup
        ? "Create an account to keep your agency workspace synced and private."
        : "Sign in to continue to your PolicyPulse workspace.";

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
          <span className={styles.eyebrow}>POLICYPULSE</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className={styles.authNotice}>
          <ShieldCheck size={17} />
          <p><strong>Protected workspace.</strong> Sign-in is handled by Supabase Auth. Workspace access is restricted by your project’s row-level security policies.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {!isReset && <label>
            Email address
            <input name="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>}
          {!isRecovery && <label>
            {isReset ? "New password" : "Password"}
            <input name="password" type="password" autoComplete={isReset || isSignup ? "new-password" : "current-password"} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </label>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          {!isSupabaseConfigured() && <p className={styles.error} role="alert">Supabase is not configured. Add your project URL and publishable key to <code>.env.local</code>, then restart the app.</p>}
          <button type="submit" className={styles.submit} disabled={pending || !isSupabaseConfigured()}>
            {pending ? "Please wait…" : isReset ? "Update password" : isRecovery ? "Send reset link" : isSignup ? "Create account" : "Sign in"} {!pending && <ArrowRight size={16} />}
          </button>
        </form>

        {(mode === "login" || mode === "signup") && <>
          <div className={styles.divider}><span>or</span></div>
          <button type="button" className={styles.googleButton} onClick={signInWithGoogle} disabled={pending || !isSupabaseConfigured()}>
            <span aria-hidden="true">G</span> Continue with Google
          </button>
        </>}

        {mode === "login" && <p className={styles.switchMode}><Link href="/auth/recover">Forgot password?</Link></p>}
        {!isReset && <p className={styles.switchMode}>
          {isSignup ? "Already have an account?" : "New to PolicyPulse?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create account"}</Link>
        </p>}
      </section>
      <p className={styles.footer}>Your workspace is stored in your configured Supabase project. Do not upload real client records until your project’s access controls and privacy settings are reviewed.</p>
    </main>
  );
}
