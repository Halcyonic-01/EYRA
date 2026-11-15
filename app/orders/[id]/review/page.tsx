import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ReviewForm } from "@/components/reviews/ReviewForm";
import { getCurrentUser } from "@/lib/current-user";
import { getAccountReviewSession } from "@/lib/reviews";

export const metadata: Metadata = { title: "Review your order", robots: { index: false, follow: false } };

/** A signed-in customer reviews, or edits their reviews of, one of their own delivered orders. */
export default async function OrderReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const customerId = user.publicMetadata?.medusaCustomerId;
  if (typeof customerId !== "string") notFound();

  const reply = await getAccountReviewSession(customerId, id);
  if (!reply.ok && reply.status === 404) notFound();
  const session = reply.ok ? reply.data.session : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-6 flex items-center gap-2 font-sans text-[13px]">
        <Link href="/orders" className="text-[#909090] transition-colors hover:text-black">
          My Orders
        </Link>
        <span className="text-[#CFCFCF]">/</span>
        <Link href={`/orders/${id}`} className="text-[#909090] transition-colors hover:text-black">
          Order {session ? `#${session.order_number}` : ""}
        </Link>
        <span className="text-[#CFCFCF]">/</span>
        <span className="text-black">Review</span>
      </div>
      {!session ? (
        <p className="rounded-xl bg-[#F9F9F9] px-5 py-6 font-sans text-[15px] text-[#4D4D4D]">Reviews are not available right now. Please try again shortly.</p>
      ) : session.state === "not_reviewable" ? (
        <p className="rounded-xl bg-[#F9F9F9] px-5 py-6 font-sans text-[15px] text-[#4D4D4D]">
          You can review this order once it has been delivered.
        </p>
      ) : (
        <>
          <h1 className="mb-6 font-display text-[clamp(2rem,5vw,2.75rem)] font-light leading-[1.05] text-black">Review your order</h1>
          <ReviewForm session={session} mode="account" />
        </>
      )}
    </div>
  );
}
