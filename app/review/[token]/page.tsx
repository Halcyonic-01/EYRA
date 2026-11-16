import type { Metadata } from "next";
import Link from "next/link";

import { ReviewForm } from "@/components/reviews/ReviewForm";
import { wellFormedReviewToken } from "@/lib/review-links";
import { openReviewLink } from "@/lib/reviews";

export const dynamic = "force-dynamic";

// A private page: never indexed, and the link is not sent on to other sites.
export const metadata: Metadata = {
  title: "Review your order",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="font-display text-[36px] font-light leading-tight text-black">{title}</h1>
      <p className="font-sans text-[15px] leading-[24px] text-[#4D4D4D]">{body}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href="/orders" className="rounded-full bg-black px-6 py-3 font-sans text-[14px] font-medium text-white hover:bg-[#1A1A1A]">
          My orders
        </Link>
        <Link href="/products" className="rounded-full border border-[#D0D0D0] px-6 py-3 font-sans text-[14px] text-black hover:border-black">
          Browse jewellery
        </Link>
      </div>
    </div>
  );
}

/** The page a review request links to: no sign-in needed, the link itself proves the purchase. */
export default async function ReviewLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { token } = await params;
  const { r } = await searchParams;
  const session = wellFormedReviewToken(token) ? await openReviewLink(token) : null;
  const rating = Number.parseInt(r ?? "", 10);
  const initialRating = rating >= 1 && rating <= 5 ? rating : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      {!session ? (
        <Closed title="This link is not valid" body="It may have been copied incorrectly, or replaced by a newer link. Sign in to review from your orders." />
      ) : session.state === "used" ? (
        <Closed
          title="Thanks, we have your review"
          body="This link has already been used. To change a review, sign in and open this order under My orders."
        />
      ) : session.state === "expired" ? (
        <Closed title="This link has expired" body="Review links work for 30 days. You can still review this order: sign in and open it under My orders." />
      ) : session.state === "not_reviewable" ? (
        <Closed title="This order cannot be reviewed" body="Reviews are for orders that were delivered to you." />
      ) : (
        <>
          <div className="mb-8">
            <p className="font-sans text-[11px] uppercase tracking-[0.24em] text-[#909090]">Order #{session.order_number}</p>
            <h1 className="mt-2 font-display text-[clamp(2.2rem,6vw,3rem)] font-light leading-[1.05] text-black">
              {session.first_name ? `How is it, ${session.first_name}?` : "How are you finding it?"}
            </h1>
            <p className="mt-3 font-sans text-[15px] leading-[24px] text-[#4D4D4D]">
              Rate the pieces you received and tell other shoppers what you think. It takes a minute, and you can add photos.
            </p>
          </div>
          <ReviewForm session={session} mode="link" token={token} initialRating={initialRating} />
        </>
      )}
    </div>
  );
}
