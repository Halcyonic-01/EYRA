"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, Check, Loader2, X } from "lucide-react";

import { StarPicker } from "@/components/reviews/StarPicker";
import { REVIEW_LIMITS, type ReviewSession, type SessionItem } from "@/lib/review-types";

type Photo = { key: string; id: string | null; url: string; uploading: boolean; error?: string };

type Draft = { rating: number; title: string; body: string; photos: Photo[] };

const draftFor = (item: SessionItem, initialRating: number): Draft => ({
  rating: item.review?.rating ?? initialRating,
  title: item.review?.title ?? "",
  body: item.review?.body ?? "",
  photos: (item.review?.photos ?? []).map((p) => ({ key: p.id, id: p.id, url: p.url, uploading: false })),
});

/**
 * The review form: every product on the order, each with stars, a title,
 * the review and up to four photos. Used by the review link page (no sign-in)
 * and the signed-in order page, where an earlier review can be edited.
 */
export function ReviewForm({
  session,
  mode,
  token,
  initialRating = 0,
}: {
  session: ReviewSession;
  mode: "link" | "account";
  token?: string;
  initialRating?: number;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(session.items.map((item) => [item.line_item_id, draftFor(item, initialRating)]))
  );
  const [name, setName] = useState(session.items.find((i) => i.review)?.review?.display_name ?? session.suggested_name);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const update = (lineId: string, change: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setDrafts((all) => {
      const current = all[lineId];
      const next = typeof change === "function" ? change(current) : change;
      return { ...all, [lineId]: { ...current, ...next } };
    });

  async function addPhotos(lineId: string, files: FileList | null) {
    if (!files?.length) return;
    const room = REVIEW_LIMITS.photosPerReview - drafts[lineId].photos.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    for (const file of chosen) {
      const key = `${Date.now()}-${Math.random()}`;
      if (file.size > REVIEW_LIMITS.photoInputBytes) {
        setError("Please choose photos under 10 MB.");
        continue;
      }
      const preview = URL.createObjectURL(file);
      update(lineId, (d) => ({ photos: [...d.photos, { key, id: null, url: preview, uploading: true }] }));
      const form = new FormData();
      form.append("file", file);
      if (mode === "link" && token) form.append("token", token);
      else form.append("orderId", session.order_id);
      try {
        const res = await fetch("/api/reviews/photo", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { photo?: { id: string; url: string }; error?: string };
        if (!res.ok || !data.photo) throw new Error(data.error ?? "That photo could not be added.");
        const uploaded = data.photo;
        update(lineId, (d) => ({ photos: d.photos.map((p) => (p.key === key ? { ...p, id: uploaded.id, url: uploaded.url, uploading: false } : p)) }));
        URL.revokeObjectURL(preview);
      } catch (err) {
        update(lineId, (d) => ({ photos: d.photos.filter((p) => p.key !== key) }));
        URL.revokeObjectURL(preview);
        setError(err instanceof Error ? err.message : "That photo could not be added.");
      }
    }
  }

  const rated = session.items.filter((item) => drafts[item.line_item_id].rating > 0);
  const uploading = Object.values(drafts).some((d) => d.photos.some((p) => p.uploading));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (rated.length === 0) return setError("Choose a star rating for at least one product.");
    for (const item of rated) {
      const body = drafts[item.line_item_id].body.trim();
      if (body.length < REVIEW_LIMITS.bodyMin) {
        return setError(`Tell us a little more about ${item.title} (at least ${REVIEW_LIMITS.bodyMin} characters).`);
      }
    }
    setSending(true);
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "link" ? { token } : { orderId: session.order_id }),
          website,
          reviews: rated.map((item) => {
            const d = drafts[item.line_item_id];
            return {
              line_item_id: item.line_item_id,
              rating: d.rating,
              title: d.title.trim() || null,
              body: d.body.trim(),
              display_name: name.trim() || null,
              photo_ids: d.photos.filter((p) => p.id).map((p) => p.id as string),
            };
          }),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Your review could not be sent. Please try again.");
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your review could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="mx-auto flex max-w-md flex-col items-center gap-5 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white">
          <Check size={26} strokeWidth={2} aria-hidden="true" />
        </span>
        <h2 className="font-display text-[34px] font-light leading-tight text-black">Thank you</h2>
        <p className="font-sans text-[15px] leading-[24px] text-[#4D4D4D]">
          {rated.length === 1 ? "Your review has" : "Your reviews have"} been sent. We check every review before it appears on the product
          page, usually within a day, with a Verified purchase badge.
        </p>
        <p className="font-sans text-[13px] leading-[20px] text-[#909090]">
          {mode === "link"
            ? "To change a review later, sign in and open this order under My orders."
            : "You can come back to this order to change your review at any time."}
        </p>
        <Link href="/products" className="rounded-full bg-black px-7 py-3 font-sans text-[14px] font-medium text-white hover:bg-[#1A1A1A]">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {session.items.map((item) => {
        const d = drafts[item.line_item_id];
        const label = `Your rating for ${item.title}`;
        return (
          <section key={item.line_item_id} aria-label={item.title} className="rounded-2xl border border-[#E4E4E4] bg-white p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-xl bg-[#F9F9F9] sm:h-20 sm:w-20">
                {item.thumbnail && <Image src={item.thumbnail} alt="" fill sizes="80px" className="object-contain p-1.5 mix-blend-multiply" />}
              </div>
              <div className="min-w-0">
                <h2 className="font-sans text-[16px] font-medium leading-[22px] text-black">{item.title}</h2>
                {item.variant && <p className="font-sans text-[13px] text-[#909090]">{item.variant}</p>}
                {item.review && (
                  <p className="mt-1 font-sans text-[12px] text-[#626262]">
                    {item.review.status === "approved"
                      ? "Published. Changing it sends it to be checked again."
                      : item.review.status === "rejected"
                        ? "Not published. You can edit and send it again."
                        : "Waiting to be checked."}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <StarPicker value={d.rating} onChange={(rating) => update(item.line_item_id, { rating })} label={label} />
            </div>

            {d.rating > 0 && (
              <div className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="font-sans text-[13px] font-medium text-black">
                    Title <span className="font-normal text-[#909090]">(optional)</span>
                  </span>
                  <input
                    value={d.title}
                    maxLength={REVIEW_LIMITS.titleMax}
                    onChange={(e) => update(item.line_item_id, { title: e.target.value })}
                    placeholder="Sum it up in a few words"
                    className="h-11 rounded-xl border border-[#D6D6D6] px-3.5 font-sans text-[15px] text-black placeholder:text-[#A2A2A2] focus:border-black focus:outline-none"
                  />
                </label>
                <div className="flex flex-col gap-1.5">
                <label className="flex flex-col gap-1.5">
                  <span className="font-sans text-[13px] font-medium text-black">Your review</span>
                  <textarea
                    value={d.body}
                    maxLength={REVIEW_LIMITS.bodyMax}
                    rows={4}
                    onChange={(e) => update(item.line_item_id, { body: e.target.value })}
                    placeholder="How does it look and feel? How is the size, the finish, the packaging?"
                    className="resize-y rounded-xl border border-[#D6D6D6] px-3.5 py-3 font-sans text-[15px] leading-[22px] text-black placeholder:text-[#A2A2A2] focus:border-black focus:outline-none"
                  />
                </label>
                  <span className="self-end font-sans text-[11px] text-[#909090] tabular-nums" aria-live="polite">
                    {d.body.trim().length}/{REVIEW_LIMITS.bodyMax}
                  </span>
                </div>

                <div>
                  <span className="font-sans text-[13px] font-medium text-black">
                    Photos <span className="font-normal text-[#909090]">(optional, up to {REVIEW_LIMITS.photosPerReview})</span>
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.photos.map((photo) => (
                      <div key={photo.key} className="relative h-20 w-20 overflow-hidden rounded-xl bg-[#F2F2F2]">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a local preview while it uploads */}
                        <img src={photo.url} alt="Your photo" className={`h-full w-full object-cover ${photo.uploading ? "opacity-50" : ""}`} />
                        {photo.uploading ? (
                          <Loader2 size={20} className="absolute inset-0 m-auto animate-spin text-black" aria-label="Uploading" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => update(item.line_item_id, (dd) => ({ photos: dd.photos.filter((p) => p.key !== photo.key) }))}
                            aria-label="Remove photo"
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-black shadow"
                          >
                            <X size={13} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    ))}
                    {d.photos.length < REVIEW_LIMITS.photosPerReview && (
                      <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#BCBCBC] font-sans text-[11px] text-[#626262] hover:border-black hover:text-black focus-within:border-black">
                        <Camera size={20} strokeWidth={1.5} aria-hidden="true" />
                        Add photo
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                          multiple
                          className="sr-only"
                          aria-label={`Add photos of ${item.title}`}
                          onChange={(e) => {
                            void addPhotos(item.line_item_id, e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })}

      <section className="rounded-2xl border border-[#E4E4E4] bg-white p-4 sm:p-6">
        <label className="flex flex-col gap-1.5">
          <span className="font-sans text-[13px] font-medium text-black">Name shown with your review</span>
          <input
            value={name}
            maxLength={REVIEW_LIMITS.nameMax}
            onChange={(e) => setName(e.target.value)}
            className="h-11 rounded-xl border border-[#D6D6D6] px-3.5 font-sans text-[15px] text-black focus:border-black focus:outline-none"
          />
        </label>
        {/* Hidden from people; a bot that fills it in is ignored. */}
        <label className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <p className="mt-3 font-sans text-[12px] leading-[18px] text-[#909090]">
          Reviews are checked before they appear and shown with a Verified purchase badge. We publish honest reviews, good or bad, and never
          remove one for being negative. See our{" "}
          <Link href="/review-policy" className="underline underline-offset-2 hover:text-black">
            review policy
          </Link>
          .
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FFF1F1] px-4 py-3 font-sans text-[14px] text-[#B91C1C]">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 border-t border-[#E4E4E4] bg-white/95 px-4 pb-5 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="submit"
          disabled={sending || uploading}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-black font-sans text-[15px] font-medium text-white transition-colors hover:bg-[#1A1A1A] disabled:opacity-50"
        >
          {sending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {uploading ? "Adding photos…" : rated.length > 1 ? `Send ${rated.length} reviews` : "Send review"}
        </button>
      </div>
    </form>
  );
}
