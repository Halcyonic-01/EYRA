"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { Dropdown } from "@/components/ui/Dropdown";
import type { Product } from "./types";

type ProductType = "ring" | "chain" | "earring" | "bracelet" | "anklet";
type SortOption = "trending" | "price-asc" | "price-desc" | "newest";
type PriceRange = "all" | "under-1500" | "1500-2500" | "2500-4000" | "above-4000";

const PRICE_RANGES: { label: string; value: PriceRange }[] = [
  { label: "All prices", value: "all" },
  { label: "Under ₹1,500", value: "under-1500" },
  { label: "₹1,500 – ₹2,500", value: "1500-2500" },
  { label: "₹2,500 – ₹4,000", value: "2500-4000" },
  { label: "Above ₹4,000", value: "above-4000" },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Trending", value: "trending" },
  { label: "Price: Low to High", value: "price-asc" },
  { label: "Price: High to Low", value: "price-desc" },
  { label: "Newest", value: "newest" },
];

const TYPE_OPTIONS: { label: string; value: ProductType }[] = [
  { label: "Rings", value: "ring" },
  { label: "Chains", value: "chain" },
  { label: "Earrings", value: "earring" },
  { label: "Bracelets", value: "bracelet" },
  { label: "Anklets", value: "anklet" },
];

function priceInRange(price: number, range: PriceRange): boolean {
  switch (range) {
    case "under-1500": return price < 1500;
    case "1500-2500": return price >= 1500 && price <= 2500;
    case "2500-4000": return price > 2500 && price <= 4000;
    case "above-4000": return price > 4000;
    default: return true;
  }
}

function CheckboxRow({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-3 cursor-pointer group text-left py-1.5"
      onClick={onClick}
    >
      <span
        className={`w-4 h-4 border rounded-sm flex items-center justify-center shrink-0 transition-colors duration-150 ${
          checked ? "bg-black border-black" : "border-[#CFCFCF] group-hover:border-black"
        }`}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="font-sans font-light text-[14px] leading-[21px] text-[#3D3D3D] group-hover:text-black transition-colors duration-150">
        {label}
      </span>
    </button>
  );
}

function RadioRow({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-3 cursor-pointer group text-left py-1.5"
      onClick={onClick}
    >
      <span
        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-150 ${
          checked ? "border-black" : "border-[#CFCFCF] group-hover:border-black"
        }`}
      >
        {checked && <span className="w-2 h-2 rounded-full bg-black block" />}
      </span>
      <span className="font-sans font-light text-[14px] leading-[21px] text-[#3D3D3D] group-hover:text-black transition-colors duration-150">
        {label}
      </span>
    </button>
  );
}

export function ProductsClient({
  products,
  initialQuery = "",
}: {
  products: Product[];
  initialQuery?: string;
}) {
  const [selectedTypes, setSelectedTypes] = useState<ProductType[]>([]);
  const [priceRange, setPriceRange] = useState<PriceRange>("all");
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const [query, setQuery] = useState(initialQuery);

  const filtered = useMemo(() => {
    let result = [...products];
    const q = query.trim();
    if (q) {
      // Match at word starts only (e.g. "ring" -> "Ring"/"Rings") rather than
      // anywhere in the string, plain substring matching means "ring" would
      // also match "earRING" inside every earring's name/type.
      const pattern = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
      result = result.filter(
        (p) => pattern.test(p.name) || pattern.test(p.description) || pattern.test(p.type)
      );
    }
    if (selectedTypes.length > 0) {
      result = result.filter((p) => selectedTypes.includes(p.type));
    }
    result = result.filter((p) => priceInRange(p.price, priceRange));
    if (sortBy === "price-asc") result.sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") result.sort((a, b) => b.price - a.price);
    // "Newest" was offered in the dropdown but had no branch here, so picking
    // it just relabelled the control and left the order untouched. getProducts
    // returns the catalogue in Medusa's creation order, so reversing it puts
    // the most recently added stock first, which is exactly how /new-arrivals
    // decides what counts as new.
    if (sortBy === "newest") result.reverse();
    return result;
  }, [products, query, selectedTypes, priceRange, sortBy]);

  function toggleType(type: ProductType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function clearFilters() {
    setSelectedTypes([]);
    setPriceRange("all");
    setSortBy("trending");
    setQuery("");
  }

  // clearFilters resets sortBy too, so sort has to count as "active" here or
  // the only control that undoes it stays hidden while it is in effect.
  const hasActiveFilters =
    selectedTypes.length > 0 || priceRange !== "all" || query.trim() !== "" || sortBy !== "trending";
  const typeLabel = selectedTypes.length === 0
    ? "Type"
    : selectedTypes.length === 1
      ? TYPE_OPTIONS.find((t) => t.value === selectedTypes[0])?.label
      : `Type (${selectedTypes.length})`;
  const priceLabel = priceRange === "all" ? "Price" : PRICE_RANGES.find((p) => p.value === priceRange)?.label;
  const sortLabel = sortBy === "trending" ? "Sort by" : SORT_OPTIONS.find((s) => s.value === sortBy)?.label;

  return (
    <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
      {/* Breadcrumb */}
      <div className="py-5">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 font-sans font-normal text-[16px] leading-[24px]">
          <Link href="/" className="text-[#5F5F5F] hover:text-black transition-colors duration-200 text-center">
            Home
          </Link>
          <span className="text-[#5F5F5F] mx-1">›</span>
          <span className="text-black">Products</span>
        </nav>
      </div>

      <div className="w-full h-px bg-[#CFCFCF]" />

      {/* Search */}
      <div className="py-5 flex items-center gap-3 max-w-[420px]">
        <Search size={16} strokeWidth={1.5} className="text-[#909090] shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rings, chains, earrings…"
          aria-label="Search products"
          className="flex-1 bg-transparent font-sans font-light text-[15px] text-black placeholder:text-[#909090] focus:outline-none border-b border-[#CFCFCF] focus:border-black pb-1.5 transition-colors duration-200"
        />
        {query && (
          <button
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="text-[#909090] hover:text-black transition-colors duration-200 shrink-0"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className="w-full h-px bg-[#CFCFCF]" />

      {/* Page title */}
      <div className="py-5">
        <h1 className="font-sans font-normal text-[28px] leading-[42px] text-black">
          All Products ({filtered.length} results)
        </h1>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 pb-5 overflow-x-auto">
        <Dropdown label={typeLabel ?? "Type"} active={selectedTypes.length > 0}>
          {() => (
            <div className="flex flex-col min-w-[180px]">
              {TYPE_OPTIONS.map(({ label, value }) => (
                <CheckboxRow
                  key={value}
                  label={label}
                  checked={selectedTypes.includes(value)}
                  onClick={() => toggleType(value)}
                />
              ))}
            </div>
          )}
        </Dropdown>

        <Dropdown label={priceLabel ?? "Price"} active={priceRange !== "all"}>
          {(close) => (
            <div className="flex flex-col min-w-[190px]">
              {PRICE_RANGES.map(({ label, value }) => (
                <RadioRow
                  key={value}
                  label={label}
                  checked={priceRange === value}
                  onClick={() => {
                    setPriceRange(value);
                    close();
                  }}
                />
              ))}
            </div>
          )}
        </Dropdown>

        <Dropdown label={sortLabel ?? "Sort by"} active={sortBy !== "trending"}>
          {(close) => (
            <div className="flex flex-col min-w-[190px]">
              {SORT_OPTIONS.map(({ label, value }) => (
                <RadioRow
                  key={value}
                  label={label}
                  checked={sortBy === value}
                  onClick={() => {
                    setSortBy(value);
                    close();
                  }}
                />
              ))}
            </div>
          )}
        </Dropdown>

        {hasActiveFilters && (
          <button
            className="font-sans font-light text-[13px] text-[#909090] hover:text-black underline underline-offset-2 transition-colors duration-200 shrink-0"
            onClick={clearFilters}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="w-full h-px bg-[#CFCFCF]" />

      {/* Product grid */}
      <div className="py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="font-sans font-normal text-[18px] text-[#909090] text-center">
              No products match your filters.
            </p>
            <button
              className="font-sans font-medium text-[14px] text-black underline underline-offset-2 hover:text-[#626262] transition-colors duration-200"
              onClick={clearFilters}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 border-t border-l border-[#CFCFCF]">
            {filtered.map((product) => (
              <div key={product.id} className="border-b border-r border-[#CFCFCF]">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
