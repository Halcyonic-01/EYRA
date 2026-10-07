import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  className?: string;
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg" | "xl";
}

/*
  Wordmark source: public/images/logo-eyra-{white,black}.svg, rebuilt as clean
  vector strokes from the original artwork (same letter shapes and stroke
  weights) so it stays sharp at every size (viewBox 264:154, the same box the
  earlier PNGs used). The PNGs in logo-mark-* are the old
  low-resolution originals, kept only as a fallback. The logo is the wordmark
  alone, with no "Jewel" line.
*/
const WORDMARK_ASPECT = 264 / 154;

const sizes = {
  sm: { markH: 22 },
  md: { markH: 28 },
  lg: { markH: 38 },
  xl: { markH: 46 },
} as const;

export function Logo({ className = "", variant = "dark", size = "md" }: LogoProps) {
  const { markH } = sizes[size];
  const markW = Math.round(markH * WORDMARK_ASPECT);

  return (
    <Link
      href="/"
      aria-label="EYRA Home"
      className={`inline-flex items-start ${className} hover:opacity-80 transition-opacity duration-200`}
    >
      <Image
        src={variant === "light" ? "/images/logo-eyra-white.svg" : "/images/logo-eyra-black.svg"}
        alt="EYRA"
        width={markW}
        height={markH}
        priority
        unoptimized
        className="w-auto shrink-0"
        style={{ height: markH }}
      />
    </Link>
  );
}
