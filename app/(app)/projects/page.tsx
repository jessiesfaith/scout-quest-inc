import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../shell";
import { Gantt } from "../products/gantt";
import { AddProjectForm, DeleteProject } from "./forms";

export const dynamic = "force-dynamic";

type Project = {
  id: string;
  name: string;
  summary: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

const BADGE: Record<string, string> = {
  live: "b-live",
  building: "b-ready",
  planned: "b-plan",
};

export default async function ProjectsPage() {
  const { supabase, email, isOwner } = await getViewer();
  const canWrite = await checkPerm("Projects");

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, summary, status, start_date, end_date")
    .order("sort")
    .order("id")
    .returns<Project[]>();

  const list = projects ?? [];

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[{ label: "Modules", href: "/dashboard" }, { label: "Projects" }]}
      lead="Cross-product projects — work that spans more than one product, or none of them."
    >
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load projects: {error.message}. Has migration 0011 been
          run?
        </p>
      ) : (
        <>
          {canWrite && (
            <>
              <h2 className="sec">Add a project</h2>
              <AddProjectForm />
            </>
          )}

          <h2 className="sec">Schedule</h2>
          <Gantt
            emptyMessage="No projects with dates yet — add a start and end date above and the schedule appears here."
            rows={list.map((p) => ({
              id: p.id,
              title: p.name,
              start_date: p.start_date,
              end_date: p.end_date,
              status: p.status,
            }))}
          />

          <h2 className="sec">Projects</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Summary</th>
                  <th>Dates</th>
                  <th>Status</th>
                  {canWrite && <th />}
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 5 : 4} style={{ color: "var(--muted)" }}>
                      No projects yet.
                    </td>
                  </tr>
                ) : (
                  list.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.name}</b>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{p.summary ?? "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {p.start_date ?? "—"} → {p.end_date ?? "—"}
                      </td>
                      <td>
                        <span className={`badge ${BADGE[p.status] ?? "b-reg"}`}>
                          {p.status}
                        </span>
                      </td>
                      {canWrite && (
                        <td>
                          <DeleteProject id={p.id} />
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
