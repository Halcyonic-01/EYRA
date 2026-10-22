import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { fetchInvoiceOrder } from "@/lib/invoice-order";
import { fetchCreditNotePdf, listCreditNotes } from "@/lib/medusa-credit-notes";
import { applyRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * A credit note as a PDF, for the customer who owns the order and nobody else.
 * The note must belong to that order, so a note id alone reveals nothing about
 * anyone else's. The file is never given a public address.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const limited = await applyRateLimit(req, "credit_note_pdf", 60);
  if (limited) return limited;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  const { id, noteId } = await params;
  if (!id.startsWith("order_") || !noteId.startsWith("crn_")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const order = await fetchInvoiceOrder(id);
  const customerId = user.publicMetadata?.medusaCustomerId;
  if (!order || typeof customerId !== "string" || order.customer_id !== customerId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const notes = await listCreditNotes(id);
  if (!notes?.some((note) => note.id === noteId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const pdf = await fetchCreditNotePdf(noteId);
  if (!pdf) {
    return NextResponse.json(
      { error: "credit_note_unavailable", message: "Your credit note is being prepared. Please try again later." },
      { status: 503 }
    );
  }
  return new Response(Buffer.from(pdf.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
