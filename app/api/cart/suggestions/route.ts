import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/lib/medusa";
import { applyRateLimit } from "@/lib/rateLimit";
import { pickSuggestions } from "@/lib/cart-suggestions";

/** GET /api/cart/suggestions?inBag=handle,handle */
export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, "cart_suggestions", 120);
  if (limited) return limited;

  const inBag = (req.nextUrl.searchParams.get("inBag") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, 50);
  try {
    const products = await getProducts();
    return NextResponse.json({ products: pickSuggestions(products, inBag) });
  } catch (err) {
    console.error("[cart/suggestions] could not load products:", err);
    return NextResponse.json({ products: [] });
  }
}
