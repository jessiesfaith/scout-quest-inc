// The reviewer's manual for IT › Zero-Day.
//
// This text is held to the same standard as the reports: every claim must
// match what the harness actually does. An audit archive that flatters
// itself is worse than none, so limitations are stated plainly and the
// controls that are NOT yet automated are labelled as such.

export type GuideSection = {
  heading: string;
  intro?: string;
  items?: { term: string; text: string }[];
  body?: string[];
};

export const HOW_TO_READ: GuideSection = {
  heading: "How to read a report",
  intro:
    "Each entry is one review run against one slice of work. Open it to see every finding and the coverage list.",
  items: [
    {
      term: "Confirmed findings",
      text: "A finding is raised by one agent, then challenged by a different agent instructed to disprove it; only survivors are recorded. Findings the challenger rejected are NOT stored here today — the archive holds confirmed ones only, so you cannot see what was considered and dropped.",
    },
    {
      term: "Severity",
      text: "High means data could be exposed, permissions bypassed, or the feature is broken for real use. Medium means a real defect with a narrower path. Low means correctness or polish.",
    },
    {
      term: "Outcome",
      text: "Fixed means the code change was written and the build passed. It does NOT mean the fix was verified against your live database — migrations are applied by hand, so a fix that needs SQL is only real once you have run it.",
    },
    {
      term: "Two timestamps",
      text: "Ran at is when the review happened, supplied by whoever filed it. Filed at is stamped by the database and cannot be altered. If those two disagree wildly, ask why.",
    },
    {
      term: "Coverage",
      text: "Each report lists what it checked and what it did not. Read the second list first — it is where the residual risk lives. These lists are written by the reviewer, not machine-measured, so treat them as a good-faith account rather than proof.",
    },
  ],
};

export const WHAT_IS_REVIEWED: GuideSection = {
  heading: "What these reviews do cover",
  intro:
    "Reviews are code reading with adversarial verification. These are the techniques actually applied.",
  items: [
    {
      term: "Permission and RLS logic",
      text: "Reading every database policy and asking whether a role could reach data it shouldn't, escalate itself, or bypass the 2FA requirement. This is the highest-value check here, because the database is the real gate.",
    },
    {
      term: "Taint tracing",
      text: "Following untrusted input (form fields, URLs, request bodies) to anywhere it can cause harm — a database write, a file path, a permission decision.",
    },
    {
      term: "Variant analysis",
      text: "Given one confirmed bug, sweeping the codebase for the same mistake elsewhere.",
    },
    {
      term: "Migration and deploy-order review",
      text: "What breaks if SQL runs out of order, is re-run, or if code deploys before its migration.",
    },
    {
      term: "Regression sweep",
      text: "What the new work broke elsewhere — stale links, dead routes, screens that silently show wrong data.",
    },
    {
      term: "Live probing (outside the review agents)",
      text: "Some flaws are confirmed by attacking the running app — a forged cross-site login was fired at the dev server to prove the flaw, then re-fired to prove the fix. That is done by the engineer driving the work, not by the review agents, and only when a finding calls for it.",
    },
  ],
};

export const WHAT_IS_NOT_REVIEWED: GuideSection = {
  heading: "What these reviews do NOT cover",
  intro:
    "Read this as your open risk register. Nothing here is checked by an agent review, so each needs a different control.",
  items: [
    {
      term: "Platform and dashboard configuration",
      text: "Reviews read the repo. Settings that live in the Supabase or Vercel dashboard — bucket privacy, auth toggles, environment variables — are only caught when code happens to touch them. One real finding here was exactly that gap.",
    },
    {
      term: "Whether migrations were actually applied",
      text: "No report checks your live database. A finding marked fixed can still be open in production until you run the SQL.",
    },
    {
      term: "Dependency vulnerabilities (CVEs)",
      text: "Known flaws in third-party packages. Use npm audit and Dependabot — deterministic tools beat a model at this, and they run free.",
    },
    {
      term: "Zero-day discovery in dependencies",
      text: "Finding undiscovered flaws inside Next.js, Supabase, or Postgres themselves. That is upstream work; you inherit their patches.",
    },
    {
      term: "Malware in uploaded files",
      text: "Contract uploads are type- and size-limited but not scanned for malicious content.",
    },
    {
      term: "Denial of service and rate limiting",
      text: "Beyond the defaults Supabase and Vercel provide, nothing tunes or tests capacity.",
    },
    {
      term: "Third-party script integrity",
      text: "Scripts loaded from a CDN on the public site are trusted as-is.",
    },
    {
      term: "Physical, social, and account-level attacks",
      text: "Phishing, a stolen unlocked laptop, or an authenticator app on a compromised phone. Account 2FA on Supabase and Vercel is your control here.",
    },
    {
      term: "Correlated blind spots",
      text: "Every agent in a review shares the same underlying model. A mistake that model reliably makes will be missed by the finder and the challenger alike. Independent human review is the only cure.",
    },
    {
      term: "Point-in-time scope",
      text: "A report covers one slice at one moment. Code that was clean when reviewed can be broken by a later change that was never reviewed.",
    },
    {
      term: "Compliance certification",
      text: "Nothing here certifies COPPA, FERPA, or HIPAA. This app holds company data only — never student or patient data.",
    },
  ],
};

export const ANTI_CHEATING: GuideSection = {
  heading: "How the agents are kept honest",
  intro:
    "An agent grading its own work will pass itself. These are the controls in force, and — just as importantly — the ones that are not yet automated.",
  items: [
    {
      term: "Separate verifier, no shared reasoning (in force)",
      text: "The agent that raises a finding never decides whether it stands. A different agent, which never saw the finder's reasoning, rules on it.",
    },
    {
      term: "Verifiers are told to refute (in force)",
      text: "The question is 'prove this is broken', not 'is this fine?', and uncertainty defaults to rejecting the finding. Asking for confirmation reliably manufactures it.",
    },
    {
      term: "The engineer still frames the question (NOT independent)",
      text: "The person driving the work writes both the finder and verifier prompts, including a list of intended behaviour that verifiers are told not to flag. That framing can suppress a real finding. This is the weakest link in the current setup — treat a review as a strong second opinion, not an independent audit.",
    },
    {
      term: "Build and checks re-run (in force, outside the agents)",
      text: "The build, type check, lint, and the secret-in-bundle check are run and their raw output read before anything is pushed. The review agents themselves read code rather than execute it.",
    },
    {
      term: "Criteria are not version-controlled (NOT in force)",
      text: "Review scope is written fresh for each run rather than fixed in advance in a tracked file, so the bar can drift between reviews without leaving a trace.",
    },
    {
      term: "Reward-hacking signatures to watch for",
      text: "Deleted or skipped tests, weakened assertions, test-only branches, swallowed exceptions, hardcoded expected values, or mocking the very thing under test. If you ever see these in a diff, the passing result means nothing.",
    },
    {
      term: "If a report looks too clean",
      text: "Zero findings on a substantial change is a signal to look closer, not to relax. Check the coverage list and the agent count.",
    },
  ],
};

export const YOUR_MOVE: GuideSection = {
  heading: "What to do with a report",
  body: [
    "Read the coverage list before the findings — what was not checked matters more than what was.",
    "For anything marked needs attention, decide: fix it, or accept the risk and write down why.",
    "Confirm the SQL actually ran on your database before treating a database finding as closed.",
    "Reports cannot be edited or deleted once filed, and the filing time is stamped by the database — so the archive stays honest even if someone gets the run time wrong.",
    "Reports are filed by hand today; if work ships and no report appears here, that absence is itself the finding.",
  ],
};

export const GUIDE_SECTIONS: GuideSection[] = [
  HOW_TO_READ,
  WHAT_IS_REVIEWED,
  WHAT_IS_NOT_REVIEWED,
  ANTI_CHEATING,
  YOUR_MOVE,
];
