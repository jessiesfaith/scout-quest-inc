"use client";

import { useActionState, useState } from "react";
import {
  createInvoice,
  updateInvoice,
  deleteInvoice,
  recordPayment,
  deletePayment,
  type FinanceState,
} from "./actions";
import {
  METHODS,
  SETTABLE_STATUSES,
  STATUS_TAG,
  money,
  type Direction,
} from "./vocab";
import { useCloseOnSuccess } from "../use-close-on-success";

const initialState: FinanceState = { error: null, success: false };

export type Invoice = {
  id: string;
  direction: string;
  reference: string | null;
  counterparty: string;
  product_id: string | null;
  description: string | null;
  amount: number;
  currency: string;
  issued_on: string;
  due_on: string | null;
  status: string;
  notes: string | null;
  paid: number;
  balance: number;
  overdue: boolean;
};

export type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  paid_on: string;
  method: string | null;
  reference: string | null;
};

export type ProductOption = { id: string; name: string };

function Fields({
  direction,
  products,
  value,
}: {
  direction: Direction;
  products: ProductOption[];
  value?: Invoice;
}) {
  const k = value?.id ?? "new";
  const computed = value?.status === "part-paid" || value?.status === "paid";

  return (
    <>
      <input type="hidden" name="direction" value={direction} />
      <div className="field-row">
        <div className="field">
          <label htmlFor={`cp-${k}`}>
            {direction === "receivable" ? "Customer" : "Supplier"}
          </label>
          <input
            id={`cp-${k}`}
            name="counterparty"
            required
            maxLength={120}
            defaultValue={value?.counterparty ?? ""}
            placeholder={
              direction === "receivable"
                ? "Riverside Unified School District"
                : "Supabase"
            }
          />
        </div>
        <div className="field">
          <label htmlFor={`ref-${k}`}>Reference</label>
          <input
            id={`ref-${k}`}
            name="reference"
            maxLength={60}
            defaultValue={value?.reference ?? ""}
            placeholder="INV-0001"
          />
        </div>
        <div className="field">
          <label htmlFor={`amt-${k}`}>Amount</label>
          <input
            id={`amt-${k}`}
            name="amount"
            required
            inputMode="decimal"
            defaultValue={value ? String(value.amount) : ""}
            placeholder="1200.00"
          />
        </div>
        <div className="field">
          <label htmlFor={`st-${k}`}>Status</label>
          {/* Always defaults to the status the row already has, so saving
              an unrelated field resubmits what it came in with. Defaulting
              a computed row to "void" — the one value updateInvoice lets
              through — meant editing a paid invoice's description silently
              voided it. */}
          <select
            id={`st-${k}`}
            name="status"
            defaultValue={value?.status ?? "draft"}
          >
            {computed && (
              <option value={value!.status}>
                {value!.status} — set by payments, leave as is
              </option>
            )}
            {SETTABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`iss-${k}`}>Issued</label>
          <input
            id={`iss-${k}`}
            name="issued_on"
            type="date"
            defaultValue={
              value?.issued_on ?? new Date().toISOString().slice(0, 10)
            }
          />
        </div>
        <div className="field">
          <label htmlFor={`due-${k}`}>Due</label>
          <input
            id={`due-${k}`}
            name="due_on"
            type="date"
            defaultValue={value?.due_on ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor={`prod-${k}`}>Product</label>
          <select
            id={`prod-${k}`}
            name="product_id"
            defaultValue={value?.product_id ?? ""}
          >
            <option value="">— company-wide —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`desc-${k}`}>What it is for</label>
        <input
          id={`desc-${k}`}
          name="description"
          maxLength={200}
          defaultValue={value?.description ?? ""}
          placeholder="Annual licence, 2026–27 school year"
        />
      </div>
      {computed && (
        <p className="note" style={{ margin: "2px 0 10px" }}>
          This invoice has payments against it, so its status is maintained
          from those. Choosing <b>void</b> is the only status change
          available here; remove the payments first if that is wrong.
        </p>
      )}
    </>
  );
}

export function AddInvoiceForm({
  direction,
  products,
}: {
  direction: Direction;
  products: ProductOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createInvoice,
    initialState,
  );
  useCloseOnSuccess(state, () => setOpen(false));

  if (!open) {
    return (
      <p style={{ margin: "0 0 14px" }}>
        <button type="button" className="addbtn" onClick={() => setOpen(true)}>
          {direction === "receivable" ? "Raise an invoice" : "Record a bill"}
        </button>
      </p>
    );
  }

  return (
    <form action={formAction} className="formcard">
      <Fields direction={direction} products={products} />
      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        className="addbtn2"
        onClick={() => setOpen(false)}
        disabled={pending}
      >
        Cancel
      </button>
      {state.error && <p className="err">{state.error}</p>}
    </form>
  );
}

function PaymentPanel({
  invoice,
  payments,
}: {
  invoice: Invoice;
  payments: Payment[];
}) {
  const [state, formAction, pending] = useActionState(
    recordPayment,
    initialState,
  );
  const [delState, delAction, delPending] = useActionState(
    deletePayment,
    initialState,
  );

  return (
    <div>
      {payments.length > 0 && (
        <table style={{ marginBottom: 10 }}>
          <thead>
            <tr>
              <th>Paid</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td style={{ fontSize: 12 }}>{p.paid_on}</td>
                <td>{money(p.amount, invoice.currency)}</td>
                <td style={{ color: "var(--muted)" }}>{p.method ?? "—"}</td>
                <td style={{ color: "var(--muted)", fontSize: 12 }}>
                  {p.reference ?? "—"}
                </td>
                <td>
                  <form action={delAction} style={{ display: "inline" }}>
                    <input type="hidden" name="payment_id" value={p.id} />
                    <input
                      type="hidden"
                      name="direction"
                      value={invoice.direction}
                    />
                    <button
                      type="submit"
                      className="minibtn del"
                      style={{ marginLeft: 0 }}
                      disabled={delPending}
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {delState.error && <p className="err">{delState.error}</p>}

      {invoice.balance > 0 && invoice.status !== "void" ? (
        <form action={formAction} className="field-row" style={{ alignItems: "end" }}>
          <input type="hidden" name="invoice_id" value={invoice.id} />
          <input type="hidden" name="direction" value={invoice.direction} />
          <div className="field">
            <label htmlFor={`pamt-${invoice.id}`}>Payment amount</label>
            <input
              id={`pamt-${invoice.id}`}
              name="amount"
              required
              inputMode="decimal"
              defaultValue={String(invoice.balance)}
            />
          </div>
          <div className="field">
            <label htmlFor={`pon-${invoice.id}`}>Paid on</label>
            <input
              id={`pon-${invoice.id}`}
              name="paid_on"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div className="field">
            <label htmlFor={`pm-${invoice.id}`}>Method</label>
            <select id={`pm-${invoice.id}`} name="method" defaultValue="transfer">
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`pref-${invoice.id}`}>Reference</label>
            <input id={`pref-${invoice.id}`} name="reference" maxLength={60} />
          </div>
          <div className="field">
            <button type="submit" className="addbtn" disabled={pending}>
              {pending ? "Saving…" : "Record payment"}
            </button>
          </div>
        </form>
      ) : (
        <p className="note" style={{ margin: 0 }}>
          {invoice.status === "void"
            ? "Voided — no further payments."
            : "Settled in full."}
        </p>
      )}
      {state.error && <p className="err">{state.error}</p>}
    </div>
  );
}

function Row({
  invoice,
  payments,
  products,
  columns,
}: {
  invoice: Invoice;
  payments: Payment[];
  products: ProductOption[];
  columns: number;
}) {
  const [panel, setPanel] = useState<"none" | "edit" | "pay">("none");
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateInvoice,
    initialState,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteInvoice,
    initialState,
  );
  useCloseOnSuccess(state, () => setPanel("none"));

  const productName = products.find((p) => p.id === invoice.product_id)?.name;

  return (
    <>
      <tr>
        <td>
          <b>{invoice.counterparty}</b>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {[invoice.reference, invoice.description].filter(Boolean).join(" · ") ||
              "—"}
          </div>
        </td>
        <td style={{ fontSize: 12 }}>{productName ?? "company-wide"}</td>
        <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
          {invoice.issued_on}
          {invoice.due_on && (
            <div>
              due {invoice.due_on}
              {invoice.overdue && (
                <span className="tag t-hi" style={{ marginLeft: 5 }}>
                  overdue
                </span>
              )}
            </div>
          )}
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          {money(invoice.amount, invoice.currency)}
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          <b>{money(invoice.balance, invoice.currency)}</b>
          {invoice.paid > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
              {money(invoice.paid, invoice.currency)} paid
            </div>
          )}
        </td>
        <td>
          <span className={`tag ${STATUS_TAG[invoice.status] ?? "t-lo"}`}>
            {invoice.status}
          </span>
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button
            type="button"
            className="minibtn"
            style={{ marginLeft: 0 }}
            onClick={() => setPanel(panel === "pay" ? "none" : "pay")}
          >
            Payments
          </button>
          <button
            type="button"
            className="minibtn"
            onClick={() => setPanel(panel === "edit" ? "none" : "edit")}
          >
            Edit
          </button>
          {!confirming ? (
            <button
              type="button"
              className="minibtn del"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          ) : (
            <form action={delAction} style={{ display: "inline" }}>
              <input type="hidden" name="id" value={invoice.id} />
              <input type="hidden" name="direction" value={invoice.direction} />
              <button
                type="submit"
                className="minibtn del"
                disabled={delPending}
              >
                {delPending ? "…" : "Confirm"}
              </button>
              <button
                type="button"
                className="minibtn"
                onClick={() => setConfirming(false)}
              >
                Keep
              </button>
            </form>
          )}
        </td>
      </tr>

      {delState.error && (
        <tr>
          <td colSpan={columns} className="err">
            {delState.error}
          </td>
        </tr>
      )}

      {panel === "pay" && (
        <tr>
          <td colSpan={columns}>
            <PaymentPanel invoice={invoice} payments={payments} />
          </td>
        </tr>
      )}

      {panel === "edit" && (
        <tr>
          <td colSpan={columns}>
            <form action={formAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <Fields
                direction={invoice.direction as Direction}
                products={products}
                value={invoice}
              />
              <button type="submit" className="addbtn" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="addbtn2"
                onClick={() => setPanel("none")}
                disabled={pending}
              >
                Cancel
              </button>
              {state.error && <p className="err">{state.error}</p>}
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

export function Ledger({
  invoices,
  payments,
  products,
  direction,
}: {
  invoices: Invoice[];
  payments: Payment[];
  products: ProductOption[];
  direction: Direction;
}) {
  const byInvoice = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = byInvoice.get(p.invoice_id) ?? [];
    list.push(p);
    byInvoice.set(p.invoice_id, list);
  }

  if (invoices.length === 0) {
    return (
      <p className="note">
        Nothing recorded yet —{" "}
        {direction === "receivable"
          ? "raise the first invoice above."
          : "record the first bill above."}
      </p>
    );
  }

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>{direction === "receivable" ? "Customer" : "Supplier"}</th>
            <th>Product</th>
            <th>Dates</th>
            <th>Amount</th>
            <th>Outstanding</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <Row
              key={i.id}
              invoice={i}
              payments={byInvoice.get(i.id) ?? []}
              products={products}
              columns={7}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
