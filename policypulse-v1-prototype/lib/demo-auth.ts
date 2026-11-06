const SESSION_KEY = "policypulse.demo.email";

export function getDemoSession(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SESSION_KEY);
}

export function startDemoSession(email: string): void {
  window.sessionStorage.setItem(SESSION_KEY, email.trim().toLowerCase());
}

export function endDemoSession(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
}
