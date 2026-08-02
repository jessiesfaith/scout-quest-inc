import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../shell";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "ar", label: "AR", perm: "Finance: AR" },
  { id: "ap", label: "AP", perm: "Finance: AP" },
] as const;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: raw } = await searchParams;
  const { email, isOwner } = await getViewer();
  const [canAR, canAP] = await Promise.all([
    checkPerm("Finance: AR"),
    checkPerm("Finance: AP"),
  ]);
  if (!canAR && !canAP) redirect("/dashboard");

  // Land on a tab the viewer can actually see rather than always AR.
  const requested = TABS.find((t) => t.id === raw)?.id;
  const tab = requested ?? (canAR ? "ar" : "ap");
  const canSee = tab === "ar" ? canAR : canAP;

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[{ label: "Modules", href: "/dashboard" }, { label: "Finance" }]}
      lead="Receivables and payables. The module shell and its permissions are live; entry and invoicing are deliberately not built yet, so nothing here can be mistaken for a real ledger."
    >
      <div className="g2nav">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/finance?tab=${t.id}`}
            className={`g2tab${tab === t.id ? " on" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!canSee ? (
        <p className="note">
          You do not have the {tab === "ar" ? "Finance: AR" : "Finance: AP"}{" "}
          permission.
        </p>
      ) : (
        <>
          <h2 className="sec">
            {tab === "ar" ? "Accounts receivable" : "Accounts payable"}
          </h2>
          <div className="card">
            <div className="constext">
              <p style={{ marginTop: 0 }}>
                No {tab === "ar" ? "receivables" : "payables"} are recorded —
                this module has no data model yet, by choice.
              </p>
              <p style={{ marginBottom: 0, color: "var(--muted)", fontSize: 13 }}>
                The counterweight principle in the Constitution says not to
                build enterprise machinery before it has a consumer. When money
                actually moves through Scout Quest Inc, this is where the
                tables land, gated by the{" "}
                <code>{tab === "ar" ? "Finance: AR" : "Finance: AP"}</code>{" "}
                permission that already exists in the role builder.
              </p>
            </div>
          </div>
          <p className="note">
            Billing today runs through the Scout Quest Education admin console,
            not this OS.
          </p>
        </>
      )}
    </OsShell>
  );
}
