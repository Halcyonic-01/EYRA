import { NextRequest, NextResponse } from "next/server";

import { applyRateLimit } from "@/lib/rateLimit";
import { preparePhoto } from "@/lib/review-photo";
import { wellFormedReviewToken } from "@/lib/review-links";
import { uploadAccountPhoto, uploadLinkPhoto } from "@/lib/reviews";
import { getWalletCustomer } from "@/lib/wallet-customer";

export const runtime = "nodejs";

/**
 * One photo for a review. Form fields: `file`, and either `token` (the review
 * link) or `orderId` (a signed-in customer's order). The photo is checked,
 * turned the right way up, shrunk and stripped of its location and camera data
 * before it is stored.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, "review_photo", 40);
  if (limited) return limited;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Please choose a photo." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Please choose a photo." }, { status: 400 });
  const token = form.get("token");
  const orderId = form.get("orderId");

  const prepared = await preparePhoto(Buffer.from(await file.arrayBuffer()));
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: 400 });

  if (typeof token === "string" && token) {
    if (!wellFormedReviewToken(token)) return NextResponse.json({ error: "This review link is not valid." }, { status: 400 });
    const reply = await uploadLinkPhoto(token, prepared.base64);
    return reply.ok ? NextResponse.json({ photo: reply.data.photo }) : NextResponse.json({ error: reply.message }, { status: reply.status === 0 ? 502 : 400 });
  }

  if (typeof orderId === "string" && orderId.startsWith("order_")) {
    const customer = await getWalletCustomer();
    if (!customer) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const reply = await uploadAccountPhoto(customer.customerId, orderId, prepared.base64);
    return reply.ok ? NextResponse.json({ photo: reply.data.photo }) : NextResponse.json({ error: reply.message }, { status: reply.status === 404 ? 404 : 400 });
  }
  return NextResponse.json({ error: "This review link is not valid." }, { status: 400 });
}
