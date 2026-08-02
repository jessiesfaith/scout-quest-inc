"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import s from "./landing.module.css";

// Converted from the design reference at /index.html (v2).
// Content edits happen here; the raw HTML file is reference only.

// Seeded PRNG (mulberry32) — random-looking but identical on server and
// client, so the starfield hydrates cleanly without client-only rendering.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260801);
const STARS = Array.from({ length: 70 }, () => ({
  size: 1 + rand() * 2.6,
  left: rand() * 100,
  top: rand() * 100,
  duration: 2.4 + rand() * 2.8,
  delay: -rand() * 5,
  opacity: 0.4 + rand() * 0.5,
}));

function Starfield() {
  return (
    <div className={s.stars} aria-hidden="true">
      {STARS.map((st, i) => (
        <div
          key={i}
          className={s.star}
          style={{
            width: st.size,
            height: st.size,
            left: `${st.left}%`,
            top: `${st.top}%`,
            animationDuration: `${st.duration}s`,
            animationDelay: `${st.delay}s`,
            opacity: st.opacity,
          }}
        />
      ))}
    </div>
  );
}

// Deterministic layout — mirrors the generator script in the reference.
function NeuralNetSvg() {
  const W = 1200;
  const H = 280;
  const cols = [120, 360, 600, 840, 1080];
  const counts = [4, 6, 6, 6, 4];
  const layers = cols.map((x, ci) =>
    Array.from({ length: counts[ci] }, (_, i) => ({
      x,
      y: (H / (counts[ci] + 1)) * (i + 1) + (i % 2 ? -8 : 8),
    })),
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {layers.slice(0, -1).map((layer, l) =>
        layer.map((a, ai) =>
          layers[l + 1].map((b, bi) => (
            <line
              key={`${l}-${ai}-${bi}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgba(22,184,166,0.18)"
              strokeWidth="1"
            />
          )),
        ),
      )}
      {layers.map((layer, li) =>
        layer.map((n, ni) => {
          const fill = li % 2 ? "#fbbf24" : "#16b8a6";
          return (
            <g key={`n-${li}-${ni}`}>
              <circle cx={n.x} cy={n.y} r="6" fill={fill} opacity="0.9" />
              <circle cx={n.x} cy={n.y} r="12" fill={fill} opacity="0.14" />
            </g>
          );
        }),
      )}
    </svg>
  );
}

function SignInSection() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section className={s.login} id="login">
      <div className={s.wrap}>
        <h2>Sign in to Scout Quest Inc</h2>
        <p>Access is invite-only. Team members sign in below.</p>
        <form className={s.loginBox} onSubmit={handleSubmit}>
          <label htmlFor="em">Email</label>
          <input
            id="em"
            type="email"
            required
            placeholder="you@scoutquest.inc"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="pw">Password</label>
          <input
            id="pw"
            type="password"
            required
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className={`${s.btn} ${s.btnPrimary}`}
            disabled={pending}
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
          {error && <p className={`${s.note} ${s.noteError}`}>{error}</p>}
          <p className={s.note}>
            Need access? Ask your Scout Quest Inc owner for an invite.
          </p>
        </form>
      </div>
    </section>
  );
}

export function Landing() {
  // Dark by default, session-only toggle — same behavior as the reference.
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <div className={`${s.page} ${theme === "light" ? s.light : ""}`}>
      <Starfield />

      <div className={s.layer}>
        <nav className={s.nav}>
          <div className={`${s.wrap} ${s.navRow}`}>
            <div className={s.brand}>
              <span className={s.mark}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z"
                    fill="#04211d"
                  />
                </svg>
              </span>
              Scout Quest Inc
            </div>
            <div className={s.links}>
              <a href="#platform">Platform</a>
              <a href="#values">Values</a>
              <a href="#careers">Careers</a>
            </div>
            <div className={s.cta}>
              <button
                className={s.themeBtn}
                onClick={toggleTheme}
                title="Toggle dark / light"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? "🌙" : "☀️"}
              </button>
              <a href="#login" className={`${s.btn} ${s.btnPrimary}`}>
                Sign in
              </a>
            </div>
          </div>
        </nav>

        <header className={s.hero}>
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div>
              <span className={s.eyebrow}>AI Platform Studio</span>
              <h1>
                Build the <span className={s.accent}>safe frontier</span> of
                learning and speech.
              </h1>
              <p className={s.lead}>
                Scout Quest Inc is an AI-native studio building education,
                tutoring, and clinical-speech products where safety comes first
                — for every age — and the ambition reaches all the way to
                frontier intelligence.
              </p>
              <div className={s.btns}>
                <a href="#careers" className={`${s.btn} ${s.btnPrimary}`}>
                  See open roles
                </a>
                <a href="#platform" className={`${s.btn} ${s.btnGhost}`}>
                  Explore the platform
                </a>
              </div>
            </div>
            <div className={s.safetyCard}>
              <h3>SAFETY-FIRST BY DESIGN</h3>
              <ul>
                <li>
                  <span className={s.chk}>✓</span>
                  <span>
                    <b>Governed from day one.</b> An enterprise constitution,
                    RLS, and audit trails behind every product.
                  </span>
                </li>
                <li>
                  <span className={s.chk}>✓</span>
                  <span>
                    <b>All ages protected.</b> Kid-safe controls, parent panels,
                    and clinical-grade data boundaries.
                  </span>
                </li>
                <li>
                  <span className={s.chk}>✓</span>
                  <span>
                    <b>Frontier ambition.</b> Frontier-scale intelligence,
                    deployed responsibly and transparently.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </header>

        <div className={`${s.band} ${s.nnBand}`}>
          <NeuralNetSvg />
          <div className={s.caption}>
            <div className={s.k}>Intelligence · Science · Education</div>
            <h2>Where neural networks meet the classroom</h2>
            <p>
              Frontier models, learning science, and clinical rigor — engineered
              into products people can trust.
            </p>
          </div>
        </div>

        <section className={s.pad} id="platform">
          <div className={s.wrap}>
            <div className={s.kicker}>The Platform</div>
            <h2 className={s.sec}>One studio, a portfolio of products</h2>
            <p className={s.sub}>
              Every product runs on the same governed company OS — shared
              agents, roles and access, change logs, and work orders.
            </p>
            <div className={s.cards}>
              {[
                [
                  "🎓",
                  "Scout Quest Education",
                  "District and classroom learning built on quests, mastery, and real learning science.",
                ],
                [
                  "🎮",
                  "Scout Quest Game",
                  "Play-first learning that keeps kids engaged while staying safe and age-appropriate.",
                ],
                [
                  "🧭",
                  "Scout Quest Tutor",
                  "A B2C tutor with a parent control panel and a kid-safe quest experience.",
                ],
                [
                  "🗣️",
                  "Soundwiserx",
                  "Clinical speech evaluation with strict, governed data boundaries.",
                ],
                [
                  "🔖",
                  "AI Bookmark",
                  "Save, organize, and resurface what matters — powered by helpful agents.",
                ],
                [
                  "⚙️",
                  "The Company OS",
                  "IT, HR, Finance, Products — modular, role-gated, and audited end to end.",
                ],
              ].map(([icon, title, body]) => (
                <div className={s.card} key={title}>
                  <div className={s.ic}>{icon}</div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${s.pad} ${s.padAlt}`} id="values">
          <div className={s.wrap}>
            <div className={s.kicker}>What we value</div>
            <h2 className={s.sec}>Principles we build by</h2>
            <p className={s.sub}>
              A safety-first platform across all ages — and, when it&apos;s
              product-specific, held to the same bar.
            </p>
            <div className={s.values}>
              {[
                [
                  "Safety first",
                  "Every feature ships behind governance, review, and audit — no exceptions.",
                ],
                [
                  "Trust by design",
                  "Privacy, RLS, and clear data boundaries are the default, not an add-on.",
                ],
                [
                  "Real learning",
                  "Grounded in learning science and clinical rigor, not hype.",
                ],
                [
                  "Frontier ambition",
                  "We aim for frontier-scale intelligence, deployed responsibly.",
                ],
              ].map(([title, body]) => (
                <div className={s.value} key={title}>
                  <h4>{title}</h4>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${s.pad} ${s.careers}`} id="careers">
          <div className={s.wrap}>
            <div className={s.kicker}>Careers</div>
            <h2 className={s.sec}>Join a company ready to scale</h2>
            <p className={s.sub}>
              We&apos;re a small, senior team building carefully. If you want to
              ship frontier products with safety at the core, we&apos;d love to
              meet you.
            </p>
            <div className={s.roles}>
              {[
                [
                  "Engineering",
                  "Full-stack / AI Engineer",
                  "Build the company OS and product surfaces on Next.js, Supabase, and governed agents.",
                ],
                [
                  "Product",
                  "Product Designer",
                  "Design kid-safe, all-ages experiences with parent controls and clarity.",
                ],
                [
                  "Clinical",
                  "Speech / Clinical Lead",
                  "Shape Soundwiserx evaluation with clinical rigor and strict data governance.",
                ],
              ].map(([tag, title, body]) => (
                <div className={s.role} key={title}>
                  <div className={s.tag}>{tag}</div>
                  <h4>{title}</h4>
                  <p>{body}</p>
                  <a href="#login" className={`${s.btn} ${s.btnGold}`}>
                    Apply
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className={`${s.band} ${s.teamBand}`}>
          <div className={s.caption}>
            <div className={s.k}>Our team</div>
            <h2>Small team, big table</h2>
            <p>Senior people, shipping together — with room for you.</p>
          </div>
        </div>

        <SignInSection />

        <footer className={s.footer}>
          <div className={`${s.wrap} ${s.footerRow}`}>
            <div>
              © {new Date().getFullYear()} Scout Quest Inc — an AI Platform
              Studio.
            </div>
            <div>
              <a href="#platform">Platform</a> · <a href="#careers">Careers</a>{" "}
              · <a href="#login">Sign in</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
