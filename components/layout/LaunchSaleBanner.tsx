const COPIES_PER_GROUP = 24;

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center"
      aria-hidden={hidden || undefined}
    >
      {Array.from({ length: COPIES_PER_GROUP }, (_, i) => (
        <span key={i} className="flex items-center">
          <span>Launch Sale</span>
          <span className="px-6 sm:px-8 text-[#A39A8C]" aria-hidden="true">
            ·
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Quiet warm-neutral announcement strip fixed directly below the navbar. The
 * text scrolls right to left on a slow CSS-only loop and pauses on hover. Page
 * content is offset by --header-offset (see globals.css).
 */
export function LaunchSaleBanner() {
  return (
    <div
      role="region"
      aria-label="Announcement"
      className="marquee fixed inset-x-0 z-30 flex items-center overflow-hidden bg-[#F3EFE8] text-[#4D4D4D] border-b border-[#E4DED4]"
      style={{ top: "var(--nav-height)", height: "var(--banner-height)" }}
    >
      <span className="sr-only">Launch sale</span>
      <div className="marquee-track flex w-max whitespace-nowrap font-sans text-[0.66rem] font-normal uppercase tracking-[0.3em] will-change-transform sm:text-[0.7rem]">
        <Group hidden />
        <Group hidden />
      </div>
    </div>
  );
}
