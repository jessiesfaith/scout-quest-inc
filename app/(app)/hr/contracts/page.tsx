import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../../shell";
import {
  AddContractForm,
  StatusToggle,
  DeleteContractButton,
  type MemberOption,
} from "./forms";

export const dynamic = "force-dynamic";

type ContractRow = {
  id: string;
  team_member_id: string | null;
  type: string | null;
  status: string;
  file_path: string | null;
  created_at: string;
};

export default async function ContractsPage() {
  const { supabase, email, isOwner } = await getViewer();

  const canRead =
    (await checkPerm("HR: HR Contracts")) ||
    (await checkPerm("Security Tooling: Change Management"));
  if (!canRead) redirect("/dashboard");
  const canWrite = await checkPerm("HR: HR Contracts");

  const [
    { data: contracts, error: contractsError },
    { data: members, error: membersError },
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, team_member_id, type, status, file_path, created_at")
      .order("created_at", { ascending: false })
      .returns<ContractRow[]>(),
    supabase
      .from("team_members")
      .select("id, name")
      .order("name")
      .returns<MemberOption[]>(),
  ]);

  const loadError = contractsError ?? membersError;
  const memberName = new Map((members ?? []).map((m) => [m.id, m.name]));

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "HR", href: "/hr/team" },
        { label: "HR Contracts" },
      ]}
      lead="NDAs and agreements per team member. Status here drives the contract badges on HR › Team. Files live in a private bucket and open only through short-lived links."
    >
      {loadError ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load: {loadError.message}. Has migration 0006 been run?
        </p>
      ) : (
        <>
          {canWrite && (
            <>
              <h2 className="sec">Add a contract</h2>
              <AddContractForm members={members ?? []} />
            </>
          )}

          <h2 className="sec">HR Contracts</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>File</th>
                  <th>Added</th>
                  {canWrite && <th />}
                </tr>
              </thead>
              <tbody>
                {(contracts ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 6 : 5} style={{ color: "var(--muted)" }}>
                      No contracts yet.
                    </td>
                  </tr>
                ) : (
                  (contracts ?? []).map((c) => (
                    <tr key={c.id}>
                      <td>
                        <b>
                          {c.team_member_id
                            ? (memberName.get(c.team_member_id) ?? "—")
                            : "—"}
                        </b>
                      </td>
                      <td>{c.type ?? "—"}</td>
                      <td>
                        {canWrite ? (
                          <StatusToggle contractId={c.id} status={c.status} />
                        ) : (
                          <span
                            className={`tag ${c.status === "complete" ? "t-hi" : "t-med"}`}
                          >
                            {c.status}
                          </span>
                        )}
                      </td>
                      <td>
                        {c.file_path ? (
                          <a
                            href={`/hr/contracts/download/${c.id}`}
                            target="_blank"
                            rel="noopener"
                            className="crumb"
                          >
                            Open
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(c.created_at).toISOString().slice(0, 10)}
                      </td>
                      {canWrite && (
                        <td style={{ whiteSpace: "nowrap" }}>
                          <DeleteContractButton contractId={c.id} />
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </OsShell>
  );
}
