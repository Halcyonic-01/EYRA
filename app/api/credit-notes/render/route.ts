import type { NextRequest } from "next/server";

import { buildCreditNoteView, creditNoteIssues, type CreditNotePayload } from "@/lib/credit-note-view";
import { renderCreditNotePdf } from "@/lib/credit-note-pdf";
import { checkShipmentRequest } from "@/lib/internal-auth";
import { storeConfig } from "@/config/storeConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Draws a credit note as a PDF and hands it back. Called only by the Medusa
 * backend, which issued and numbered the note, stores the file and keeps it.
 * The storefront draws exactly what it is given: it never works out an amount
 * or a number, so the PDF can only ever say what the issued note says.
 *
 * Body: { credit_note: <the credit note document> }
 *
 * A document with no number, no seller GSTIN, no original invoice or no lines is
 * refused (422): such a note is not valid and no file is made of it.
 */
export async function POST(request: NextRequest) {
  const auth = checkShipmentRequest(request);
  if (auth === "unconfigured") return Response.json({ error: "Credit notes are not configured." }, { status: 503 });
  if (auth === "unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { credit_note?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body.credit_note as CreditNotePayload | undefined;
  if (!payload || typeof payload !== "object" || !payload.seller || !payload.totals || !payload.place_of_supply || !payload.order) {
    return Response.json({ error: "credit_note is required." }, { status: 400 });
  }

  const issues = creditNoteIssues(payload);
  if (issues.length) {
    return Response.json({ error: "credit_note_not_valid", message: issues.join(" ") }, { status: 422 });
  }

  try {
    const view = buildCreditNoteView(payload, { bisRegistration: storeConfig.company.bisRegistration });
    const pdf = await renderCreditNotePdf(view);
    return Response.json({
      filename: pdf.filename,
      credit_note_number: view.creditNoteNumber,
      sha256: pdf.sha256,
      pdf_base64: pdf.bytes.toString("base64"),
    });
  } catch (error) {
    console.error("[credit-notes/render] could not draw the PDF for", payload.credit_note_number, ":", error);
    return Response.json({ error: "render_failed", message: "The PDF could not be drawn." }, { status: 500 });
  }
}
