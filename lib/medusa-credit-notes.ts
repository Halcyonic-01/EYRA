/**
 * Server-only: a customer's credit notes. They live in Medusa; customers sign in
 * with Clerk, so the browser never talks to Medusa: these helpers call the admin
 * API with the server key, and the routes that use them check ownership first.
 */
import "server-only";

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

export interface CreditNoteSummary {
  id: string;
  number: string;
  kind: "return" | "exchange" | "cancellation" | "rto";
  issuedAt: string;
  originalInvoiceNumber: string;
  total: number;
  deduction: number;
  netCredit: number;
}

interface RawCreditNote {
  id: string;
  credit_note_number: string;
  kind: CreditNoteSummary["kind"];
  original_invoice_number: string;
  issued_at: string;
  total: number;
  deduction: number;
  net_credit: number;
}

/** The credit notes issued on an order, newest first. Null when they cannot be read. */
export async function listCreditNotes(orderId: string): Promise<CreditNoteSummary[] | null> {
  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE_URL}/admin/credit-notes?order_id=${encodeURIComponent(orderId)}&limit=50`, {
      headers: { Authorization: `Basic ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { credit_notes?: RawCreditNote[] };
    return (body.credit_notes ?? []).map((note) => ({
      id: note.id,
      number: note.credit_note_number,
      kind: note.kind,
      issuedAt: note.issued_at,
      originalInvoiceNumber: note.original_invoice_number,
      total: Number(note.total),
      deduction: Number(note.deduction),
      netCredit: Number(note.net_credit),
    }));
  } catch (error) {
    console.error("[credit-notes] could not list the credit notes for", orderId, ":", error);
    return null;
  }
}

/** The stored PDF of a credit note, drawn on the spot by the backend if it was not kept yet. */
export async function fetchCreditNotePdf(noteId: string): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE_URL}/admin/credit-notes/${encodeURIComponent(noteId)}/pdf`, {
      headers: { Authorization: `Basic ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("application/pdf")) return null;
    const disposition = res.headers.get("content-disposition") ?? "";
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "EYRA-credit-note.pdf";
    return { bytes: new Uint8Array(await res.arrayBuffer()), filename };
  } catch (error) {
    console.error("[credit-notes] could not read the PDF of", noteId, ":", error);
    return null;
  }
}
