import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  className?: string;
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg" | "xl";
}

/*
  Wordmark source: public/images/logo-mark-{white,black}.png. Both are
  cropped tight to just the "EYRA" wordmark and its flourish (native aspect
  ratio 264:154), sourced from the brand's real logo artwork and keyed to
  transparent. The logo is the wordmark alone, with no "Jewel" line.
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
        src={variant === "light" ? "/images/logo-mark-white.png" : "/images/logo-mark-black.png"}
        alt="EYRA"
        width={markW}
        height={markH}
        priority
        className="w-auto shrink-0"
        style={{ height: markH }}
      />
    </Link>
  );
}
