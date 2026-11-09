import { Fragment } from "react";
import { TOTE_MIN_SUBTOTAL } from "@/config/offers";

const DIAMOND = "◆";

// Kept short so the lines read cleanly at the bar's small size.
const MESSAGES = [
  "EYRA Launch Sale is Live Now!",
  `Complimentary tote bag above ₹${TOTE_MIN_SUBTOTAL.toLocaleString("en-IN")}!`,
  "Easy Return and Exchange!",
];

// Desktop ticker: the launch sale line only.
const LAUNCH_TICKER = "Launch Sale";

// How many times the set of lines repeats inside one half of the track.
// Enough that a half is wider than any phone screen, so the loop is seamless.
const MOBILE_REPEATS = 3;
const DESKTOP_REPEATS = 16;

/**
 * One half of the track: each line preceded by a diamond, repeated `repeats`
 * times. Every token sits in the same flex row with one gap, so the diamonds
 * are spaced evenly from the text and from each other.
 */
function Group({ lines, repeats, hidden }: { lines: string[]; repeats: number; hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-5" aria-hidden={hidden || undefined}>
      {Array.from({ length: repeats }, (_, r) =>
        lines.map((line, i) => (
          <Fragment key={`${r}-${i}`}>
            <span aria-hidden="true">{DIAMOND}</span>
            <span>{line}</span>
          </Fragment>
        ))
      )}
    </div>
  );
}

/**
 * Slim announcement bar fixed above the header. The lines scroll right to left
 * on a seamless CSS loop and pause on hover:
 * - Below lg: every announcement in MESSAGES.
 * - lg and up: the launch sale line only.
 */
export function AnnouncementBanner() {
  return (
    <div
      role="region"
      aria-label="Announcements"
      className="marquee fixed inset-x-0 top-0 z-50 flex items-center overflow-hidden bg-crimson text-white"
      style={{ height: "var(--banner-height)" }}
    >
      <p className="sr-only">{MESSAGES.join(". ")}</p>

      <div className="marquee-track flex w-max whitespace-nowrap font-sans text-[0.66rem] font-normal uppercase tracking-[0.16em] will-change-transform sm:text-[0.72rem] lg:hidden">
        <Group lines={MESSAGES} repeats={MOBILE_REPEATS} hidden />
        <Group lines={MESSAGES} repeats={MOBILE_REPEATS} hidden />
      </div>

      <div className="hidden h-full w-full overflow-hidden lg:flex lg:items-center">
        <div className="marquee-track flex w-max whitespace-nowrap font-sans text-[0.72rem] font-normal uppercase tracking-[0.3em] will-change-transform">
          <Group lines={[LAUNCH_TICKER]} repeats={DESKTOP_REPEATS} hidden />
          <Group lines={[LAUNCH_TICKER]} repeats={DESKTOP_REPEATS} hidden />
        </div>
      </div>
    </div>
  );
}
