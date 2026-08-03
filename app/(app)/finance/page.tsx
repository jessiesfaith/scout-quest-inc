import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../shell";
import {
  AddInvoiceForm,
  Ledger,
  type Invoice,
  type Payment,
  type ProductOption,
} from "./ledger";
import { money, type Direction } from "./vocab";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "ar", label: "AR", direction: "receivable" as Direction },
  { id: "ap", label: "AP", direction: "payable" as Direction },
] as const;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: raw } = await searchParams;
  const { supabase, email, isOwner } = await getViewer();
  const [canAR, canAP] = await Promise.all([
    checkPerm("Finance: AR"),
    checkPerm("Finance: AP"),
  ]);
  if (!canAR && !canAP) redirect("/dashboard");

  // Land on a tab the viewer can actually see rather than always AR.
  const requested = TABS.find((t) => t.id === raw)?.id;
  const tab = requested ?? (canAR ? "ar" : "ap");
  const canSee = tab === "ar" ? canAR : canAP;
  const direction: Direction = tab === "ar" ? "receivable" : "payable";

  // RLS already restricts rows to the side the viewer holds a key for;
  // filtering by direction as well keeps the two tabs apart for anyone
  // holding both.
  const [{ data: invoices, error }, { data: payments }, { data: products }] =
    await Promise.all([
      supabase
        .from("invoice_balances")
        .select(
          "id, direction, reference, counterparty, product_id, description, amount, currency, issued_on, due_on, status, notes, paid, balance, overdue",
        )
        .eq("direction", direction)
        .order("issued_on", { ascending: false })
        .returns<Invoice[]>(),
      supabase
        .from("payments")
        .select("id, invoice_id, amount, paid_on, method, reference")
        .order("paid_on", { ascending: false })
        .returns<Payment[]>(),
      supabase
        .from("products")
        .select("id, name")
        .order("name")
        .returns<ProductOption[]>(),
    ]);

  const list = invoices ?? [];
  const onRegister = list.filter((i) => i.status !== "void");

  // Only an invoice that has actually gone out is money owed. A draft is
  // something someone is still writing, and counting it inflates the one
  // number on this page anybody acts on. `paid` rows contribute a zero
  // balance, so including them changes nothing but keeps the set honest.
  const owed = list.filter(
    (i) => i.status === "sent" || i.status === "part-paid",
  );
  const outstanding = owed.reduce((sum, i) => sum + Number(i.balance), 0);
  const overdue = owed.filter((i) => i.overdue);
  const overdueTotal = overdue.reduce((sum, i) => sum + Number(i.balance), 0);

  // Cash that moved, over EVERY row including voided ones. Money received
  // against an invoice that was later voided is still money received —
  // dropping it here would make the figure disagree with the bank.
  const collected = list.reduce((sum, i) => sum + Number(i.paid), 0);

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[{ label: "Modules", href: "/dashboard" }, { label: "Finance" }]}
      lead="An invoice register: who owes the company, what the company owes, and what is overdue. Deliberately not an accounting system — no double entry, no chart of accounts, no tax. An invoice's outstanding balance is never stored; it is computed as the amount less the payments recorded against it, so there is no second copy of it to go stale."
    >
      <div className="g2nav">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/finance?tab=${t.id}`}
            className={`g2tab${tab === t.id ? " on" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!canSee ? (
        <p className="note">
          You do not have the {tab === "ar" ? "Finance: AR" : "Finance: AP"}{" "}
          permission. The two are separate on purpose: chasing what customers
          owe and authorising what the company pays are different jobs.
        </p>
      ) : error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load: {error.message}. Has migration 0017 been run?
        </p>
      ) : (
        <>
          <h2 className="sec">
            {tab === "ar" ? "Accounts receivable" : "Accounts payable"}
          </h2>

          <div className="tiles">
            <div className="tile">
              <div className="n">{money(outstanding)}</div>
              <div className="l">
                {tab === "ar" ? "owed to the company" : "owed by the company"}
              </div>
            </div>
            <div className="tile">
              <div
                className="n"
                style={{ color: overdue.length ? "var(--danger)" : "var(--ok)" }}
              >
                {money(overdueTotal)}
              </div>
              <div className="l">
                overdue{overdue.length ? ` · ${overdue.length}` : ""}
              </div>
            </div>
            <div className="tile">
              <div className="n">{money(collected)}</div>
              <div className="l">{tab === "ar" ? "collected" : "paid"}</div>
            </div>
            <div className="tile">
              <div className="n">{onRegister.length}</div>
              <div className="l">
                {tab === "ar" ? "invoices" : "bills"} on the register
              </div>
            </div>
          </div>

          <AddInvoiceForm direction={direction} products={products ?? []} />

          <Ledger
            invoices={list}
            payments={payments ?? []}
            products={products ?? []}
            direction={direction}
          />

          <p className="note">
            Outstanding and overdue count only invoices marked sent or
            part-paid — a draft is not yet money owed. Collected counts every
            payment ever recorded, including against invoices later voided,
            because that cash still moved. A payment larger than the
            outstanding balance is refused rather than absorbed, since this
            register has no credit note to net it off with, and an invoice
            cannot be reduced below what has already been paid against it.
            Model spend on the governed plane
            is tracked separately under{" "}
            <Link href="/it/agent-platform?tab=spend" className="crumb">
              IT › Agent Platform
            </Link>
            ; it is not a payable until a provider invoices for it.
          </p>
        </>
      )}
    </OsShell>
  );
}
