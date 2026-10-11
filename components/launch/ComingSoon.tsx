import Image from "next/image";
import { Countdown } from "./Countdown";
import { LAUNCH_DATE_ISO } from "@/lib/launch-mode";

const INSTAGRAM_URL =
  "https://www.instagram.com/eyra.org.in?cplk=MXhteDI2YmRpcG1jaQ==";

export function ComingSoon() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-jet text-ivory px-6 py-12 sm:py-16 text-center">
      <header className="flex flex-col items-center">
        {/* Original EYRA wordmark, same artwork as the site logo */}
        <Image
          src="/images/logo-mark-white.png"
          alt="EYRA"
          width={254}
          height={148}
          priority
          className="h-auto w-44 sm:w-60"
        />
        <p className="mt-6 text-sm sm:text-base font-medium uppercase tracking-[0.3em] sm:tracking-[0.4em] text-mist">
          Fine 925 Sterling Silver
        </p>
        <p className="mt-3 font-display italic text-xl sm:text-2xl text-pearl">
          Reflecting Your Essence.
        </p>
      </header>

      <div className="my-10 sm:my-14 h-px w-20 bg-pewter/60" aria-hidden />

      <section className="flex flex-col items-center gap-8 sm:gap-10">
        <h2 className="font-display text-3xl sm:text-5xl font-medium uppercase tracking-[0.25em] sm:tracking-[0.3em] pl-[0.25em] text-white">
          Launching Soon
        </h2>
        <Countdown target={LAUNCH_DATE_ISO} />
        <p className="text-base sm:text-lg font-medium tracking-[0.25em] text-mist">
          08 / 11 / 2026
        </p>
      </section>

      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-10 sm:mt-14 inline-block rounded-full bg-ivory px-8 sm:px-10 py-4 text-sm sm:text-base font-medium tracking-wide text-jet transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory"
      >
        Follow Our Journey on Instagram
      </a>
    </main>
  );
}
