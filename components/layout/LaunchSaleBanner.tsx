const COPIES_PER_GROUP = 24;

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center"
      aria-hidden={hidden || undefined}
    >
      {Array.from({ length: COPIES_PER_GROUP }, (_, i) => (
        <span key={i} className="flex items-center">
          <span>LAUNCH SALE</span>
          <span className="px-4 sm:px-6" aria-hidden="true">
            •
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Thin red announcement strip fixed directly below the navbar. The text
 * scrolls right to left on a CSS-only loop and pauses on hover. Page content is
 * offset by --header-offset (see globals.css).
 */
export function LaunchSaleBanner() {
  return (
    <div
      role="region"
      aria-label="Announcement"
      className="marquee fixed inset-x-0 z-30 flex items-center overflow-hidden bg-red-600 text-white"
      style={{ top: "var(--nav-height)", height: "var(--banner-height)" }}
    >
      <span className="sr-only">Launch sale</span>
      <div className="marquee-track flex w-max whitespace-nowrap text-xs font-bold uppercase tracking-[0.2em] will-change-transform sm:text-sm">
        <Group hidden />
        <Group hidden />
      </div>
    </div>
  );
}
