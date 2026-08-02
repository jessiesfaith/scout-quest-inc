import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../../shell";
import { MissionValuesForm } from "./form";
import type { ValueItem } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  purpose: string | null;
  mission: string | null;
  values: ValueItem[] | null;
  updated_at: string;
};

export default async function MissionValuesPage() {
  const { supabase, email, isOwner } = await getViewer();
  const canEdit = await checkPerm("HR: Mission & Values");

  const { data, error } = await supabase
    .from("mission_values")
    .select("purpose, mission, values, updated_at")
    .eq("scope", "company")
    .maybeSingle<Row>();

  const values = Array.isArray(data?.values) ? data.values : [];

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "HR", href: "/hr/team" },
        { label: "Mission & Values" },
      ]}
      lead="The company's purpose, mission, and values."
    >
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load: {error.message}. Has migration 0006 been run?
        </p>
      ) : !data ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          The company Mission &amp; Values row is missing — run migration 0006.
        </p>
      ) : canEdit ? (
        <MissionValuesForm
          purpose={data.purpose ?? ""}
          mission={data.mission ?? ""}
          values={values}
        />
      ) : (
        <>
          <h2 className="sec">Purpose</h2>
          <div className="card">
            <div className="constext">{data.purpose ?? "—"}</div>
          </div>
          <h2 className="sec">Mission</h2>
          <div className="card">
            <div className="constext">{data.mission ?? "—"}</div>
          </div>
          <h2 className="sec">Values</h2>
          <div className="modgrid">
            {values.map((v, i) => (
              <div className="modcard" key={i}>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
          <p className="note">
            Read-only — editing needs the HR: Mission &amp; Values permission.
          </p>
        </>
      )}
    </OsShell>
  );
}
