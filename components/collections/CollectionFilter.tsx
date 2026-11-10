import Link from "next/link";
import type { Collection } from "@/config/collections";

/**
 * Buttons under a collection heading that narrow the listing to one of the
 * collections in `options`. The selection lives in the `filter` query param, so
 * a filtered view can be shared and the back button works. Clicking the active
 * button clears it.
 */
export function CollectionFilter({
  base,
  options,
  active,
}: {
  base: Collection;
  options: Collection[];
  active: Collection | null;
}) {
  if (options.length === 0) return null;

  return (
    <nav aria-label={`Filter ${base.label}`} className="flex flex-wrap gap-2 mt-6">
      {options.map((option) => {
        const isActive = active?.slug === option.slug;
        const href = isActive
          ? `/collections/${base.slug}`
          : `/collections/${base.slug}?filter=${option.slug}`;
        return (
          <Link
            key={option.slug}
            href={href}
            scroll={false}
            aria-current={isActive ? "true" : undefined}
            className={
              isActive
                ? "font-sans font-light text-[13px] tracking-[0.15em] uppercase px-5 py-2 border border-black bg-black text-white transition-colors duration-200"
                : "font-sans font-light text-[13px] tracking-[0.15em] uppercase px-5 py-2 border border-black/20 text-[#505050] hover:border-black hover:text-black transition-colors duration-200"
            }
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
