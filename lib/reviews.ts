/**
 * Server-only: product reviews, as the Medusa backend keeps them.
 *
 * Reading a product's reviews and using a review link go through the Store API
 * (publishable key). A signed-in customer's own reviews go through the admin
 * API with the server key, after the caller has checked who the customer is
 * with Clerk, the same way return requests do.
 */
import "server-only";

import type { ReviewSession, ReviewSort, ProductReviewsPage, ReviewSubmission, UploadedPhoto } from "@/lib/review-types";

const BASE_URL = (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000").replace(/\/$/, "");
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";
const ADMIN_KEY = () => process.env.MEDUSA_ADMIN_API_KEY ?? "";
const TIMEOUT_MS = 20000;

export type BackendReply<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function call<T>(path: string, init: RequestInit & { admin?: boolean; next?: { revalidate?: number; tags?: string[] } } = {}): Promise<BackendReply<T>> {
  const { admin, ...rest } = init;
  if (admin && !ADMIN_KEY()) return { ok: false, status: 503, message: "Reviews are not available right now." };
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(admin ? { Authorization: `Basic ${ADMIN_KEY()}` } : PUB_KEY ? { "x-publishable-api-key": PUB_KEY } : {}),
        ...(rest.headers ?? {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(rest.next ? {} : { cache: "no-store" as const }),
    });
    const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
    if (res.ok && body) return { ok: true, data: body };
    return { ok: false, status: res.status, message: body?.message ?? "Something went wrong. Please try again." };
  } catch (error) {
    console.error("[reviews] backend request failed for", path.split("?")[0], ":", error);
    return { ok: false, status: 0, message: "Reviews are not available right now. Please try again." };
  }
}

/** A product's approved reviews and its rating summary. Cached briefly; refreshed when a review is moderated. */
export async function getProductReviews(handle: string, sort: ReviewSort = "newest", offset = 0, limit = 6): Promise<ProductReviewsPage | null> {
  const query = new URLSearchParams({ handle, sort, offset: String(offset), limit: String(limit) });
  const reply = await call<ProductReviewsPage>(`/store/product-reviews?${query}`, { next: { revalidate: 60, tags: ["products"] } });
  return reply.ok ? reply.data : null;
}

/** What the review page shows for a link. Null when the link is not one we know. */
export async function openReviewLink(token: string): Promise<ReviewSession | null> {
  const reply = await call<{ session: ReviewSession }>("/store/review-links/session", { method: "POST", body: JSON.stringify({ token }) });
  if (!reply.ok) return null;
  return reply.data.session.state === "invalid" ? null : reply.data.session;
}

export function submitLinkReviews(token: string, reviews: ReviewSubmission[]): Promise<BackendReply<{ reviews: { id: string }[] }>> {
  return call("/store/review-links/reviews", { method: "POST", body: JSON.stringify({ token, reviews }) });
}

export function uploadLinkPhoto(token: string, contentBase64: string): Promise<BackendReply<{ photo: UploadedPhoto }>> {
  return call("/store/review-links/photos", { method: "POST", body: JSON.stringify({ token, content_base64: contentBase64 }) });
}

/** A signed-in customer's order, with their reviews of it. */
export async function getAccountReviewSession(customerId: string, orderId: string): Promise<BackendReply<{ session: ReviewSession }>> {
  const query = new URLSearchParams({ customer_id: customerId, order_id: orderId });
  return call(`/admin/product-reviews/customer?${query}`, { admin: true });
}

export function submitAccountReviews(customerId: string, orderId: string, reviews: ReviewSubmission[]): Promise<BackendReply<{ reviews: { id: string }[] }>> {
  return call("/admin/product-reviews/customer", {
    method: "POST",
    admin: true,
    body: JSON.stringify({ customer_id: customerId, order_id: orderId, reviews }),
  });
}

export function uploadAccountPhoto(customerId: string, orderId: string, contentBase64: string): Promise<BackendReply<{ photo: UploadedPhoto }>> {
  return call("/admin/product-reviews/customer/photos", {
    method: "POST",
    admin: true,
    body: JSON.stringify({ customer_id: customerId, order_id: orderId, content_base64: contentBase64 }),
  });
}

/** Records the checkout's WhatsApp checkbox on the cart. False when it could not be saved. */
export async function setWhatsappConsent(cartId: string, optIn: boolean): Promise<boolean> {
  const reply = await call(`/store/carts/${encodeURIComponent(cartId)}/whatsapp-consent`, {
    method: "POST",
    body: JSON.stringify({ opt_in: optIn }),
  });
  return reply.ok;
}
