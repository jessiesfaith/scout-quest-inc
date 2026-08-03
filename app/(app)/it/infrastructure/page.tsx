import { getViewer } from "@/lib/viewer";
import { getPermissions, can } from "@/lib/reachable";
import { OsShell } from "../../shell";
import { itNav, itCrumbHref } from "../nav";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  name: string;
  kind: string;
  environment: string;
  provider: string | null;
  data_classes: string | null;
  status: string;
  notes: string | null;
};

const STATUS: Record<string, string> = {
  live: "b-live",
  building: "b-ready",
  planned: "b-plan",
  retired: "b-reg",
};

export default async function InfrastructurePage() {
  const { supabase, email, isOwner } = await getViewer();
  const held = await getPermissions();

  const { data: items, error } = await supabase
    .from("infrastructure")
    .select("id, name, kind, environment, provider, data_classes, status, notes")
    .order("sort")
    .order("id")
    .returns<Item[]>();

  const list = items ?? [];
  const byEnv = new Map<string, Item[]>();
  for (const i of list) {
    const arr = byEnv.get(i.environment) ?? [];
    arr.push(i);
    byEnv.set(i.environment, arr);
  }

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: itCrumbHref("/it/infrastructure", held) },
        { label: "Infrastructure" },
      ]}
      lead="What this company actually runs on, and which data class each piece is allowed to touch. Regulated data (D3) lives only on the governed local plane — never in this OS or anything it talks to."
      nav={itNav("/it/infrastructure", held)}
    >
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load infrastructure: {error.message}. Has migration 0012
          been run?
        </p>
      ) : list.length === 0 ? (
        <p className="note">Nothing recorded yet — run migration 0012.</p>
      ) : (
        <>
          {[...byEnv.entries()].map(([env, rows]) => (
            <div key={env}>
              <h2 className="sec">{env}</h2>
              <div className="card">
                <table>
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Kind</th>
                      <th>Provider</th>
                      <th>Data classes</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <b>{i.name}</b>
                          {i.notes && (
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>
                              {i.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ color: "var(--muted)" }}>{i.kind}</td>
                        <td>{i.provider ?? "—"}</td>
                        <td>
                          <span
                            className={
                              i.data_classes?.includes("D3") ? "no-d3" : undefined
                            }
                          >
                            {i.data_classes ?? "—"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${STATUS[i.status] ?? "b-reg"}`}>
                            {i.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="note">
            Anything marked <span className="no-d3">D3</span> is regulated
            (student or patient) data and must stay on local infrastructure.
            {can(held, "IT: Agent Platform")
              ? " Editing this inventory is not built yet — change it in migration 0012 so the record stays version-controlled."
              : " Read-only — the IT: Agent Platform permission covers changes."}
          </p>
        </>
      )}
    </OsShell>
  );
}
