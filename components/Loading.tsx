"use client";

import type { ReactNode } from "react";

export function InlineSpinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`pp-inline-spinner ${className}`} role={label ? "status" : undefined} aria-label={label}>
      <i aria-hidden="true" />
      {label && <span className="pp-sr-only">{label}</span>}
    </span>
  );
}

export function BrandLoader({ message }: { message: string }) {
  return (
    <div className="pp-brand-loader" role="status" aria-live="polite">
      <div className="pp-brand-mark">
        <span className="pp-brand-ring" aria-hidden="true" />
        <img src="/policypulse-logo.png" alt="" />
      </div>
      <strong>PolicyPulse</strong>
      <span>{message}</span>
      <div className="pp-loader-dots" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}

export function LoadingScreen({
  message,
  error,
  onRetryAction,
}: {
  message: string;
  error?: string;
  onRetryAction?: () => void;
}) {
  return (
    <main className="pp-loading-screen" data-theme="light" aria-busy={!error}>
      <div className="pp-loading-card">
        {error ? (
          <div className="pp-brand-loader pp-brand-loader-error">
            <div className="pp-brand-mark"><img src="/policypulse-logo.png" alt="" /></div>
            <strong>PolicyPulse</strong>
          </div>
        ) : <BrandLoader message={message} />}
        {error && (
          <div className="pp-loading-error" role="alert">
            <p>{error}</p>
            {onRetryAction && <button className="btn primary" onClick={onRetryAction}>Try again</button>}
          </div>
        )}
      </div>
    </main>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <i className={`pp-skeleton-line ${className}`} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="pp-skeleton-card">
      <SkeletonLine className="short" />
      <SkeletonLine className="value" />
      <SkeletonLine className="medium" />
    </div>
  );
}

export function SkeletonChart({ className = "" }: { className?: string }) {
  return (
    <div className={`pp-skeleton-chart ${className}`} aria-hidden="true">
      <div className="pp-skeleton-chart-bars">{[48, 72, 38, 84, 57, 68, 42, 76].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
      <div className="pp-skeleton-chart-labels">{Array.from({ length: 6 }, (_, index) => <SkeletonLine key={index} />)}</div>
    </div>
  );
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="pp-skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index}><SkeletonLine /><SkeletonLine /><SkeletonLine /><SkeletonLine /></div>
      ))}
    </div>
  );
}

function SkeletonPanel({ title, children }: { title: string; children?: ReactNode }) {
  return <section className="pp-skeleton-panel"><SkeletonLine className="panel-title" /><span className="pp-sr-only">{title}</span>{children}</section>;
}

export function WorkspaceSkeleton({
  message,
  error,
  onRetryAction,
}: {
  message: string;
  error?: string;
  onRetryAction?: () => void;
}) {
  return (
    <main className="pp-workspace-loading" aria-busy={!error} aria-label={error ? "Workspace failed to load" : message}>
      <header className="pp-workspace-loading-header">
        <img src="/policypulse-logo.png" alt="PolicyPulse" />
        {!error && <span>{message}</span>}
        {!error && <InlineSpinner label="Loading workspace" />}
      </header>
      <div className="pp-workspace-loading-body">
        <aside className="pp-skeleton-sidebar" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((index) => <SkeletonLine key={index} />)}
        </aside>
        <div className="pp-workspace-skeleton-content">
          {error ? (
            <div className="pp-loading-error workspace-error" role="alert">
              <strong>We couldn’t load your workspace.</strong>
              <p>{error}</p>
              {onRetryAction && <button className="btn primary" onClick={onRetryAction}>Retry loading</button>}
            </div>
          ) : (
            <>
              <section className="pp-skeleton-kpis" aria-label="Portfolio summary loading">
                {[0, 1, 2, 3].map((index) => <SkeletonCard key={index} />)}
              </section>
              <SkeletonPanel title="Premium at risk summary loading"><div className="pp-skeleton-risk">{[0, 1, 2, 3].map((index) => <SkeletonCard key={index} />)}</div></SkeletonPanel>
              <SkeletonPanel title="Priority renewals loading"><SkeletonTable rows={5} /></SkeletonPanel>
              <section className="pp-skeleton-grid">
                <SkeletonPanel title="Monthly renewal opportunity chart loading"><SkeletonChart /></SkeletonPanel>
                <SkeletonPanel title="Insurer distribution chart loading"><SkeletonChart className="donut" /></SkeletonPanel>
                <SkeletonPanel title="Policy type distribution chart loading"><SkeletonChart className="donut" /></SkeletonPanel>
                <SkeletonPanel title="Renewal performance chart loading"><SkeletonChart /></SkeletonPanel>
              </section>
              <section className="pp-skeleton-grid">
                <SkeletonPanel title="Top customers loading"><SkeletonTable rows={5} /></SkeletonPanel>
                <SkeletonPanel title="Actionable business insights loading"><div className="pp-skeleton-insights">{[0, 1, 2, 3].map((index) => <SkeletonLine key={index} />)}</div></SkeletonPanel>
              </section>
              <SkeletonPanel title="Recent activity and policy table loading"><SkeletonTable rows={3} /></SkeletonPanel>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
