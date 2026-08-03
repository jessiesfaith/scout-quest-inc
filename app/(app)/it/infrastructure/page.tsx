import { getViewer } from "@/lib/viewer";
import { getPermissions, can } from "@/lib/reachable";
import { OsShell } from "../../shell";
import { itNav, itCrumbHref } from "../nav";
import { AddInfrastructureForm, InfraTable, type Item } from "./editor";

export const dynamic = "force-dynamic";

export default async function InfrastructurePage() {
  const { supabase, email, isOwner } = await getViewer();
  const held = await getPermissions();
  const canEdit = can(held, "IT: Agent Platform");

  const { data: items, error } = await supabase
    .from("infrastructure")
    .select(
      "id, name, kind, environment, provider, data_classes, status, notes, sort",
    )
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
      ) : (
        <>
          {canEdit && <AddInfrastructureForm />}

          {list.length === 0 && (
            <p className="note">
              Nothing recorded yet — migration 0012 seeds what this OS runs on.
            </p>
          )}

          {[...byEnv.entries()].map(([env, rows]) => (
            <div key={env}>
              <h2 className="sec">{env}</h2>
              <InfraTable rows={rows} canEdit={canEdit} />
            </div>
          ))}

          <p className="note">
            Anything marked <span className="no-d3">D3</span> is regulated
            (student or patient) data and must stay on local infrastructure.
            {canEdit
              ? " Changes made here are live immediately and are not version-controlled — record anything structural in Security Tooling › Change Log."
              : " Read-only — the IT: Agent Platform permission covers changes."}
          </p>
        </>
      )}
    </OsShell>
  );
}
