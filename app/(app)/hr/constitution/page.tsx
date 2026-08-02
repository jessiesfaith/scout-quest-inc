import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "HR › Scout Quest AI Constitution — Scout Quest Inc",
};

// The Constitution is governed outside this app — it lives in the repo as
// markdown and renders read-only here. To publish a new version, replace
// the file; never edit governance text through the UI.
const DOC = "docs/enterprise-constitution-v1.3.md";

export default async function ConstitutionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  let markdown: string | null = null;
  try {
    markdown = await readFile(path.join(process.cwd(), DOC), "utf8");
  } catch {
    markdown = null;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">
        HR › Scout Quest AI Constitution
      </h1>
      <p className="mt-1 text-sm text-muted">
        Enterprise Constitution v1.3 — read-only. Governed outside this app;
        the source of truth is <code>{DOC}</code> in the repo, and version
        history lives in git.
      </p>

      {markdown === null ? (
        <p className="mt-8 text-sm text-danger">
          Could not read {DOC}.
        </p>
      ) : (
        <article className="prose-constitution mt-8 rounded-2xl border border-border bg-surface p-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}
