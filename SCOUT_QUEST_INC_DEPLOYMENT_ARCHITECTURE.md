# Scout Quest Inc — Company OS: Deployment Architecture
*The plan to turn the static dashboard into a live, multi-user app where change logs, work orders, product updates, and roles/access persist and are enforced. Class 3 change (new app + auth + data) — security-first.*

## Stack (matches what you already use)
- **App:** Next.js (App Router) on **Vercel** — the dashboard screens, data-driven.
- **Data + Auth:** **Supabase** — Postgres for all persistent data, Supabase Auth for sign-in.
- **Cost:** free tiers cover an internal team app. No cloud-model key — this app spends ~$0.
- **Hard boundary:** this app stores **company/ops data only (D0–D2)**. It must **never** store student/patient **D3** — that stays inside the governed asl-gateway local infrastructure. The company OS and the regulated-data plane are separate by design.

## Database schema (Supabase Postgres)
Enable **Row-Level Security (RLS) on every table** from day one.

- **profiles** — `id`(uuid → auth.users), `email`, `name`, `is_owner` bool, `created_at`. One row per person who can sign in.
- **team_members** — `id`, `name`, `working_on`, `profile_id`(nullable → profiles), `created_at`. The HR Team list; links to a login when they have one.
- **roles** — `id`, `name` unique, `permissions` jsonb (array of `"Module: Tab"` keys, or `["ALL"]`), `created_at`. The role builder writes here.
- **role_assignments** — `id`, `team_member_id`→team_members, `role_id`→roles, unique(member, role). Many-to-many so a member holds multiple roles.
- **products** — `id`, `key` unique, `name`, `status`.
- **product_areas** — `id`, `product_id`, `area`, `status` (planned|building|live), `note`, `sort`, `updated_at`. Drives each Build Board.
- **websites** — `id`, `product_id`, `label`, `url`.
- **work_orders** — `id`, `wo_code`, `agent`, `title`, `description`, `status`, `confidence`, `review`, `product_id` null, `created_at`.
- **change_log** — `id`, `product`, `module`, `tab`, `change_type` (new|update), `description`, `created_by`, `created_at`.
- **contracts** — `id`, `team_member_id`, `type`, `status` (pending|complete), `file_path`, `created_at`. Files go in a **private Supabase Storage bucket**.
- **mission_values** — `id`, `scope` (`company` or a product key), `purpose`, `mission`, `values` jsonb, `updated_at`.
- **agents** — `id`, `agent_id` unique, `role`, `data_classes`, `evaluation`, `status`. (Mirror of `spend_policy.yaml`; can be generated, not hand-kept.)

## Auth & roles (IT › Identity & Access, made real)
- **Supabase Auth**, email sign-in. **Public sign-up disabled** — invite-only. The Owner invites teammates.
- **Owner:** your email is seeded `is_owner = true` → full access, bypasses permission checks.
- **Enforcement is two-layered:** a Postgres helper `has_perm(uid, perm_key)` checks whether any of the user's assigned roles' `permissions` contains the key (or `ALL`); RLS policies call it. The app also hides UI a role can't use. RLS is the real gate — the UI is convenience.
- **Sensitive tables (contracts, the contracts storage bucket)** are readable only by roles with HR/Security permission, or the Owner. Everyone authenticated can read the non-sensitive tables; **writes** are gated by `has_perm`.
- This is the same permission model as the dashboard's role builder — the checkboxes over modules/tabs become the `permissions` array.

## What persists, and who can change it
- **Roles & access** — created/edited in Identity & Access, stored in `roles`; assignments in `role_assignments`; enforced by RLS across every module.
- **Team & contracts** — HR writes to `team_members` / `contracts`; contract status syncs to the Team view (a DB join, not JS).
- **Work orders & change log** — Stage 2 lets authorized roles add them; Stage 3 auto-fills them from the ASL ledger and git.
- **Product updates (build board, websites, mission)** — product roles edit their product's `product_areas`, `websites`, `mission_values`.

## Your setup checklist (the part only you can do)
1. Create a **Supabase** project → copy `Project URL`, `anon key`, `service_role key`.
2. Create a **Vercel** project linked to the repo → add those as env vars (`service_role` **server-side only**, never exposed to the browser).
3. In Supabase Auth: **disable public sign-ups**; add your **Owner email**.
4. Turn on **2FA / hardware key** on both Supabase and Vercel (security-critical per Constitution §5).
5. Tell me/Claude Code your Owner email so it's seeded `is_owner`.

## Stages
1. **Skeleton** — app deployed on Vercel, sign-in works, **Team persists** to Supabase, RLS on. Proves the whole loop end to end. *(This is the first kickoff.)*
2. **Roles + editing** — Identity & Access writes real roles/assignments; RLS enforces them; the rest of the editable tables (contracts, work orders, change log, product areas, websites, mission) persist.
3. **Live agent data** — work orders, spend, and verdicts flow from the ASL ledger; change log auto-generates from git.

## Governance
Class 3 (new app, auth, data architecture). RLS on from day one; secrets server-side; invite-only; 2FA required; no real dollar spend (free tiers, no cloud key); **no D3 in this app, ever**. Each stage ships behind review — same merge/hold rhythm as the platform build.
