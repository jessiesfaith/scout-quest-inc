import { readFile } from "node:fs/promises";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getViewer } from "@/lib/viewer";
import { OsShell } from "../../shell";

export const dynamic = "force-dynamic";

// The Constitution is governed outside this app — it lives in the repo as
// markdown and renders read-only here. To publish a new version, replace
// the file; never edit governance text through the UI.
const DOC = "docs/enterprise-constitution-v1.4.md";

export default async function ConstitutionPage() {
  const { email, isOwner } = await getViewer();

  let markdown: string | null = null;
  try {
    markdown = await readFile(path.join(process.cwd(), DOC), "utf8");
  } catch {
    markdown = null;
  }

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "HR", href: "/hr/team" },
        { label: "Scout Quest AI Constitution" },
      ]}
      lead="Enterprise Constitution v1.4 (draft — pending attorney review) — read-only. Governed outside this app; the source of truth is the markdown in the repo, and version history lives in git. v1.3 is the last approved version."
    >
      <h2 className="sec">Full text — Scout Quest AI Constitution (v1.4, draft)</h2>
      {markdown === null ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not read {DOC}.
        </p>
      ) : (
        <div className="card">
          <div className="constext">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </OsShell>
  );
}
