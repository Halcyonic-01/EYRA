import { NextRequest, NextResponse } from "next/server";

import { applyRateLimit } from "@/lib/rateLimit";
import { wellFormedReviewToken } from "@/lib/review-links";
import { submitAccountReviews, submitLinkReviews } from "@/lib/reviews";
import type { ReviewSubmission } from "@/lib/review-types";
import { getWalletCustomer } from "@/lib/wallet-customer";

interface Body {
  token?: unknown;
  orderId?: unknown;
  reviews?: unknown;
  /** A field people never see; only bots fill it in. */
  website?: unknown;
}

function cleanReviews(value: unknown): ReviewSubmission[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const out: ReviewSubmission[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    if (typeof row.line_item_id !== "string" || !row.line_item_id.startsWith("ordli_")) return null;
    out.push({
      line_item_id: row.line_item_id,
      rating: Number(row.rating),
      title: typeof row.title === "string" ? row.title : null,
      body: typeof row.body === "string" ? row.body : "",
      display_name: typeof row.display_name === "string" ? row.display_name : null,
      photo_ids: Array.isArray(row.photo_ids) ? row.photo_ids.filter((id): id is string => typeof id === "string").slice(0, 10) : [],
    });
  }
  return out;
}

/**
 * Sends reviews: with the review link (`token`), or as the signed-in owner of
 * an order (`orderId`). Every review is checked by our team before it shows.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, "review_submit", 20);
  if (limited) return limited;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  // A bot filled in the hidden field: say thanks and store nothing.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });

  const reviews = cleanReviews(body.reviews);
  if (!reviews) return NextResponse.json({ error: "Rate at least one product." }, { status: 400 });

  if (typeof body.token === "string" && body.token) {
    if (!wellFormedReviewToken(body.token)) return NextResponse.json({ error: "This review link is not valid." }, { status: 400 });
    const reply = await submitLinkReviews(body.token, reviews);
    return reply.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: reply.message }, { status: reply.status === 0 ? 502 : 400 });
  }

  if (typeof body.orderId === "string" && body.orderId.startsWith("order_")) {
    const customer = await getWalletCustomer();
    if (!customer) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const reply = await submitAccountReviews(customer.customerId, body.orderId, reviews);
    return reply.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: reply.message }, { status: reply.status === 404 ? 404 : 400 });
  }
  return NextResponse.json({ error: "This review link is not valid." }, { status: 400 });
}
