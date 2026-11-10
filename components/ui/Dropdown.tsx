"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronDown } from "lucide-react";

/**
 * A trigger button that opens a panel below it, closing on an outside click
 * or Escape. No positioning library is installed, so the panel is always
 * anchored left with a fixed min-width, which is enough for short filter
 * lists but not general-purpose menu placement.
 *
 * The panel renders through a portal into document.body rather than as a
 * normal child. Its original position (a plain absolute div inside the
 * trigger's wrapper) got silently clipped whenever an ancestor set
 * overflow-x, e.g. a horizontally scrolling filter bar, since the CSS
 * overflow spec makes overflow-x: auto also imply a non-visible overflow-y
 * unless overflow-y is set separately, and that cuts off anything
 * absolutely positioned outside the container's own height regardless of
 * z-index. Portaling out of that ancestor sidesteps the clipping entirely.
 */
export function Dropdown({
  label,
  active,
  icon,
  iconClassName = "",
  compact = false,
  closeArrow = false,
  children,
}: {
  label: string;
  /** When set, the trigger is an icon-only button; `label` becomes its accessible name. */
  icon?: React.ReactNode;
  iconClassName?: string;
  /**
   * Smaller text and padding below sm, and the trigger shares the row width
   * (label truncates) so several triggers fit on one phone-width line.
   */
  compact?: boolean;
  /** Adds a round arrow at the panel's bottom-right that closes it. */
  closeArrow?: boolean;
  /** Shown as a filled dot next to the label when a non-default value is selected. */
  active?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const FALLBACK_PANEL_WIDTH = 240;
  const VIEWPORT_MARGIN = 12;

  function updateCoords() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Measured from the actual panel rather than a hardcoded constant: panel
    // content varies per caller (the filter dropdowns' checkbox lists vs. the
    // wider delivery-check form, 260px), and clamping with the wrong width
    // either over-shifts a narrow panel or, worse, under-corrects a wide one
    // and still lets it run off the right edge. panelRef is already mounted
    // by the time this runs (refs attach during commit, before effects), so
    // its rendered width is available on the very first call, not just
    // subsequent repositions. Falls back to the old constant only for that
    // unreachable-in-practice case where the ref somehow isn't there yet.
    const panelWidth = panelRef.current?.getBoundingClientRect().width ?? FALLBACK_PANEL_WIDTH;
    const maxLeft = window.innerWidth - panelWidth - VIEWPORT_MARGIN;
    setCoords({ top: rect.bottom + 8, left: Math.min(rect.left, Math.max(VIEWPORT_MARGIN, maxLeft)) });
  }

  useEffect(() => {
    if (!open) return;
    updateCoords();

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Keep the portaled panel anchored to the trigger through scrolling
    // (window or the filter bar's own horizontal scroll) and resizing.
    function onReposition() {
      updateCoords();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open]);

  return (
    <>
      {icon ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={label}
          title={label}
          aria-haspopup="true"
          aria-expanded={open}
          className={["p-2.5 transition-colors duration-200", iconClassName].join(" ")}
        >
          {icon}
        </button>
      ) : (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={[
          compact
            ? "flex min-w-0 flex-1 items-center justify-center gap-1 sm:flex-none sm:gap-2 sm:shrink-0 whitespace-nowrap font-sans font-normal text-[12px] leading-[18px] px-2 py-2 sm:text-[14px] sm:leading-[21px] sm:px-4 sm:py-2.5 rounded-full border transition-colors duration-200"
            : "flex items-center gap-2 shrink-0 whitespace-nowrap font-sans font-normal text-[14px] leading-[21px] px-4 py-2.5 rounded-full border transition-colors duration-200",
          open
            ? "border-black text-black"
            : "border-[#CFCFCF] text-[#3D3D3D] hover:border-black hover:text-black",
        ].join(" ")}
      >
        {active && <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" aria-hidden="true" />}
        <span className={compact ? "min-w-0 truncate" : undefined}>{label}</span>
        <ChevronDown
          size={compact ? 12 : 14}
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      )}

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className={`fixed z-30 min-w-[240px] bg-white border border-[#CFCFCF] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-5 ${closeArrow ? "pb-14" : ""}`}
            style={{ top: coords.top, left: coords.left }}
          >
            {children(() => setOpen(false))}
            {closeArrow && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute bottom-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#CFCFCF] text-black hover:border-black transition-colors duration-200"
              >
                <ArrowRight size={16} strokeWidth={1.75} />
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
