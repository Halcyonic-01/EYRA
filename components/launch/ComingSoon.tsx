import { Countdown } from "./Countdown";
import { LAUNCH_DATE_ISO } from "@/lib/launch-mode";

const INSTAGRAM_URL = "https://www.instagram.com/eyra.org.in/";

export function ComingSoon() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-jet text-ivory px-6 py-16 text-center">
      <header>
        <h1 className="font-display text-6xl sm:text-8xl font-light tracking-[0.35em] pl-[0.35em]">
          EYRA
        </h1>
        <p className="mt-4 text-[11px] sm:text-xs uppercase tracking-[0.4em] text-pearl">
          Fine 925 Sterling Silver
        </p>
        <p className="mt-2 font-display italic text-lg sm:text-xl text-stone">
          Reflecting Your Essence.
        </p>
      </header>

      <div className="my-14 h-px w-16 bg-stone/50" aria-hidden />

      <section className="flex flex-col items-center gap-10">
        <h2 className="text-sm sm:text-base font-light uppercase tracking-[0.5em] pl-[0.5em] text-mist">
          Launching Soon
        </h2>
        <Countdown target={LAUNCH_DATE_ISO} />
        <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-stone">
          08 / 11 / 2026
        </p>
      </section>

      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-14 inline-block rounded-full border border-pearl px-8 py-3.5 text-sm font-light tracking-wide text-ivory transition-colors hover:bg-ivory hover:text-jet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory"
      >
        Follow Our Journey on Instagram
      </a>
    </main>
  );
}
