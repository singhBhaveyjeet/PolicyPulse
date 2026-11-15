"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, ArrowRight, Clock3, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import styles from "./AuthForm.module.css";
import { InlineSpinner } from "./Loading";

type AuthFormProps = { mode: "login" | "signup" | "recover" | "reset-password" };

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"form" | "google" | null>(null);
  const [validatingReset, setValidatingReset] = useState(false);
  const [cursor, setCursor] = useState({ x: -180, y: -180 });
  const isSignup = mode === "signup";
  const isRecovery = mode === "recover";
  const isReset = mode === "reset-password";

  useEffect(() => {
    const moveCursor = (event: MouseEvent) => setCursor({ x: event.clientX, y: event.clientY });
    window.addEventListener("mousemove", moveCursor);
    return () => window.removeEventListener("mousemove", moveCursor);
  }, []);

  useEffect(() => {
    if (!isReset || !isSupabaseConfigured()) return;
    let active = true;
    setValidatingReset(true);
    getSupabaseClient().auth.getUser().then(({ data, error: authError }) => {
      if (active && (authError || !data.user)) setError("This password-reset link is invalid or has expired. Request a new one.");
    }).catch((authError: unknown) => {
      if (active) setError(authError instanceof Error ? authError.message : "Could not verify the reset link.");
    }).finally(() => { if (active) setValidatingReset(false); });
    return () => { active = false; };
  }, [isReset]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPending("form");

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
        router.replace("/dashboard");
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
      setPending(null);
    }
  }

  async function signInWithGoogle() {
    setError("");
    setNotice("");
    setPending("google");
    try {
      const { error: authError } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Google sign-in could not be started.");
      setPending(null);
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
  const welcomeEyebrow = isSignup
    ? "A CLEARER WAY TO WORK STARTS HERE"
    : isRecovery || isReset
      ? "WE'RE HERE TO HELP"
      : "WELCOME BACK";
  const welcomeTitle = isSignup
    ? <>Bring your policies<br />into <span>a clearer view.</span></>
    : isRecovery || isReset
      ? <>Let’s get you<br /><span>back on track.</span></>
      : <>Welcome back to<br /><span>your clear picture.</span></>;
  const welcomeDescription = isSignup
    ? "Register with PolicyPulse to bring your insurance spreadsheets, customer details and renewal actions together in one organized workspace."
    : isRecovery || isReset
      ? "Your PolicyPulse workspace is just a step away. Securely restore access and pick up where you left off."
      : "Your insurance workflow, all in one place. Sign in to review policies, spot upcoming renewals and find customer details faster.";

  return (
    <main className={styles.page}>
      <div
        className={styles.cursorGlow}
        style={{ transform: `translate3d(${cursor.x - 180}px, ${cursor.y - 180}px, 0)` }}
        aria-hidden="true"
      />
      <div className={styles.noise} aria-hidden="true" />
      <div className={styles.backdrop} aria-hidden="true" />
      <Link href="/" className={styles.backLink}><ArrowLeft size={15} /> Back to PolicyPulse</Link>
      <div className={styles.content}>
        <aside className={styles.welcomePanel}>
          <div className={styles.welcomeCopy}>
            <span className={styles.eyebrow}><span className={styles.liveDot} /> {welcomeEyebrow}</span>
            <h1>{welcomeTitle}</h1>
            <p>{welcomeDescription}</p>
          </div>
          <div className={styles.valueList}>
            <div className={styles.valueItem}><span><FileSpreadsheet size={17} /></span><div><strong>Your sheets, together</strong><small>One organized view of your portfolio</small></div></div>
            <div className={styles.valueItem}><span><Clock3 size={17} /></span><div><strong>Renewals, in view</strong><small>Know what needs your attention next</small></div></div>
            <div className={styles.valueItem}><span><Activity size={17} /></span><div><strong>Details, without the hunt</strong><small>Find policy information when you need it</small></div></div>
          </div>
          <div className={styles.welcomeFoot}><ShieldCheck size={15} /> Designed for a more confident insurance workflow</div>
        </aside>

        <section className={styles.card}>
          <Link href="/" className={styles.brand} aria-label="PolicyPulse home">
            <img src="/policypulse-logo.png" alt="PolicyPulse logo" className={styles.logoImage} />
          </Link>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>{isSignup ? "CREATE YOUR WORKSPACE" : isRecovery || isReset ? "ACCOUNT ACCESS" : "YOUR WORKSPACE AWAITS"}</span>
            <h2>{title}</h2>
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
            {validatingReset && <p className={styles.notice} role="status"><InlineSpinner /> Verifying reset link…</p>}
            {!isSupabaseConfigured() && <p className={styles.error} role="alert">Supabase is not configured. Add your project URL and publishable key to <code>.env.local</code>, then restart the app.</p>}
            <button type="submit" className={styles.submit} disabled={pending !== null || validatingReset || !isSupabaseConfigured()}>
              {pending === "form" && <InlineSpinner />}
              {pending === "form" ? "Please wait…" : isReset ? "Update password" : isRecovery ? "Send reset link" : isSignup ? "Create account" : "Sign in"} {!pending && <ArrowRight size={16} />}
            </button>
          </form>

          {(mode === "login" || mode === "signup") && <>
            <div className={styles.divider}><span>or</span></div>
            <button type="button" className={styles.googleButton} onClick={signInWithGoogle} disabled={pending !== null || !isSupabaseConfigured()}>
              {pending === "google" && <InlineSpinner />}<span aria-hidden="true">G</span> {pending === "google" ? "Connecting to Google…" : "Continue with Google"}
            </button>
          </>}

          {mode === "login" && <p className={styles.switchMode}><Link href="/auth/recover">Forgot password?</Link></p>}
          {!isReset && <p className={styles.switchMode}>
            {isSignup ? "Already have an account?" : "New to PolicyPulse?"}{" "}
            <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create account"}</Link>
          </p>}
        </section>
      </div>
      <p className={styles.footer}>Your workspace is stored in your configured Supabase project. Review access controls and privacy settings before uploading real client records.</p>
    </main>
  );
}
