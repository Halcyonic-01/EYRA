"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BadgeCheck, ChevronLeft, ChevronRight, X } from "lucide-react";

import { Stars } from "@/components/reviews/Stars";
import { REVIEW_SORTS, type ProductReviewsPage, type PublicReview, type ReviewSort } from "@/lib/review-types";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

type Shown = { photos: { id: string; url: string }[]; index: number; name: string };

/**
 * The Reviews section of a product page: the average and how many of each
 * star, customer photos, and the reviews themselves. Every review shown was
 * approved, and came from a customer who bought and received the piece.
 */
export function ProductReviews({ handle, initial }: { handle: string; initial: ProductReviewsPage | null }) {
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [reviews, setReviews] = useState<PublicReview[]>(initial?.reviews ?? []);
  const [count, setCount] = useState(initial?.count ?? 0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  // Only the latest request may change the list: an older, slower answer (a sort the customer has already changed) is dropped.
  const latest = useRef(0);

  const summary = initial?.summary ?? { average: 0, count: 0, breakdown: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } };
  const total = summary.count;

  async function load(nextSort: ReviewSort, offset: number) {
    const request = ++latest.current;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/reviews/product?handle=${encodeURIComponent(handle)}&sort=${nextSort}&offset=${offset}`);
      if (!res.ok) throw new Error();
      const page = (await res.json()) as ProductReviewsPage;
      if (request !== latest.current) return;
      setReviews((now) => (offset === 0 ? page.reviews : [...now, ...page.reviews]));
      setCount(page.count);
    } catch {
      if (request === latest.current) setFailed(true);
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }

  function changeSort(next: ReviewSort) {
    setSort(next);
    void load(next, 0);
  }

  const gallery = reviews.flatMap((review) => review.photos.map((photo) => ({ ...photo, name: review.display_name, review })));

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="scroll-mt-28 border-t border-[#E4E4E4] bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10">
        <h2 id="reviews-heading" className="font-display text-[clamp(2rem,4vw,3rem)] font-light italic leading-[1.1] text-black">
          Customer reviews
        </h2>

        {total === 0 ? (
          <div className="mt-8 rounded-2xl bg-[#F9F9F9] px-6 py-10 text-center">
            <p className="font-sans text-[16px] text-black">No reviews yet</p>
            <p className="mx-auto mt-2 max-w-md font-sans text-[14px] leading-[22px] text-[#626262]">
              Reviews come only from customers who bought and received this piece. After delivery we ask every customer for theirs.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-14">
            {/* Summary */}
            <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
              <div className="flex items-end gap-3">
                <span className="font-display text-[56px] font-light leading-none text-black tabular-nums">{summary.average.toFixed(1)}</span>
                <div className="pb-1.5">
                  <Stars value={summary.average} size={18} />
                  <p className="mt-1 font-sans text-[13px] text-[#626262]">
                    Based on {total} {total === 1 ? "review" : "reviews"}
                  </p>
                </div>
              </div>
              <ul className="mt-6 flex flex-col gap-2" aria-label="How many reviews gave each rating">
                {(["5", "4", "3", "2", "1"] as const).map((stars) => {
                  const n = summary.breakdown[stars];
                  const pct = total ? Math.round((n / total) * 100) : 0;
                  return (
                    <li key={stars} className="grid grid-cols-[44px_1fr_36px] items-center gap-3 font-sans text-[13px] text-[#4D4D4D]">
                      <span>{stars} star</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-[#EBEBEB]" aria-hidden="true">
                        <span className="block h-full rounded-full bg-black" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="text-right tabular-nums" aria-label={`${n} reviews`}>
                        {n}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-6 flex items-start gap-2 font-sans text-[12px] leading-[18px] text-[#909090]">
                <BadgeCheck size={15} strokeWidth={1.5} className="mt-px flex-shrink-0 text-black" aria-hidden="true" />
                Every review is from a verified purchase and checked before it appears. Negative reviews are published too.
              </p>
            </div>

            {/* List. min-w-0 lets this column shrink to a phone's width instead of stretching to its photo strip. */}
            <div className="min-w-0">
              {gallery.length > 0 && (
                <div className="mb-8">
                  <h3 className="mb-3 font-sans text-[11px] font-medium uppercase tracking-[0.22em] text-[#909090]">Customer photos</h3>
                  <ul className="flex gap-2 overflow-x-auto pb-1">
                    {gallery.slice(0, 12).map((photo, index) => (
                      <li key={photo.id} className="flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setShown({ photos: gallery, index, name: photo.name })}
                          aria-label={`Photo from ${photo.name}`}
                          className="relative block h-20 w-20 overflow-hidden rounded-xl bg-[#F2F2F2] sm:h-24 sm:w-24"
                        >
                          <Image src={photo.url} alt="" fill sizes="96px" className="object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 border-b border-[#E4E4E4] pb-4">
                <p className="font-sans text-[14px] text-[#4D4D4D]">
                  {count} {count === 1 ? "review" : "reviews"}
                </p>
                <label className="flex items-center gap-2 font-sans text-[13px] text-[#626262]">
                  Sort by
                  <select
                    value={sort}
                    onChange={(e) => changeSort(e.target.value as ReviewSort)}
                    className="h-9 rounded-full border border-[#D6D6D6] bg-white px-3 font-sans text-[13px] text-black focus:border-black focus:outline-none"
                  >
                    {REVIEW_SORTS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ul aria-busy={loading} className={loading ? "opacity-60 transition-opacity" : ""}>
                {reviews.map((review) => (
                  <li key={review.id} className="border-b border-[#E4E4E4] py-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={review.rating} size={15} />
                      {review.title && <h3 className="font-sans text-[15px] font-medium text-black">{review.title}</h3>}
                    </div>
                    <p className="mt-2 whitespace-pre-line font-sans text-[14px] leading-[23px] text-[#3D3D3D]">{review.body}</p>
                    {review.photos.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {review.photos.map((photo, index) => (
                          <li key={photo.id}>
                            <button
                              type="button"
                              onClick={() => setShown({ photos: review.photos, index, name: review.display_name })}
                              aria-label={`Open photo ${index + 1} from ${review.display_name}`}
                              className="relative block h-[72px] w-[72px] overflow-hidden rounded-lg bg-[#F2F2F2]"
                            >
                              <Image src={photo.url} alt="" fill sizes="72px" className="object-cover" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[12px] text-[#909090]">
                      <span className="text-[#4D4D4D]">{review.display_name}</span>
                      {review.verified_purchase && (
                        <span className="inline-flex items-center gap-1 text-black">
                          <BadgeCheck size={13} strokeWidth={1.75} aria-hidden="true" />
                          Verified purchase
                        </span>
                      )}
                      {review.variant_title && <span>· {review.variant_title}</span>}
                      <span>· {day(review.submitted_at)}</span>
                      {review.edited && <span>· Edited</span>}
                    </p>
                  </li>
                ))}
              </ul>

              {failed && (
                <p role="alert" className="mt-4 font-sans text-[13px] text-[#B91C1C]">
                  Reviews could not be loaded. Please try again.
                </p>
              )}
              {reviews.length < count && (
                <button
                  type="button"
                  onClick={() => void load(sort, reviews.length)}
                  disabled={loading}
                  className="mt-6 h-11 rounded-full border border-[#D0D0D0] px-6 font-sans text-[14px] text-black transition-colors hover:border-black disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Show more reviews"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {shown && <PhotoViewer shown={shown} onClose={() => setShown(null)} />}
    </section>
  );
}

function PhotoViewer({ shown, onClose }: { shown: Shown; onClose: () => void }) {
  const [index, setIndex] = useState(shown.index);
  const photo = shown.photos[index];
  const many = shown.photos.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % shown.photos.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + shown.photos.length) % shown.photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, shown.photos.length]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Customer photo" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <button type="button" aria-label="Close photo" onClick={onClose} className="absolute inset-0 cursor-default" tabIndex={-1} />
      <div className="relative h-[min(80vh,720px)] w-full max-w-3xl">
        <Image src={photo.url} alt={`Photo from ${shown.name}`} fill sizes="(max-width: 768px) 100vw, 768px" className="object-contain" />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        autoFocus
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black"
      >
        <X size={18} />
      </button>
      {many && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => setIndex((i) => (i - 1 + shown.photos.length) % shown.photos.length)}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => setIndex((i) => (i + 1) % shown.photos.length)}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}
    </div>
  );
}
