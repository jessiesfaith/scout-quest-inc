# CTX-004 — Scout Quest Education: Brand & Product

> **version** 0.9 · **class** Class 2 to change (Class 3 for mission or claim rules) ·
> **owner** Jessica · **completeness** partial — fields marked `<!-- UNSET -->` must be
> filled by a human. An agent that needs an `UNSET` field **halts and escalates**
> (`CTX-000`). It does not infer, and it does not write around the gap.

Load this page for any output about Scout Quest Education. Load `CTX-006` (audiences),
`CTX-007` (compliance) and `CTX-008` (evidence) alongside it for anything published.

---

## Mission

> **Every student deserves personalized learning. Every teacher deserves AI-powered
> tools that amplify — not replace — their impact.**

This wording is approved and is quoted verbatim. Do not paraphrase it, shorten it, or
"punch it up." The *amplify — not replace* construction is the position, not a
flourish: it is the answer to the objection every teacher audience arrives with.

## What the product is

An AI-powered teaching platform for K–12. It sits with the teacher, not around them.
Live product surface: `scoutquest.education`.

Related but **separate** products, never conflated in copy: Scout Quest Game (in
design), Scout Quest Tutor (B2C, in design), Soundwiserx (clinical speech —
`CTX-005`), AI Bookmark.

<!-- UNSET: one-paragraph product description approved for external use -->
<!-- UNSET: current feature set that may be described publicly vs. in design -->
<!-- UNSET: pricing and packaging, if any is public -->

## Voice

| Do | Don't |
|---|---|
| Speak to teachers as professionals with expertise | Speak to teachers as people who need rescuing |
| Concrete and specific — a named practice, a real classroom constraint | Abstract edtech register ("empower," "transform," "unlock potential") |
| Evidence-forward; cite and link | Confident assertion without a source |
| Name the limits of the tool honestly | Imply the tool does more than it does |
| Plain language a parent can follow | Jargon that only survives inside edtech |
| Acknowledge AI scepticism directly and take it seriously | Dismiss AI concerns as resistance to change |

**Register test.** Read it back and ask whether a teacher with twenty years in the
classroom would feel respected or sold to. If sold to, rewrite.

**AI-scepticism rule.** A meaningful part of this audience is wary of AI in schools,
often for good reasons. Copy that treats that wariness as an obstacle to overcome will
fail. Copy that treats it as a reasonable position and answers it specifically will
work. This is also a strategic asset — the *amplify, not replace* mission is only
credible if the marketing behaves that way.

## Prohibited claims

Enforced by `gov-compliance-reviewer` and `GATE-release`:

- **No claim that the product improves test scores, grades, or outcomes** without a
  cited, human-approved study or pilot summary, with the sample size stated.
- No claim that it replaces, reduces the need for, or substitutes for a teacher. This
  contradicts the mission and is the fastest way to lose the audience.
- No claim about a named district, school, or classroom without written permission
  (`CTX-007` FERPA).
- No student work, image, voice, name, or identifiable detail (`CTX-007` COPPA).
- No comparison to a named competitor without a cited, current, primary source.
- No claim of compliance certification, approval, or district approval that has not
  been issued.
- No implication that student data trains models or leaves the governed plane. The
  true statement is the strong one — say what the boundary actually is.

## Proof assets

What an agent may draw on, in preference order (this is `CTX-001`'s cost ladder
applied to evidence):

1. Approved published material — the live site, released articles, approved decks
2. Approved, de-identified pilot summaries prepared under human review
3. Published external research, cited (`CTX-008`)
4. <!-- UNSET: approved case studies -->
5. <!-- UNSET: approved teacher quotes with documented consent -->

Anything not on this list is `<!-- NEEDS SOURCE -->` and halts that section.

## Positioning against the objection set

The four objections this audience actually raises, and the honest answer to each. An
agent producing persuasive content addresses the objection rather than routing around
it.

| Objection | Position |
|---|---|
| "AI will replace teachers" | The mission answers it: amplify, not replace. Show the teacher in the loop, doing the judgment work |
| "Student data isn't safe" | The governed-plane boundary is real and specific — D3 stays local (`CTX-002`). Describe the actual architecture, not a reassurance |
| "This is another tool I have to learn" | <!-- UNSET: the honest answer on adoption cost — do not invent one --> |
| "AI output can't be trusted in a classroom" | Independent evaluation is a governance requirement (§3.5) with a **register-pinned v0 shipped in the governed plane**. Describe precisely what is in place and what is not — the honest version is stronger than the broad one, and the broad one is false |

## Terminology

| Use | Not |
|---|---|
| Scout Quest Education | ScoutQuest, Scout Quest Ed, SQE (internal only) |
| teacher, educator | user, end user |
| learner, student | kid, child (in product copy) |
| district, school | customer, account (in teacher-facing copy) |
| screening, practice, personalised learning | assessment, diagnosis (reserve — see `CTX-005`) |

<!-- UNSET: approved logo, colour, and typography rules — no agent generates or specifies visual identity until filled -->

## Active work this page supports (August 2026)

Product and build · research and evidence · compliance · branding and content for
events, pilot articles, book, and speaking engagements. See
`../products/scout-quest-education/` for the agents and `CTX-009` for cadence.
