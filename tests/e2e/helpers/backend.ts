import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

import type { PayuCheckoutForm } from "../../../lib/payu";
import { FAKE_PAYU_PORT } from "./fake-payu";

/**
 * The local backend, driven the way the storefront's server routes drive it,
 * for browser tests that cannot sign in (the shared Clerk instance).
 */

export function localEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const file = fs.readFileSync(path.join(__dirname, "../../../.env.local"), "utf8");
    return file.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

export const BACKEND = (localEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL") ?? "http://localhost:9000").replace(/\/$/, "");
export const PUB_KEY = localEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY") ?? "";

export async function store<T>(route: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BACKEND}${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "x-publishable-api-key": PUB_KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T };
}

type Variant = { id: string; inventory_quantity?: number | null; manage_inventory?: boolean };
type Product = { handle: string; variants?: Variant[] };

/** A prepaid cart with one item, an email and an address, as /api/payu/create-session leaves it, and its PayU form. */
export async function payuCart(): Promise<{ cartId: string; form: PayuCheckoutForm } | { skip: string }> {
  let regions;
  try {
    regions = await store<{ regions: { id: string; currency_code: string }[] }>("/store/regions");
  } catch {
    return { skip: `backend not reachable at ${BACKEND}` };
  }
  const region = regions.data.regions?.find((r) => r.currency_code === "inr");
  if (!region) return { skip: "no INR region" };

  const products = await store<{ products: Product[] }>(
    `/store/products?region_id=${region.id}&limit=50&fields=handle,*variants,+variants.inventory_quantity`
  );
  const variant = products.data.products
    ?.filter((p) => p.handle !== "eyra-complimentary-tote")
    .flatMap((p) => p.variants ?? [])
    .find((v) => v.manage_inventory === false || (v.inventory_quantity ?? 0) > 2);
  if (!variant) return { skip: "no product in stock" };

  const cart = await store<{ cart: { id: string } }>("/store/carts", { region_id: region.id });
  const cartId = cart.data.cart.id;
  await store(`/store/carts/${cartId}/line-items`, { variant_id: variant.id, quantity: 1 });
  await store(`/store/carts/${cartId}`, {
    email: "payu-e2e@example.com",
    shipping_address: {
      first_name: "Asha", last_name: "Test", phone: "9999999999", address_1: "1 Test Street",
      city: "Bengaluru", province: "Karnataka", postal_code: "560001", country_code: "in",
    },
  });
  const mode = await store(`/store/carts/${cartId}/payment-mode`, { mode: "prepaid" });
  if (mode.status !== 200) return { skip: `payment mode refused (${mode.status})` };

  const session = await store<{ form?: PayuCheckoutForm; message?: string }>(`/store/carts/${cartId}/payu-session`, {});
  if (session.status !== 200 || !session.data.form) return { skip: `PayU not set up on the backend: ${session.data.message ?? session.status}` };
  if (!session.data.form.action.startsWith(`http://127.0.0.1:${FAKE_PAYU_PORT}/`)) {
    return { skip: "backend PAYU_CHECKOUT_URL does not point at the fake" };
  }
  return { cartId, form: session.data.form };
}

export async function cartCompleted(cartId: string): Promise<boolean> {
  const res = await store<{ cart?: { completed_at?: string | null } }>(`/store/carts/${cartId}?fields=id,completed_at`);
  return !!res.data.cart?.completed_at;
}

/** Put the cart in this browser's saved cart, the way adding to bag would. */
export async function rememberCart(page: Page, cartId: string) {
  await page.evaluate((id) => {
    localStorage.setItem("eyra-cart-storage", JSON.stringify({ state: { items: [], cartId: id }, version: 3 }));
  }, cartId);
}

export const storedCartId = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("eyra-cart-storage") ?? "{}")?.state?.cartId ?? null);
