"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { SearchSuggestions } from "@/app/api/search/route";

const DEBOUNCE_MS = 150;

/** The bar under the header: shows matching products while the customer types. */
export function HeaderSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<SearchSuggestions | null>(null);
  const [failed, setFailed] = useState(false);
  const typed = query.trim();

  useEffect(() => {
    input.current?.focus();
  }, []);

  // Ask for results shortly after the last keystroke; an older answer never replaces a newer one.
  useEffect(() => {
    if (!typed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(typed)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        setFound((await res.json()) as SearchSuggestions);
        setFailed(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setFailed(true);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onClose();
    router.push(typed ? `/products?q=${encodeURIComponent(typed)}` : "/products");
  }

  const current = found && typed && found.query === typed ? found : null;
  const loading = Boolean(typed) && !current && !failed;

  return (
    <div className="absolute inset-x-0 top-full border-b border-[#CFCFCF] bg-white shadow-md">
      <div className="mx-auto w-full max-w-screen-xl px-6 py-3 lg:px-10">
        <form role="search" onSubmit={submit} className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rings, chains, anklets…"
              aria-label="Search the store"
              className="w-full rounded-full border border-[#CFCFCF] bg-white py-2 pl-4 pr-10 font-sans text-[14px] text-black placeholder:text-[#909090] focus:border-black focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setFound(null);
                  input.current?.focus();
                }}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#626262] hover:bg-[#EDEDED] hover:text-black"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
          <button
            type="submit"
            aria-label="Search"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition-colors duration-200 hover:bg-[#1a1a1a]"
          >
            <Search size={16} strokeWidth={1.75} />
          </button>
        </form>

        {typed && (
          <div className="mt-3 max-h-[60vh] overflow-y-auto" aria-live="polite">
            {loading && <p className="py-3 font-sans text-[13px] text-[#909090]">Searching…</p>}
            {failed && !current && (
              <p className="py-3 font-sans text-[13px] text-[#909090]">
                Search is unavailable right now. Press Enter to see all products.
              </p>
            )}
            {current && current.suggestions.length === 0 && (
              <p className="py-3 font-sans text-[13px] text-[#626262]">No products found for “{typed}”.</p>
            )}
            {current && current.suggestions.length > 0 && (
              <>
                {current.mode !== "exact" && (
                  <p className="pb-2 font-sans text-[12px] text-[#909090]">
                    {current.mode === "corrected" && current.correctedQuery
                      ? `Showing results for “${current.correctedQuery}”`
                      : current.mode === "closest"
                        ? `No exact match for “${typed}”. Closest products:`
                        : `Products matching part of “${typed}”`}
                  </p>
                )}
                <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                  {current.suggestions.map((product) => (
                    <li key={product.id}>
                      <Link
                        href={`/products/${product.id}`}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[#F5F5F5]"
                      >
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[#F5F5F5]">
                          {product.image && (
                            <Image src={product.image} alt="" fill sizes="56px" className="object-contain" />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-sans text-[14px] font-medium text-black">{product.name}</span>
                          <span className="font-sans text-[13px] text-[#626262]">
                            {product.hasPriceRange ? "From " : ""}₹{product.price.toLocaleString("en-IN")}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/products?q=${encodeURIComponent(typed)}`}
                  className="mt-2 inline-block font-sans text-[13px] font-medium text-black underline underline-offset-4"
                >
                  See all {current.total} {current.total === 1 ? "result" : "results"}
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
