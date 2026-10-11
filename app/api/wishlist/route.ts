import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

import { getWishlistEntries, setWishlistEntries, type WishlistEntry } from "@/lib/medusa-wishlist";
import { getProductByHandle } from "@/lib/medusa";
import type { Product } from "@/components/products/types";
import { applyRateLimit } from "@/lib/rateLimit";

interface HydratedWishlistItem {
  product: Product;
  variantId: string | undefined;
  size: number | null;
}

async function resolveMedusaCustomerId(): Promise<string | null> {
  const user = await getCurrentUser();
  const id = user?.publicMetadata?.medusaCustomerId;
  return typeof id === "string" ? id : null;
}

/** Fetch the signed-in user's wishlist, hydrated with full product data. */
export async function GET() {
  const customerId = await resolveMedusaCustomerId();
  if (!customerId) {
    return NextResponse.json({ items: [] });
  }

  const entries = await getWishlistEntries(customerId);

  // Hydrate each stored handle with live product data. Deleted/renamed
  // products are dropped rather than surfaced as broken entries.
  const hydrated = await Promise.all(
    entries.map(async (entry): Promise<HydratedWishlistItem | null> => {
      const product = await getProductByHandle(entry.productId);
      if (!product) return null;
      // Keep entry.variantId exactly as stored. Falling back to
      // product.variantId here used to silently turn a ring wishlisted
      // without a chosen size into one with an arbitrary size attached.
      return { product, variantId: entry.variantId, size: entry.size ?? null };
    })
  );
  const items = hydrated.filter((item): item is HydratedWishlistItem => item !== null);

  return NextResponse.json({ items });
}

/** Overwrite the signed-in user's stored wishlist with the given entries. */
export async function PUT(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, "wishlist_put", 60);
  if (rateLimitResponse) return rateLimitResponse;

  const customerId = await resolveMedusaCustomerId();
  if (!customerId) {
    // Guest or not-yet-synced customer, nothing to persist server-side.
    // The local store remains the source of truth until sign-in completes.
    return NextResponse.json({ synced: false });
  }

  const { items } = (await req.json()) as { items?: WishlistEntry[] };
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 });
  }

  const ok = await setWishlistEntries(customerId, items);
  return NextResponse.json({ synced: ok });
}
