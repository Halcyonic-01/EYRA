"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function remaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export function Countdown({ target }: { target: string }) {
  // null until mounted, so server and first client render match.
  const [t, setT] = useState<ReturnType<typeof remaining> | null>(null);

  useEffect(() => {
    const ts = new Date(target).getTime();
    const tick = () => setT(remaining(ts));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  const units = [
    ["Days", t?.days],
    ["Hours", t?.hours],
    ["Minutes", t?.minutes],
    ["Seconds", t?.seconds],
  ] as const;

  return (
    <div
      role="timer"
      aria-label="Time remaining until launch"
      className="flex items-start justify-center gap-3 sm:gap-6"
    >
      {units.map(([label, value], i) => (
        <div key={label} className="flex items-start gap-2 sm:gap-6">
          <div className="flex flex-col items-center min-w-[3.75rem] sm:min-w-[6rem]">
            <span className="font-display text-5xl sm:text-7xl font-medium lining-nums tabular-nums leading-none text-white">
              {value === undefined ? "--" : pad(value)}
            </span>
            <span className="mt-3 text-[11px] sm:text-sm font-medium uppercase tracking-[0.15em] sm:tracking-[0.2em] text-pearl">
              {label}
            </span>
          </div>
          {i < units.length - 1 && (
            <span className="font-display text-4xl sm:text-6xl leading-none font-medium text-pewter">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
