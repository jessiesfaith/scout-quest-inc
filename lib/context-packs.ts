import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

// Context packs — server-side only. The FILES in docs/agents/context/ are
// the record, so "current" always means what shipped in this deploy and
// cannot drift from the build. The database holds the history, because the
// deployed app has no git to ask.
//
// Keep the hash rule identical to MANIFEST.sha256 and capture-context.mjs:
// sha256 over CRLF-normalised UTF-8. Three places computing it three ways
// would make every comparison meaningless.

const CTX_DIR = path.join(process.cwd(), "docs", "agents", "context");

export type Pack = {
  id: string;
  title: string;
  path: string;
  declaredVersion: string | null;
  sha256: string;
  bytes: number;
  lines: number;
  content: string;
};

export function hashText(text: string) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

function declaredVersion(text: string) {
  const m = text.match(/\*\*version\*\*\s*([0-9]+(?:\.[0-9]+)*)/i);
  return m ? m[1] : null;
}

function titleOf(text: string, id: string) {
  const m = text.match(/^#\s*(.+)$/m);
  if (!m) return id;
  return m[1].replace(new RegExp(`^${id}\\s*[—–-]\\s*`), "").trim();
}

/** Every pack on disk, sorted by id. Returns [] if the directory is absent. */
export async function readPacks(): Promise<Pack[]> {
  let files: string[];
  try {
    files = (await readdir(CTX_DIR)).filter((f) => /^CTX-\d{3}.*\.md$/.test(f)).sort();
  } catch {
    return [];
  }

  const out: Pack[] = [];
  for (const f of files) {
    const raw = await readFile(path.join(CTX_DIR, f), "utf8");
    const norm = raw.replace(/\r\n/g, "\n");
    const id = f.slice(0, 7);
    out.push({
      id,
      title: titleOf(norm, id),
      path: `docs/agents/context/${f}`,
      declaredVersion: declaredVersion(norm),
      sha256: hashText(raw),
      bytes: Buffer.byteLength(norm, "utf8"),
      lines: norm.split("\n").length,
      content: norm,
    });
  }
  return out;
}

export async function readPack(id: string): Promise<Pack | null> {
  if (!/^CTX-\d{3}$/.test(id)) return null; // never let an id reach the path
  const packs = await readPacks();
  return packs.find((p) => p.id === id) ?? null;
}

// ---------- The reverse index ----------

/**
 * "CTX-001, CTX-004|CTX-005" → the pages an agent loads.
 * A '|' group means "whichever of these fits the work order", so every
 * member is reachable but conditionally — the screen labels it.
 */
export function parsePacks(spec: string | null | undefined): {
  id: string;
  conditional: boolean;
}[] {
  if (!spec) return [];
  const out: { id: string; conditional: boolean }[] = [];
  for (const group of spec.split(",")) {
    const members = group.split("|").map((s) => s.trim()).filter(Boolean);
    const conditional = members.length > 1;
    for (const m of members) {
      if (/^CTX-\d{3}$/.test(m)) out.push({ id: m, conditional });
    }
  }
  return out;
}

export type LoaderAgent = {
  agent_id: string;
  layer: string | null;
  department: string | null;
  lifecycle: string | null;
  risk_ceiling: string | null;
  spec_path: string | null;
  context_pages: string | null;
};

/** page id → the agents that load it. The answer to "who reads CTX-003?". */
export function loadersByPack(agents: LoaderAgent[]) {
  const map = new Map<string, { agent: LoaderAgent; conditional: boolean }[]>();
  for (const a of agents) {
    for (const { id, conditional } of parsePacks(a.context_pages)) {
      const list = map.get(id) ?? [];
      list.push({ agent: a, conditional });
      map.set(id, list);
    }
  }
  for (const list of map.values()) list.sort((x, y) => x.agent.agent_id.localeCompare(y.agent.agent_id));
  return map;
}

// ---------- Diff ----------

export type DiffLine = {
  kind: "same" | "add" | "del";
  text: string;
  leftNo: number | null;
  rightNo: number | null;
};

/**
 * Line diff via longest common subsequence. No dependency: the app ships a
 * strict client bundle and a diff library is not worth a package for this.
 *
 * Guard rail: LCS is O(n*m), so very long pages fall back to a plain
 * "these differ" rather than hanging the request.
 */
export function diffLines(before: string, after: string): DiffLine[] | null {
  const a = before.replace(/\r\n/g, "\n").split("\n");
  const b = after.replace(/\r\n/g, "\n").split("\n");
  if (a.length * b.length > 4_000_000) return null;

  // Trim the common head and tail first — governance edits are usually a
  // few lines inside a long document, so this makes the matrix small.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail++;

  const aMid = a.slice(head, a.length - tail);
  const bMid = b.slice(head, b.length - tail);

  const n = aMid.length;
  const m = bMid.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        aMid[i] === bMid[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let leftNo = 1;
  let rightNo = 1;
  for (let k = 0; k < head; k++) {
    out.push({ kind: "same", text: a[k], leftNo: leftNo++, rightNo: rightNo++ });
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aMid[i] === bMid[j]) {
      out.push({ kind: "same", text: aMid[i], leftNo: leftNo++, rightNo: rightNo++ });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "del", text: aMid[i], leftNo: leftNo++, rightNo: null });
      i++;
    } else {
      out.push({ kind: "add", text: bMid[j], leftNo: null, rightNo: rightNo++ });
      j++;
    }
  }
  while (i < n) out.push({ kind: "del", text: aMid[i++], leftNo: leftNo++, rightNo: null });
  while (j < m) out.push({ kind: "add", text: bMid[j++], leftNo: null, rightNo: rightNo++ });

  for (let k = a.length - tail; k < a.length; k++) {
    out.push({ kind: "same", text: a[k], leftNo: leftNo++, rightNo: rightNo++ });
  }
  return out;
}

/** Collapse long unchanged stretches so a diff reads as changes, not as the document. */
export function collapseUnchanged(lines: DiffLine[], keep = 3) {
  const changed = new Set<number>();
  lines.forEach((l, i) => {
    if (l.kind !== "same") {
      for (let k = Math.max(0, i - keep); k <= Math.min(lines.length - 1, i + keep); k++) {
        changed.add(k);
      }
    }
  });
  const out: ({ gap: number } | DiffLine)[] = [];
  let gap = 0;
  lines.forEach((l, i) => {
    if (changed.has(i)) {
      if (gap > 0) {
        out.push({ gap });
        gap = 0;
      }
      out.push(l);
    } else {
      gap++;
    }
  });
  if (gap > 0) out.push({ gap });
  return out;
}
