import { NextRequest, NextResponse } from "next/server";

import { getProductReviews } from "@/lib/reviews";
import type { ReviewSort } from "@/lib/review-types";

const SORTS: ReviewSort[] = ["newest", "highest", "lowest"];

/** GET /api/reviews/product?handle=&sort=&offset=  More of a product's approved reviews, for the product page. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const handle = params.get("handle") ?? "";
  if (!/^[a-z0-9-]{1,120}$/.test(handle)) return NextResponse.json({ error: "Unknown product." }, { status: 400 });
  const sort = (SORTS.includes(params.get("sort") as ReviewSort) ? params.get("sort") : "newest") as ReviewSort;
  const offset = Math.max(0, Math.min(10000, Number.parseInt(params.get("offset") ?? "0", 10) || 0));
  const page = await getProductReviews(handle, sort, offset, 6);
  if (!page) return NextResponse.json({ error: "Reviews are not available right now." }, { status: 502 });
  return NextResponse.json(page, { headers: { "Cache-Control": "public, max-age=60" } });
}
