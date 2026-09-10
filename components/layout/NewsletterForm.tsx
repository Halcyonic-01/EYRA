"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

interface NewsletterFormProps {
  variant?: "dark" | "light";
}

export function NewsletterForm({ variant = "dark" }: NewsletterFormProps) {
  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    if (!email.trim()) return;

    setStatus("loading");

    // Without this catch a dropped connection rejects the fetch, the handler
    // exits on an unhandled rejection, and status is left on "loading"
    // forever, which disables both the input and the submit button. The
    // subscriber is then stuck looking at a dead form until a full reload.
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch (err) {
      console.error("[newsletter] subscribe request failed:", err);
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <p className="text-[0.78rem] font-light tracking-[0.1em] text-stone py-3">
        You&apos;re on the list. Welcome to EYRA.
      </p>
    );
  }

  const isDark = variant === "dark";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex items-stretch w-full">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          name="email"
          placeholder="Your email address"
          required
          disabled={status === "loading"}
          className={[
            "flex-1 bg-transparent text-[0.8rem] font-light tracking-[0.04em] px-4 py-3 focus:outline-none transition-colors duration-200 disabled:opacity-50",
            isDark
              ? "border border-stone text-white placeholder:text-stone focus:border-silver"
              : "border border-carbon text-jet placeholder:text-ash focus:border-jet",
          ].join(" ")}
        />
        <button
          type="submit"
          aria-label="Subscribe to newsletter"
          disabled={status === "loading"}
          className={[
            "border border-l-0 px-3.5 transition-colors duration-200 disabled:opacity-50",
            isDark
              ? "border-stone text-smoke hover:text-white hover:border-silver"
              : "border-carbon text-carbon hover:text-jet hover:border-jet",
          ].join(" ")}
        >
          <ArrowRight size={15} strokeWidth={1.5} />
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-[0.72rem] tracking-[0.05em] text-red-400">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
