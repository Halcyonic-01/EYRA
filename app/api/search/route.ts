import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/lib/medusa";
import { buildSearchIndex, searchProducts, type SearchMode } from "@/lib/search";
import { applyRateLimit } from "@/lib/rateLimit";

/** One product as the header search shows it. */
export interface SearchSuggestion {
  id: string;
  name: string;
  price: number;
  hasPriceRange: boolean;
  image: string | null;
}

export interface SearchSuggestions {
  query: string;
  total: number;
  mode: SearchMode;
  correctedQuery?: string;
  suggestions: SearchSuggestion[];
}

const SHOWN = 6;

/** The best matches for a typed query, for the header search as the customer types. */
export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, "search", 120);
  if (limited) return limited;

  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!query) {
    return NextResponse.json({ query, total: 0, mode: "exact", suggestions: [] } satisfies SearchSuggestions);
  }

  const products = await getProducts();
  const result = searchProducts(buildSearchIndex(products), query);
  const body: SearchSuggestions = {
    query,
    total: result.products.length,
    mode: result.mode,
    correctedQuery: result.correctedQuery,
    suggestions: result.products.slice(0, SHOWN).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      hasPriceRange: Boolean(p.hasPriceRange),
      image: p.images[0] ?? null,
    })),
  };
  return NextResponse.json(body);
}
