import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ReturnRequestForm, { type RequestableItem } from "@/components/orders/ReturnRequestForm";
import { storeConfig } from "@/config/storeConfig";
import { fetchOrderForReturn, listReturnRequests } from "@/lib/medusa-returns";
import { eligibility } from "@/lib/return-requests";

export const metadata: Metadata = { title: "Return or exchange" };

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

const CLOSED_MESSAGES = {
  cancelled: "This order was cancelled, so there is nothing to return.",
  not_delivered: "You can ask for a return or exchange once your order has been delivered.",
  window_closed: "The return and exchange windows for this order have closed.",
} as const;

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const order = await fetchOrderForReturn(id);
  const customerId = user.publicMetadata?.medusaCustomerId as string | undefined;
  // The admin API returns any order, so check it is this customer's own.
  if (!order || !customerId || order.customerId !== customerId) notFound();

  const requests = (await listReturnRequests(customerId, id)) ?? [];
  const e = eligibility(order, storeConfig.policy);

  // Quantities already in a pending or approved request cannot be requested again.
  const taken = new Map<string, number>();
  for (const request of requests) {
    if (request.status === "rejected") continue;
    for (const item of request.items) taken.set(item.itemId, (taken.get(item.itemId) ?? 0) + item.quantity);
  }
  const items: RequestableItem[] = order.items.map((item) => ({
    id: item.id,
    title: item.title,
    unitPrice: item.unitPrice,
    available: Math.max(0, item.quantity - (taken.get(item.id) ?? 0)),
  }));
  const anyAvailable = items.some((item) => item.available > 0);

  const { returnDays, exchangeDays } = storeConfig.policy;
  const open = !e.closedReason;

  return (
    <div className="mx-auto max-w-screen-sm px-6 py-12 lg:px-10">
      <div className="mb-8 flex items-center gap-2 font-sans text-[13px]">
        <Link href="/orders" className="text-[#909090] transition-colors duration-200 hover:text-black">
          My Orders
        </Link>
        <span className="text-[#CFCFCF]">/</span>
        <Link href={`/orders/${order.id}`} className="text-[#909090] transition-colors duration-200 hover:text-black">
          #{order.displayId}
        </Link>
        <span className="text-[#CFCFCF]">/</span>
        <span className="font-medium text-black">Return or exchange</span>
      </div>

      <h1 className="mb-2 font-sans text-[24px] font-medium text-black">Return or exchange</h1>
      <p className="mb-8 font-sans text-[14px] text-[#626262]">
        Returns are accepted within {returnDays} days and exchanges within {exchangeDays} days of delivery.
        {e.returnUntil && open && (
          <>
            {" "}
            For this order, that is until {formatDay(e.canReturn ? e.returnUntil : (e.exchangeUntil ?? e.returnUntil))}.
          </>
        )}
      </p>

      {e.closedReason ? (
        <p className="rounded-2xl bg-[#F7F7F7] px-5 py-6 font-sans text-[14px] text-[#626262]">
          {CLOSED_MESSAGES[e.closedReason]}
        </p>
      ) : !anyAvailable ? (
        <p className="rounded-2xl bg-[#F7F7F7] px-5 py-6 font-sans text-[14px] text-[#626262]">
          Every item in this order is already part of a return or exchange request.
        </p>
      ) : (
        <ReturnRequestForm
          orderId={order.id}
          orderNumber={order.displayId}
          items={items}
          canReturn={e.canReturn}
          canExchange={e.canExchange}
        />
      )}
    </div>
  );
}
