import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { COMPANY_NAME } from "@/lib/constants";

export const metadata = {
  title: "Scout Quest Inc — Company OS",
};

const NAV = [
  { section: "Company", items: [{ label: "Dashboard", href: "/dashboard" }] },
  { section: "HR", items: [{ label: "Team", href: "/hr/team" }] },
];

// Stage 2 seam — listed so the shell shows the shape of the OS, not clickable yet.
const UPCOMING = ["Roles & permissions", "Contracts", "Work orders", "Products"];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await ensureProfile(supabase, user);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-3 px-5 py-5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              background: "linear-gradient(135deg, #16b8a6, #0f766e)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2z"
                fill="#fff"
              />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">
              {COMPANY_NAME}
            </div>
            <div className="text-xs text-muted">Company OS</div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 px-3 py-4">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted">
                {group.section}
              </div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-2 py-1.5 text-sm text-foreground transition hover:bg-surface-raised"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}

          <div>
            <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted">
              Coming in Stage 2
            </div>
            {UPCOMING.map((label) => (
              <div
                key={label}
                className="cursor-not-allowed px-2 py-1.5 text-sm text-muted/60"
              >
                {label}
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-border px-5 py-4">
          <div className="truncate text-xs text-muted" title={user.email ?? ""}>
            {user.email}
            {profile?.is_owner && (
              <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                OWNER
              </span>
            )}
          </div>
          <form action="/auth/signout" method="post" className="mt-2">
            <button
              type="submit"
              className="text-xs text-muted underline-offset-2 transition hover:text-foreground hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden p-8">{children}</main>
    </div>
  );
}
