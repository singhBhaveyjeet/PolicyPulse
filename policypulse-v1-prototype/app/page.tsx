"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  Activity,
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  Fingerprint,
  Menu,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UploadCloud,
  X,
} from "lucide-react";
import styles from "./page.module.css";

export default function HomePage() {
  const [cursor, setCursor] = useState({ x: -200, y: -200 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "renewals">("overview");

  useEffect(() => {
    const moveCursor = (event: MouseEvent) => {
      setCursor({ x: event.clientX, y: event.clientY });
    };

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll("[data-reveal]").forEach((element) => {
      revealObserver.observe(element);
    });

    window.addEventListener("mousemove", moveCursor);
    return () => {
      window.removeEventListener("mousemove", moveCursor);
      revealObserver.disconnect();
    };
  }, []);

  return (
    <main className={styles.site}>
      <div
        className={styles.cursorGlow}
        style={{ transform: `translate3d(${cursor.x - 180}px, ${cursor.y - 180}px, 0)` }}
        aria-hidden="true"
      />
      <div className={styles.noise} aria-hidden="true" />

      <header className={styles.nav}>
        <a className={styles.brand} href="#top" aria-label="PolicyPulse home">
          <span className={styles.brandMark}><Activity size={19} strokeWidth={2.5} /></span>
          <span>Policy<span className={styles.brandAccent}>Pulse</span></span>
        </a>

        <nav className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ""}`}>
          <a href="#platform" onClick={() => setMenuOpen(false)}>Platform</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#security" onClick={() => setMenuOpen(false)}>Security</a>
        </nav>

        <div className={styles.navActions}>
          <a className={styles.signIn} href="/dashboard">Open workspace <ArrowRight size={15} /></a>
          <button className={styles.menuButton} onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span className={styles.liveDot} /> THE SMARTER WAY TO MANAGE POLICIES</div>
          <h1>Every policy.<br />One <span className={styles.gradientText}>clear picture.</span></h1>
          <p className={styles.heroDescription}>
            Turn scattered insurance spreadsheets into a live, organised view of your portfolio.
            Catch renewals early. Find customer details fast. Stay one step ahead.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="/dashboard">Explore PolicyPulse <ArrowRight size={17} /></a>
            <a className={styles.textButton} href="#how-it-works">See how it works <ArrowDownRight size={17} /></a>
          </div>
          <div className={styles.trustLine}>
            <div className={styles.avatarStack}>
              <span>PP</span><span>IN</span><span>✓</span>
            </div>
            <p><strong>Built for clarity.</strong><br /><span>Designed around your existing spreadsheets.</span></p>
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="Preview of the PolicyPulse dashboard">
          <div className={`${styles.orbit} ${styles.orbitOne}`} />
          <div className={`${styles.orbit} ${styles.orbitTwo}`} />
          <div className={styles.floatTag}><span className={styles.floatIcon}><BellRing size={15} /></span><span><strong>Renewal alert</strong><small>5 days remaining</small></span><span className={styles.alertPing} /></div>
          <div className={styles.dashboardCard}>
            <div className={styles.cardTop}>
              <div><span className={styles.miniLabel}>YOUR PORTFOLIO</span><h3>Good morning <span>✳</span></h3></div>
              <div className={styles.profile}>PP</div>
            </div>
            <div className={styles.metricGrid}>
              <div className={styles.metricCard}><span>Total policies</span><strong>1,284</strong><small className={styles.positive}><TrendingUp size={12} /> Portfolio overview</small></div>
              <div className={styles.metricCard}><span>Due this month</span><strong>28</strong><small className={styles.warningText}><Clock3 size={12} /> Action needed</small></div>
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}><span>Policy activity</span><span className={styles.chartPeriod}>Last 6 months⌄</span></div>
              <div className={styles.chartArea}>
                <div className={styles.chartLines}><i /><i /><i /><i /></div>
                <svg viewBox="0 0 440 112" preserveAspectRatio="none" className={styles.chartSvg} role="img" aria-label="Illustrative rising policy activity chart">
                  <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#55e0c0" stopOpacity=".28" /><stop offset="100%" stopColor="#55e0c0" stopOpacity="0" /></linearGradient></defs>
                  <path d="M0 88 C35 84 35 64 72 72 S115 91 145 59 S190 70 218 47 S263 58 292 34 S337 48 367 23 S410 30 440 8 L440 112 L0 112 Z" fill="url(#chartFill)" />
                  <path d="M0 88 C35 84 35 64 72 72 S115 91 145 59 S190 70 218 47 S263 58 292 34 S337 48 367 23 S410 30 440 8" fill="none" stroke="#55e0c0" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="367" cy="23" r="5" fill="#101f2a" stroke="#75f0d1" strokeWidth="3" />
                </svg>
              </div>
              <div className={styles.chartMonths}><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div>
            </div>
            <div className={styles.tablePreview}>
              <div className={styles.tableTitle}>Upcoming renewals <span>View all <ChevronRight size={12} /></span></div>
              <div className={styles.policyRow}><span className={styles.companyIcon}>A</span><span className={styles.policyName}>Aarav Mehta<small>Health · PP-2048</small></span><span className={styles.dueBadge}>In 2 days</span></div>
              <div className={styles.policyRow}><span className={`${styles.companyIcon} ${styles.companyIconBlue}`}>S</span><span className={styles.policyName}>Simran Kaur<small>Motor · PP-2091</small></span><span className={`${styles.dueBadge} ${styles.dueBadgeBlue}`}>In 5 days</span></div>
            </div>
          </div>
          <div className={styles.floatChip}><span><Check size={14} /></span> All your sheets, in sync</div>
          <div className={`${styles.sparkle} ${styles.sparkleOne}`}>✳</div><div className={`${styles.sparkle} ${styles.sparkleTwo}`}>✦</div>
        </div>
        <div className={styles.scrollHint}><span /> SCROLL TO EXPLORE</div>
      </section>

      <section className={styles.logoStrip} aria-label="Designed for your workflow">
        <p>FROM SPREADSHEETS TO SMARTER DECISIONS</p>
        <div><span><FileSpreadsheet size={17} /> Excel-ready</span><span><ShieldCheck size={17} /> Privacy-minded</span><span><Clock3 size={17} /> Renewal-aware</span><span><Fingerprint size={17} /> Built for your workflow</span></div>
      </section>

      <section className={styles.features} id="platform">
        <div className={`${styles.sectionIntro} ${styles.reveal}`} data-reveal>
          <div className={styles.eyebrow}>LESS ADMIN. MORE CONTROL.</div>
          <h2>Your data has a lot to say.<br /><span className={styles.mutedText}>Make it easier to hear.</span></h2>
          <p>PolicyPulse gives your everyday insurance workflow a calmer, clearer home — without changing how you work with Excel.</p>
        </div>
        <div className={styles.featureGrid}>
          <article className={`${styles.featureCard} ${styles.featureCardLarge} ${styles.reveal}`} data-reveal>
            <div className={styles.featureIcon}><UploadCloud size={21} /></div>
            <span className={styles.featureNumber}>01 / IMPORT</span>
            <h3>Bring your sheets together.</h3>
            <p>Upload policy spreadsheets and get one organised view of your insurance portfolio.</p>
            <div className={styles.fileStack}><div className={styles.fileRow}><span className={styles.excelIcon}>X</span><span>health_policies.xlsx</span><Check size={15} /></div><div className={`${styles.fileRow} ${styles.fileRowOffset}`}><span className={styles.excelIcon}>X</span><span>motor_clients.xlsx</span><Check size={15} /></div><div className={`${styles.fileRow} ${styles.fileRowOffsetTwo}`}><span className={styles.excelIcon}>X</span><span>life_cover_2026.xlsx</span><Check size={15} /></div><div className={styles.importStatus}><span className={styles.liveDot} /> 3 spreadsheets ready to review</div></div>
          </article>
          <article className={`${styles.featureCard} ${styles.reveal}`} data-reveal>
            <div className={`${styles.featureIcon} ${styles.featureIconAmber}`}><BellRing size={21} /></div>
            <span className={styles.featureNumber}>02 / STAY AHEAD</span>
            <h3>Renewals, before they sneak up.</h3>
            <p>See upcoming expiry dates at a glance and know which policies need attention first.</p>
            <div className={styles.renewalMini}><div><span className={styles.renewalDate}>OCT <strong>21</strong></span><span className={styles.renewalPerson}>Policy renewal<small>5 days remaining</small></span></div><span className={styles.urgentDot} /></div>
          </article>
          <article className={`${styles.featureCard} ${styles.reveal}`} data-reveal>
            <div className={`${styles.featureIcon} ${styles.featureIconPurple}`}><Sparkles size={21} /></div>
            <span className={styles.featureNumber}>03 / FIND FAST</span>
            <h3>Answers without the hunt.</h3>
            <p>Find a policy by customer, phone number or policy ID — without opening every file.</p>
            <div className={styles.searchMini}><span className={styles.searchGlyph}>⌕</span><span>Search policy or phone...</span><kbd>↵</kbd></div>
            <div className={styles.searchResult}><span className={styles.searchResultIcon}>SM</span><span><strong>Simran Mehta</strong><small>Policy #PP-2091</small></span><ChevronRight size={15} /></div>
          </article>
        </div>
      </section>

      <section className={styles.workflow} id="how-it-works">
        <div className={`${styles.workflowCopy} ${styles.reveal}`} data-reveal>
          <div className={styles.eyebrow}>A SIMPLE, BETTER FLOW</div>
          <h2>From scattered files<br />to <span className={styles.gradientText}>in-control.</span></h2>
          <p>No complicated setup. No new spreadsheet habits to learn. Just a clearer way to work with the information you already have.</p>
          <a href="/dashboard" className={styles.primaryButton}>Get started <ArrowRight size={17} /></a>
        </div>
        <div className={`${styles.steps} ${styles.reveal}`} data-reveal>
          <div className={styles.stepLine} />
          <div className={styles.step}><span className={styles.stepNum}>01</span><div><h3>Upload your spreadsheets</h3><p>Start with the Excel files you already use.</p></div><span className={styles.stepCheck}><UploadCloud size={17} /></span></div>
          <div className={styles.step}><span className={styles.stepNum}>02</span><div><h3>Review your portfolio</h3><p>Bring customers, insurers and policies into one view.</p></div><span className={styles.stepCheck}><Activity size={17} /></span></div>
          <div className={styles.step}><span className={styles.stepNum}>03</span><div><h3>Act at the right time</h3><p>Spot renewals and look up details without the scramble.</p></div><span className={styles.stepCheck}><BellRing size={17} /></span></div>
        </div>
      </section>

      <section className={`${styles.security} ${styles.reveal}`} id="security" data-reveal>
        <div className={styles.securityIcon}><ShieldCheck size={24} /></div>
        <div><span className={styles.eyebrow}>BUILT AROUND YOUR DATA</span><h2>Clarity should come with care.</h2><p>PolicyPulse is designed to make policy information easier to manage. Review your data and access settings carefully before using real customer records.</p></div>
        <a href="/dashboard" className={styles.outlineButton}>Explore workspace <ArrowRight size={16} /></a>
      </section>

      <footer className={styles.footer}>
        <a className={styles.brand} href="#top"><span className={styles.brandMark}><Activity size={18} strokeWidth={2.5} /></span><span>Policy<span className={styles.brandAccent}>Pulse</span></span></a>
        <span>One clear picture of every policy.</span>
        <span>© 2026 PolicyPulse · Prototype experience</span>
      </footer>
    </main>
  );
}
