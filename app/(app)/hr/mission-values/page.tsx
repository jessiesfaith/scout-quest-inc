import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import { MissionValuesForm } from "./form";
import type { ValueItem } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "HR › Mission & Values — Scout Quest Inc",
};

type Row = {
  purpose: string | null;
  mission: string | null;
  values: ValueItem[] | null;
  updated_at: string;
};

export default async function MissionValuesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const canEdit = await checkPerm("HR: Mission & Values");

  const { data, error } = await supabase
    .from("mission_values")
    .select("purpose, mission, values, updated_at")
    .eq("scope", "company")
    .maybeSingle<Row>();

  const values = Array.isArray(data?.values) ? data.values : [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">HR › Mission &amp; Values</h1>
      <p className="mt-1 text-sm text-muted">
        The company&apos;s purpose, mission, and values.
        {data?.updated_at && (
          <> Last updated {new Date(data.updated_at).toLocaleDateString()}.</>
        )}
      </p>

      {error ? (
        <p className="mt-8 text-sm text-danger">
          Could not load: {error.message}. Has migration 0006 been run?
        </p>
      ) : !data ? (
        <p className="mt-8 text-sm text-danger">
          The company Mission &amp; Values row is missing — run migration 0006.
        </p>
      ) : (
        <div className="mt-8">
          {canEdit ? (
            <MissionValuesForm
              purpose={data.purpose ?? ""}
              mission={data.mission ?? ""}
              values={values}
            />
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-surface p-5">
                <div className="text-xs font-medium uppercase tracking-wider text-muted">
                  Purpose
                </div>
                <p className="mt-1.5 text-sm">{data.purpose ?? "—"}</p>
                <div className="mt-4 text-xs font-medium uppercase tracking-wider text-muted">
                  Mission
                </div>
                <p className="mt-1.5 text-sm">{data.mission ?? "—"}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {values.map((v, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-border bg-surface p-5"
                  >
                    <div className="text-sm font-semibold text-accent">
                      {v.title}
                    </div>
                    <p className="mt-1 text-sm text-muted">{v.body}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted">
                Read-only — editing needs the HR: Mission &amp; Values
                permission.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
