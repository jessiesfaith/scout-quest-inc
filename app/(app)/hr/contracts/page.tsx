import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import {
  AddContractForm,
  StatusToggle,
  DeleteContractButton,
  type MemberOption,
} from "./forms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "HR › Contracts — Scout Quest Inc",
};

type ContractRow = {
  id: string;
  team_member_id: string | null;
  type: string | null;
  status: string;
  file_path: string | null;
  created_at: string;
};

export default async function ContractsPage() {
  const canRead =
    (await checkPerm("HR: HR Contracts")) ||
    (await checkPerm("Security Tooling: Change Management"));
  if (!canRead) redirect("/dashboard");

  const canWrite = await checkPerm("HR: HR Contracts");

  const supabase = await createClient();
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
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">HR › Contracts</h1>
      <p className="mt-1 text-sm text-muted">
        NDAs and agreements per team member. Status here drives the contract
        column on{" "}
        <Link href="/hr/team" className="text-accent hover:underline">
          HR › Team
        </Link>
        .
      </p>

      {loadError ? (
        <p className="mt-8 text-sm text-danger">
          Could not load: {loadError.message}. Has migration 0006 been run?
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {canWrite && <AddContractForm members={members ?? []} />}

          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {(contracts ?? []).length === 0 ? (
              <p className="p-5 text-sm text-muted">No contracts yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                    <th className="px-5 py-3 font-medium">Member</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">File</th>
                    <th className="px-5 py-3 font-medium">Added</th>
                    {canWrite && <th className="px-5 py-3 font-medium" />}
                  </tr>
                </thead>
                <tbody>
                  {(contracts ?? []).map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-5 py-3 font-medium">
                        {c.team_member_id
                          ? (memberName.get(c.team_member_id) ?? "—")
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-muted">{c.type ?? "—"}</td>
                      <td className="px-5 py-3">
                        {canWrite ? (
                          <StatusToggle contractId={c.id} status={c.status} />
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              c.status === "complete"
                                ? "bg-success/10 text-success"
                                : "bg-gold/15 text-gold"
                            }`}
                          >
                            {c.status}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {c.file_path ? (
                          <a
                            href={`/hr/contracts/download/${c.id}`}
                            target="_blank"
                            rel="noopener"
                            className="text-accent hover:underline"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      {canWrite && (
                        <td className="px-5 py-3 text-right">
                          <DeleteContractButton contractId={c.id} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
