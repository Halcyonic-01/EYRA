"use client";

import { useRef, useState } from "react";

const STAR = "M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.53L12 17.5l-5.87 3.07 1.12-6.53L2.5 9.41l6.56-.95L12 2.5z";
export const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Five stars to choose a rating with: tap, or the arrow keys, like any radio group. */
export function StarPicker({
  value,
  onChange,
  label,
  size = 36,
}: {
  value: number;
  onChange: (rating: number) => void;
  label: string;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = hover || value;

  function onKey(event: React.KeyboardEvent, current: number) {
    const next =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? Math.min(5, current + 1)
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? Math.max(1, current - 1)
          : null;
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  }

  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label={label} className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            ref={(el) => {
              refs.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}, ${RATING_WORDS[n]}`}
            tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onKeyDown={(e) => onKey(e, value || n)}
            className="rounded-md p-0.5 transition-transform duration-100 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
              <path d={STAR} fill={n <= shown ? "#020202" : "none"} stroke="#020202" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
      <span className="min-w-[72px] font-sans text-[13px] text-[#626262]" aria-hidden="true">
        {RATING_WORDS[shown]}
      </span>
    </div>
  );
}
