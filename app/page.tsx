import type { Metadata } from "next";
import { SignInCard } from "./signin-card";
import s from "./landing.module.css";

// Landing + sign-in, converted from the design reference at /index.html.
// Content edits happen here; the raw HTML file is reference only.

export const metadata: Metadata = {
  title: "Scout Quest Inc — AI Platform Studio",
  description:
    "Governed, frontier-grade AI for education and healthcare. Safe intelligence, built to scale.",
};

function BrandMark() {
  return (
    <span className={s.mark}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2z"
          fill="#fff"
        />
      </svg>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className={s.page}>
      <nav className={s.nav}>
        <div className={`${s.wrap} ${s.navRow}`}>
          <a className={s.brand} href="#top">
            <BrandMark />
            Scout Quest{" "}
            <span style={{ color: "#7c8aa0", fontWeight: 600 }}>Inc</span>
          </a>
          <div className={s.links}>
            <a href="#platform">Platform</a>
            <a href="#safety">Safety</a>
            <a href="#careers">Careers</a>
          </div>
          <div className={s.cta}>
            <a className={`${s.btn} ${s.btnGhost}`} href="#signin">
              Sign in
            </a>
            <a className={`${s.btn} ${s.btnPrimary}`} href="#careers">
              Join us
            </a>
          </div>
        </div>
      </nav>

      <header className={s.hero} id="top">
        <div className={`${s.wrap} ${s.heroGrid}`}>
          <div>
            <span className={s.eyebrow}>AI Platform Studio</span>
            <h1>
              The safe intelligence behind how{" "}
              <span className={s.hl}>kids learn.</span>
            </h1>
            <p className={s.lead}>
              Scout Quest Inc is an AI platform studio. We build governed,
              frontier-grade AI for education and healthcare — engineered so a
              child is never the thing that breaks. Come build it with us.
            </p>
            <div className={s.actions}>
              <a className={`${s.btn} ${s.btnPrimary}`} href="#careers">
                See open roles
              </a>
              <a className={`${s.btn} ${s.btnGhost}`} href="#signin">
                Sign in to the studio
              </a>
            </div>
            <div className={s.trust}>
              <span>
                <i />
                Independent evaluation
              </span>
              <span>
                <i />
                Append-only audit ledger
              </span>
              <span>
                <i />
                Local-first privacy
              </span>
              <span>
                <i />
                Fail-closed by design
              </span>
            </div>
          </div>
          <SignInCard />
        </div>
      </header>

      <section className={s.band} id="platform">
        <div className={s.wrap}>
          <span className={s.kicker}>What we build</span>
          <h2 className={s.title}>A studio, not just a product.</h2>
          <p className={s.sub2}>
            One governed platform. Many products. We build each capability once
            — safely — and scale it across everything from classrooms to
            clinics.
          </p>
          <div className={s.pillars}>
            <div className={s.pillar} id="safety">
              <div className={s.ic}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"
                    stroke="#0f766e"
                    strokeWidth="1.8"
                    fill="#dff5f1"
                  />
                  <path
                    d="M9 12l2 2 4-4"
                    stroke="#0f766e"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3>Kid-safe by design</h3>
              <p>
                Safety isn&apos;t a feature — it&apos;s the architecture.
                Regulated data (COPPA · FERPA · HIPAA) stays local by default,
                and every model output is independently evaluated before it ever
                reaches a child.
              </p>
            </div>
            <div className={`${s.pillar} ${s.pillarScale}`}>
              <div className={s.ic}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 20V10M10 20V4M16 20v-7M22 20H2"
                    stroke="#2563eb"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3>Built to scale</h3>
              <p>
                A modular company OS on governed rails — one shared agent
                library, cloned across products, with audit, spend caps, and
                role-based access built in. Enterprise-grade and investor-ready
                from day one.
              </p>
            </div>
            <div className={`${s.pillar} ${s.pillarFrontier}`}>
              <div className={s.ic}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle
                    cx="12"
                    cy="12"
                    r="3.2"
                    stroke="#b45309"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
                    stroke="#b45309"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3>Frontier intelligence</h3>
              <p>
                The hard problem: adaptive, private-tutor-quality learning at
                consumer scale. We build the most capable systems the mission
                demands — and we govern them like the stakes are real. Because
                they are.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={s.band} id="careers" style={{ paddingTop: 8 }}>
        <div className={s.wrap}>
          <div className={s.careers}>
            <span className={s.eyebrow}>Careers</span>
            <h2>
              Build the intelligence layer for how the next generation learns.
            </h2>
            <p className={s.lead}>
              We&apos;re a small team taking on a big, careful problem: frontier
              AI that teaches — and never cuts a corner where a kid is on the
              other side. If you want to do the most ambitious work of your
              career on rails you can be proud of, this is the room.
            </p>
            <div className={s.values}>
              <div className={s.value}>
                <b>Governed, not reckless</b>
                <span>
                  The hardest capability, shipped safely — evaluated, audited,
                  fail-closed.
                </span>
              </div>
              <div className={s.value}>
                <b>Evidence over vibes</b>
                <span>
                  Reading science, learning science, real research back every
                  decision.
                </span>
              </div>
              <div className={s.value}>
                <b>Ship real things</b>
                <span>
                  Products kids, teachers, parents, and clinicians actually use.
                </span>
              </div>
              <div className={s.value}>
                <b>Own the hard part</b>
                <span>
                  You take the frontier problem in your field — and the
                  accountability with it.
                </span>
              </div>
            </div>
            <div className={s.roles}>
              <span className={s.role}>AI &amp; Platform Engineering</span>
              <span className={s.role}>Security &amp; Compliance</span>
              <span className={s.role}>Product &amp; Design</span>
              <span className={s.role}>UX &amp; Learning-Science Research</span>
              <span className={s.role}>Clinical / Speech</span>
              <span className={s.role}>Founding &amp; Ops</span>
            </div>
            <a className={`${s.btn} ${s.btnGold}`} href="#signin">
              Request access &amp; introduce yourself
            </a>
          </div>
        </div>
      </section>

      <section className={s.band} style={{ paddingTop: 8 }}>
        <div className={s.wrap}>
          <span className={s.kicker}>Brand system</span>
          <h2 className={s.title}>The schema.</h2>
          <p className={s.sub2}>
            A compact brand kit so everything — this page, decks, the product —
            reads as one company.
          </p>
          <div className={s.brandsys}>
            <div className={s.bsGrid}>
              <div>
                <h3>Palette</h3>
                <div className={s.swatches}>
                  {[
                    ["#0b1424", "Ink #0b1424"],
                    ["#16b8a6", "Teal #16b8a6"],
                    ["#0f766e", "Teal-deep #0f766e"],
                    ["#fbbf24", "Gold #fbbf24"],
                    ["#2563eb", "Blue #2563eb"],
                    ["#f6f8fb", "Bg #f6f8fb"],
                  ].map(([hex, label]) => (
                    <div className={s.sw} key={hex}>
                      <div className={s.chip} style={{ background: hex }} />
                      <small>{label}</small>
                    </div>
                  ))}
                </div>
                <p className={s.bsNote}>
                  <b>Ink</b> for authority, <b>teal</b> for the brand,{" "}
                  <b>gold</b> for energy &amp; CTAs, <b>blue</b> for scale.
                  Neutrals do the heavy lifting.
                </p>
              </div>
              <div>
                <h3>Type</h3>
                <div
                  className={s.typerow}
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: "-.02em",
                  }}
                >
                  Display — bold, tight
                </div>
                <div
                  className={s.typerow}
                  style={{ fontSize: 15, color: "var(--muted)" }}
                >
                  Body — clean system sans, generous line-height
                </div>
                <div
                  className={s.typerow}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "var(--teal-deep)",
                    marginTop: 8,
                  }}
                >
                  Eyebrow — uppercase, tracked
                </div>
                <p className={s.bsNote}>
                  One family, three weights. Headlines carry the ambition; body
                  stays quiet and readable.
                </p>
              </div>
              <div>
                <h3>Voice</h3>
                <ul className={s.voice}>
                  <li>
                    <b>Confident, not loud.</b> We state what we do plainly.
                  </li>
                  <li>
                    <b>Safety-first.</b> Kids are named, never abstracted.
                  </li>
                  <li>
                    <b>Precise.</b> Governance words mean specific things.
                  </li>
                  <li>
                    <b>Ambitious without hype.</b> Frontier work, honest claims.
                  </li>
                </ul>
                <p className={s.bsNote} style={{ marginTop: 12 }}>
                  Tagline: <b>&ldquo;Safe intelligence, built to scale.&rdquo;</b>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footerRow}`}>
          <div>© 2026 Scout Quest Inc — AI Platform Studio · scoutquest.education</div>
          <div>Governed by the Enterprise Constitution · COPPA · FERPA · HIPAA</div>
        </div>
      </footer>
    </div>
  );
}
