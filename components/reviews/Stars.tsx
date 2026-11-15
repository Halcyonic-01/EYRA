const STAR = "M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.53L12 17.5l-5.87 3.07 1.12-6.53L2.5 9.41l6.56-.95L12 2.5z";

/**
 * A star rating to read, filled to the exact value (4.3 fills four stars and a
 * third of the fifth). The value is also given as text for screen readers.
 */
export function Stars({ value, size = 16, className = "" }: { value: number; size?: number; className?: string }) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span className={`inline-flex items-center gap-[2px] ${className}`} role="img" aria-label={`${clamped.toFixed(1).replace(/\.0$/, "")} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, clamped - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden="true">
            <svg width={size} height={size} viewBox="0 0 24 24" className="absolute inset-0">
              <path d={STAR} fill="none" stroke="#020202" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <svg width={size} height={size} viewBox="0 0 24 24">
                <path d={STAR} fill="#020202" stroke="#020202" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </span>
          </span>
        );
      })}
    </span>
  );
}
