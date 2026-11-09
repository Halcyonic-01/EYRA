"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/** Horizontal product search for the homepage announcement strip. */
export function HomeSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className="flex w-full max-w-[300px] items-center rounded-full border border-[#CFCFCF] bg-white py-1 pl-4 pr-1 transition-colors duration-200 focus-within:border-black"
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search rings, chains, anklets…"
        aria-label="Search products"
        className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-black placeholder:text-[#909090] focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-white transition-colors duration-200 hover:bg-[#1a1a1a]"
      >
        <Search size={14} strokeWidth={1.75} />
      </button>
    </form>
  );
}
