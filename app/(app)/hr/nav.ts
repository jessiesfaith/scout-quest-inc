import type { SubNavItem } from "../shell";

// One definition of the HR sub-nav so a new screen (Org Chart) shows up as a
// tab everywhere the nav is rendered, instead of being wired page by page.
// Every HR screen is viewable by any signed-in member (edit is gated on each
// page), so these tabs carry no `needs` — the nav is purely for navigation.
const TABS: SubNavItem[] = [
  { label: "Team", href: "/hr/team" },
  { label: "Org Chart", href: "/hr/org-chart" },
  { label: "Contracts", href: "/hr/contracts" },
  { label: "Mission & Values", href: "/hr/mission-values" },
  { label: "Constitution", href: "/hr/constitution" },
];

export function hrNav(current: string): SubNavItem[] {
  return TABS.map(({ label, href }) => ({ label, href, on: href === current }));
}
