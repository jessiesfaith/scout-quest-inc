import type { SubNavItem } from "../shell";
import { can } from "@/lib/reachable";

// One definition of the IT sub-nav so a new screen doesn't have to be added
// to five files by hand. `needs` must match the gate on the page it points
// at — a tab is only shown when the viewer can actually open it.
const TABS: (SubNavItem & { needs: string[] })[] = [
  {
    label: "Identity & Access",
    href: "/it/identity-access",
    needs: ["IT: Identity & Access"],
  },
  {
    label: "Agent Platform",
    href: "/it/agent-platform",
    needs: ["IT: Agent Platform"],
  },
  // Tickets and Context are screens INSIDE Agent Platform (?tab=), but they
  // are the two a reviewer opens most, so they get a seat in the IT bar
  // rather than being two clicks deep. Same gate as the page they live on.
  {
    label: "Tickets",
    href: "/it/agent-platform?tab=tickets",
    needs: ["IT: Agent Platform"],
  },
  {
    label: "Context",
    href: "/it/agent-platform?tab=context",
    needs: ["IT: Agent Platform"],
  },
  { label: "Infrastructure", href: "/it/infrastructure", needs: [] },
  { label: "Access Requests", href: "/it/access-requests", needs: ["HR: Team"] },
  {
    label: "Zero-Day",
    href: "/it/zero-day",
    needs: ["IT: Agent Platform", "Security Tooling: Change Management"],
  },
  // Security Tooling now lives under IT. Points at the always-open Change
  // Log (needs: []) so every role can reach it; the governed Change
  // Management view is linked from there for those who hold its permission.
  { label: "Security Tooling", href: "/security/change-log", needs: [] },
  // Coding Cards — one hub for the per-product "how it's built" reads. The
  // page itself lists a button per product; pick one to see its cards.
  { label: "Coding Cards", href: "/it/coding-cards", needs: [] },
];

/**
 * `current` may carry a query string ("/it/agent-platform?tab=tickets") so
 * a tab that lives inside another page can be the one lit up. A bare path
 * lights only the bare entry: on /it/agent-platform?tab=wos, "Agent
 * Platform" is on and "Tickets" is not.
 */
export function itNav(current: string, held: Set<string>): SubNavItem[] {
  return TABS.filter((t) => t.needs.length === 0 || can(held, ...t.needs)).map(
    ({ label, href }) => ({ label, href, on: href === current }),
  );
}

// The "IT" breadcrumb. Infrastructure is open to everyone with a role, so
// its viewers often cannot open Identity & Access — pointing the crumb there
// would bounce them to the dashboard. Send them to their own first IT screen
// instead, or leave the crumb unlinked if that screen is the one they are on.
export function itCrumbHref(
  current: string,
  held: Set<string>,
): string | undefined {
  const first = itNav(current, held)[0];
  return first && first.href !== current ? first.href : undefined;
}
