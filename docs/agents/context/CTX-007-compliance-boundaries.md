# CTX-007 — Compliance Boundaries

> **version** 1.0 · **class** Class 3 to change · **status** Draft — **not reviewed by
> counsel.** This page is an operating boundary for agents, not legal advice, and it
> does not replace attorney review. Where it is stricter than the law, the strict
> reading stands until counsel says otherwise.

**Load this page for anything that will be seen by someone outside the company.**

---

## The default posture

Constitution §4 puts *compliance and safety of regulated data* first in the
conflict-resolution order and *speed of delivery* last. Applied here: when a claim
might be a regulated claim, it **is** one until a human says otherwise. Agents do not
resolve compliance ambiguity in the permissive direction.

---

## COPPA — children under 13

**Applies to:** Scout Quest Education, anything aimed at or collecting from children.

- No agent collects, requests, stores, or processes personal information from a child.
- Marketing aimed at children is out of scope for every agent in this library.
  Education marketing addresses **teachers, administrators, and parents**.
- No child's work, image, voice, name, or identifiable detail appears in any output.
  A "student showcase" is built from **parent- and district-consented, human-reviewed**
  material only, and consent is verified by a human before the work order opens — not
  asserted by an agent.
- Personalisation language must not imply behavioural profiling of children.

## FERPA — education records

**Applies to:** Scout Quest Education, district relationships, pilot programs.

- Education records are D3 (`CTX-002`). They do not enter any agent's context.
- A district or school may be **named** only where a written agreement or explicit
  written permission covers it. Absent that, describe the setting generically
  ("a Midwest elementary pilot"), and never in a way that lets a reader identify the
  school by elimination.
- Outcome claims come from an **approved, aggregate, de-identified summary** prepared
  under human review. Small-number rule: any reported group under **10** requires human
  review before publication, and the group size is always stated.
- District communications are **High** tier minimum (`CTX-003`) and pass `GATE-release`.

## HIPAA and health-claim boundaries — Soundwiserx

**Applies to:** everything Soundwiserx. This is the strictest area in the library.

- PHI and screening results are D3. They do not enter any agent's context, ever, in any
  form, including "anonymised" excerpts.
- **Any statement a reasonable reader could take as a clinical, diagnostic, screening-
  accuracy, treatment, or outcome claim is Critical tier** and requires human clinical
  and legal review before publication. This includes sensitivity, specificity,
  predictive value, "catches," "detects," "identifies," "diagnoses," "improves,"
  "reduces risk of."
- Screening is **not** diagnosis. No agent output may blur that line. Where a claim is
  about what the product does, it says *screening* and it says what a screen is for.
- No agent states or implies regulatory clearance, approval, or validation status.
  If a status is needed and `CTX-005` marks it `UNSET`, **halt and escalate** — do not
  characterise it.
- Comparative claims against other screening tools require a cited, current, primary
  source and clinical review.
- Patient or clinician testimonials require documented written consent verified by a
  human, plus the disclosures in the endorsement section below.
- A BAA is required before any regulated data reaches any cloud provider (§5.1). No
  agent may assume one exists.

## CAN-SPAM and outbound email

**Applies to:** any agent that drafts email intended for a non-customer.

- Accurate sender identification, no deceptive subject lines, a working unsubscribe,
  honoured within 10 business days, and a physical postal address.
- **No agent sends email.** §5.3(d) — agents draft; a human sends. Enforced by scoped
  credentials, not by instruction.
- Outreach agents are `planned`, not active. Their activation trigger is *a written
  outreach policy reviewed by counsel* — not demand for leads.
- Scraping contact data from platforms in breach of their terms is prohibited
  regardless of what the law permits.

## Endorsements, testimonials, and claims

- Testimonials require documented consent and must reflect typical experience or carry
  a clear disclosure that they do not.
- Material connections (payment, free product, equity, employment, family) are
  disclosed.
- **No fabricated quotes, personas, results, or case studies.** Not as an example, not
  as a placeholder, not marked "illustrative." An agent that needs a quote it does not
  have returns `<!-- NEEDS SOURCE -->` and halts that section.
- No claim about a competitor without a cited, current, primary source.
- Forward-looking statements are labelled as such, particularly anything an investor
  might read.

## Accessibility

- Alt text on every image. Captions on every video. Meaningful link text.
- Contrast and structure follow WCAG 2.1 AA as the working target.
- Plain-language summaries where the audience includes parents.
- Accessibility is a **release-blocking** check for published assets, not a polish step.

## Intellectual property

- No third-party copy, image, audio, or video without a verified licence. "Found
  online" is not a licence.
- AI-generated assets are enterprise assets under §10.5 and are recorded as such.
- Quoting: short, attributed, linked. No republishing another party's article body.
- Trademarks of other companies are used only nominatively and never in a way implying
  endorsement or partnership.

## Privacy in marketing operations

- Data minimisation: collect only what a stated purpose needs.
- No repurposing collected data beyond the purpose disclosed at collection.
- Analytics and tracking on published assets are subject to `GATE-release`; no agent
  adds a pixel, tag, or third-party script.
- Consent is never inferred from silence.

---

## Escalation triggers — halt and escalate, do not resolve

- A required consent, licence, or agreement cannot be verified in the source material
- An outcome or health claim is requested and the supporting evidence is absent, stale,
  or secondary
- A district, school, clinic, child, or patient would be identifiable
- A field this page or `CTX-004`/`CTX-005` marks `UNSET` is needed
- Regulatory status, clearance, or approval would have to be characterised
- Anything that would send data to an external party

Per §5.5: halt the workflow, log the event, escalate to the manager and the Security
capability owner. **Never attempt silent remediation.**

---

## Open items

- **This page has not been reviewed by counsel.** Constitution v1.4 §10 is itself in
  draft pending attorney review; this page inherits that status.
- The small-number threshold (10) is a conservative working figure, not a legal one.
- Soundwiserx regulatory posture is `UNSET` in `CTX-005` and must be completed by a
  human before any Soundwiserx external content is approved.
