"use client";

import { DeliveryCheckWidget } from "./DeliveryCheckWidget";

export function HeroSection() {
  return (
    <section className="bg-white">
      {/* ── Announcement strip ───────────────────────── */}
      <div className="border-b border-cloud">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-16 py-2.5 flex items-center justify-center gap-3 flex-wrap">
          <p className="text-center text-[0.7rem] sm:text-[0.72rem] font-sans font-normal tracking-[0.16em] sm:tracking-[0.22em] uppercase text-carbon">
            Made to order&nbsp;&nbsp;|&nbsp;&nbsp;Crafted within 7–10 days
          </p>
          <DeliveryCheckWidget />
        </div>
      </div>

      {/* ── Display heading ──────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-6 lg:px-16 pt-14 pb-4 text-center">
        <h1 className="font-display font-light leading-[1.05] tracking-[-0.01em] text-[clamp(3.2rem,8.5vw,8rem)] text-jet">
          Timeless{" "}
          <span className="italic text-pearl">Silver.</span>
          <br />
          Modern Expression.
        </h1>
      </div>

      {/* ── Hero image / video container ─────────────── */}
      <div className="max-w-screen-xl mx-auto px-6 lg:px-16 pb-0">
        <div className="relative overflow-hidden bg-pewter" style={{ height: "clamp(340px, 55vw, 700px)" }}>
          {/* Video element, swap src for a real .mp4 when available */}
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/images/Hero-bg.png"
            className="absolute inset-0 w-full h-full object-cover object-top"
          >
            {/* <source src="/videos/hero.mp4" type="video/mp4" /> */}
          </video>

          {/* Dark gradient overlay, bottom only, preserves image */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

          {/*
            No live caption overlay here on purpose: /images/Hero-bg.png
            already has both captions (plus their connector-line/dot
            treatment) composited into the image itself. This component used
            to ALSO render its own live DOM captions in roughly the same
            spots, which duplicated the image's baked-in text. On desktop the
            two happened to nearly coincide, so it read as a slightly bold
            single caption and went unnoticed; on mobile object-cover crops
            the same 2472x1366 source to a much narrower window, and the
            live captions' relative positions no longer lined up with where
            the baked-in ones actually landed, so mobile showed two
            different, overlapping texts. Removing the live duplicate is the
            fix, not repositioning it, since the image's own text is the
            "real" caption. If this poster is ever swapped for a real video
            with no baked-in text, captions will need to be reintroduced as
            live DOM elements again at that point.
          */}
        </div>
      </div>
    </section>
  );
}
