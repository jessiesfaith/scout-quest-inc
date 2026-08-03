import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { getPermissions, can } from "@/lib/reachable";
import { OsShell } from "../shell";
import { AddContractForm, ContractsTable, type Contract } from "./editor";
import { CATEGORY_LABEL } from "./vocab";

export const dynamic = "force-dynamic";

export default async function CompanyContractsPage() {
  const { supabase, email, isOwner } = await getViewer();
  const held = await getPermissions();
  if (!can(held, "Contracts", "HR: HR Contracts", "Security Tooling: Change Management"))
    redirect("/dashboard");

  // Change Management holds a read key only: it can see every agreement for
  // audit, but maintaining them belongs to Contracts and HR.
  const canEdit = can(held, "Contracts", "HR: HR Contracts");

  const [{ data: contracts, error }, { data: members }] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id, team_member_id, counterparty, category, type, status, file_path, effective_on, expires_on, obligations, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<Contract[]>(),
    supabase.from("team_members").select("id, name"),
  ]);

  const memberName = new Map(
    (members ?? []).map((m: { id: string; name: string }) => [m.id, m.name]),
  );
  const list = contracts ?? [];

  // The party column resolves here, where the team_members join lives, so
  // the table component never needs the member list.
  const partyNames: Record<string, string> = {};
  for (const c of list) {
    partyNames[c.id] =
      c.counterparty ??
      (c.team_member_id ? (memberName.get(c.team_member_id) ?? "—") : "—");
  }

  // Anything expiring inside 60 days is what you actually came here for —
  // and anything already past its end date is a separate, worse problem.
  // Compared as YYYY-MM-DD strings so a `date` column is never shifted a
  // day by the server's timezone.
  const todayStr = new Date().toISOString().slice(0, 10);
  const soonDate = new Date();
  soonDate.setUTCDate(soonDate.getUTCDate() + 60);
  const soonStr = soonDate.toISOString().slice(0, 10);

  const isLapsed = (c: Contract) => !!c.expires_on && c.expires_on < todayStr;
  const isExpiring = (c: Contract) =>
    !!c.expires_on && c.expires_on >= todayStr && c.expires_on <= soonStr;

  const lapsed = list.filter(isLapsed);
  const expiring = list.filter(isExpiring);
  const byCategory = new Map<string, Contract[]>();
  for (const c of list) {
    const list2 = byCategory.get(c.category) ?? [];
    list2.push(c);
    byCategory.set(c.category, list2);
  }

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[{ label: "Modules", href: "/dashboard" }, { label: "Contracts" }]}
      lead="The company's agreements in one place — NDAs, DPAs and BAAs, district agreements and vendors — with the compliance obligations attached to each. Employment contracts are visible only to holders of HR: HR Contracts or Security Tooling: Change Management, so whoever tracks vendor paperwork does not also read staff offers, and they are maintained on HR › Contracts rather than here."
    >
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load contracts: {error.message}. Has migration 0012 been
          run?
        </p>
      ) : (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="n">{list.length}</div>
              <div className="l">agreements</div>
            </div>
            <div className="tile">
              <div className="n" style={{ color: "var(--warn)" }}>
                {list.filter((c) => c.status === "pending").length}
              </div>
              <div className="l">pending signature</div>
            </div>
            <div className="tile">
              <div
                className="n"
                style={{ color: expiring.length ? "var(--warn)" : "var(--ok)" }}
              >
                {expiring.length}
              </div>
              <div className="l">expiring within 60 days</div>
            </div>
            <div className="tile">
              <div
                className="n"
                style={{ color: lapsed.length ? "var(--danger)" : "var(--ok)" }}
              >
                {lapsed.length}
              </div>
              <div className="l">already past their end date</div>
            </div>
          </div>

          {canEdit && <AddContractForm />}

          {[...byCategory.entries()].map(([category, rows]) => (
            <div key={category}>
              <h2 className="sec">
                {CATEGORY_LABEL[category] ?? category} ({rows.length})
              </h2>
              <ContractsTable
                rows={rows}
                partyNames={partyNames}
                canEdit={canEdit}
                todayStr={todayStr}
                soonStr={soonStr}
              />
            </div>
          ))}

          {list.length === 0 && (
            <p className="note">
              No agreements visible here yet.{" "}
              {canEdit
                ? "Record the first one above."
                : "This view is read-only; the Contracts permission covers changes."}
            </p>
          )}

          {can(held, "HR: HR Contracts") && (
            <p className="note">
              Employment contracts are maintained on{" "}
              <Link href="/hr/contracts" className="crumb">
                HR › Contracts
              </Link>
              , where the person they belong to is part of the form.
            </p>
          )}
        </>
      )}
    </OsShell>
  );
}
