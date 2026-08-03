import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { getPermissions, can } from "@/lib/reachable";
import { OsShell } from "../shell";

export const dynamic = "force-dynamic";

type Contract = {
  id: string;
  team_member_id: string | null;
  counterparty: string | null;
  category: string;
  type: string | null;
  status: string;
  file_path: string | null;
  effective_on: string | null;
  expires_on: string | null;
  obligations: string | null;
  created_at: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  employment: "Employment",
  vendor: "Vendor",
  district: "District",
  "dpa-baa": "DPA / BAA",
  partner: "Partner",
  other: "Other",
};

export default async function CompanyContractsPage() {
  const { supabase, email, isOwner } = await getViewer();
  const held = await getPermissions();
  if (!can(held, "Contracts", "HR: HR Contracts", "Security Tooling: Change Management"))
    redirect("/dashboard");

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
      lead="The company's agreements in one place — NDAs, DPAs and BAAs, district agreements and vendors — with the compliance obligations attached to each. This screen is read-only. Employment contracts appear here only for HR: they stay behind the HR key, so whoever tracks vendor paperwork does not also read staff offers."
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

          {[...byCategory.entries()].map(([category, rows]) => (
            <div key={category}>
              <h2 className="sec">
                {CATEGORY_LABEL[category] ?? category} ({rows.length})
              </h2>
              <div className="card">
                <table>
                  <thead>
                    <tr>
                      <th>Party</th>
                      <th>Type</th>
                      <th>Obligations</th>
                      <th>Dates</th>
                      <th>File</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <b>
                            {c.counterparty ??
                              (c.team_member_id
                                ? (memberName.get(c.team_member_id) ?? "—")
                                : "—")}
                          </b>
                        </td>
                        <td>{c.type ?? "—"}</td>
                        <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
                          {c.obligations ?? "—"}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>
                          {c.effective_on ?? "—"} → {c.expires_on ?? "—"}
                          {isLapsed(c) && (
                            <span className="tag t-hi" style={{ marginLeft: 5 }}>
                              expired
                            </span>
                          )}
                          {isExpiring(c) && (
                            <span className="tag t-lo" style={{ marginLeft: 5 }}>
                              expiring
                            </span>
                          )}
                        </td>
                        <td>
                          {c.file_path ? (
                            <a
                              href={`/hr/contracts/download/${c.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="crumb"
                            >
                              Open
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <span
                            className={`tag ${c.status === "complete" ? "t-hi" : "t-med"}`}
                          >
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {list.length === 0 && (
            <p className="note">
              No agreements visible here yet.{" "}
              {can(held, "HR: HR Contracts") ? (
                <>
                  Add them under{" "}
                  <Link href="/hr/contracts" className="crumb">
                    HR › Contracts
                  </Link>
                  .
                </>
              ) : (
                <>
                  Non-employment agreements are entered in SQL for now; ask HR
                  to add one.
                </>
              )}
            </p>
          )}
        </>
      )}
    </OsShell>
  );
}
