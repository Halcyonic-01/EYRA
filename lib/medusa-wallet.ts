/**
 * Server-only: the customer wallet (store credit for returns and exchanges).
 *
 * The wallet lives in Medusa. Customers sign in with Clerk, not Medusa, so the
 * browser never talks to the wallet directly: our routes work out who the
 * signed-in customer is and call Medusa's admin API with the server key, the
 * same way the wishlist does.
 *
 * Amounts are rupees (Medusa major units), like everything else in the store.
 */
import "server-only";

import { getWalletCustomer } from "@/lib/wallet-customer";

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

const ADMIN_KEY = process.env.MEDUSA_ADMIN_API_KEY ?? "";

/* ── Types ────────────────────────────────────────────────── */

export interface WalletTransaction {
  id: string;
  /**
   * "issued" and "refunded" add credit, "redeemed" spends it on an order,
   * "expired" is credit that lapsed unspent.
   */
  type: "issued" | "redeemed" | "refunded" | "expired";
  reason: "return" | "exchange" | "cancellation" | null;
  amount: number;
  balanceAfter: number;
  /** Credit rows: the part not spent yet. */
  remaining: number;
  /** Credit rows: when the credit stops being usable. Null means never. */
  expiresAt: string | null;
  orderId: string | null;
  note: string | null;
  createdAt: string;
}

export interface Wallet {
  /** Credit that can be spent right now. */
  balance: number;
  /** The credit that lapses first, so a customer is never surprised. */
  nextExpiry: { amount: number; expiresAt: string } | null;
  transactions: WalletTransaction[];
}

/** Cart totals after wallet credit, in rupees. `total` is what is left to pay. */
export interface WalletCartTotals {
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  walletCredit: number;
  total: number;
}

export type WalletCartResult =
  | { ok: true; appliedAmount: number; walletBalance: number; totals: WalletCartTotals }
  | { ok: false; reason: "no_credit" | "not_allowed" | "failed"; message: string };

/* ── Raw API shapes ───────────────────────────────────────── */

interface RawTransaction {
  id: string;
  type: "issued" | "redeemed" | "refunded" | "expired";
  reason: "return" | "exchange" | "cancellation" | null;
  amount: number;
  balance_after: number;
  remaining: number;
  expires_at: string | null;
  order_id: string | null;
  note: string | null;
  created_at: string;
}

interface RawCartTotals {
  subtotal?: number;
  tax_total?: number;
  shipping_total?: number;
  discount_total?: number;
  credit_line_total?: number;
  total?: number;
}

/* ── Fetch ────────────────────────────────────────────────── */

async function adminFetch(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: Record<string, unknown> | null } | null> {
  if (!ADMIN_KEY) {
    console.warn("[medusa-wallet] MEDUSA_ADMIN_API_KEY is not set, wallet is unavailable");
    return null;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ADMIN_KEY}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    let body: Record<string, unknown> | null = null;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch (err) {
    console.error("[medusa-wallet] fetch error for", path, ":", err);
    return null;
  }
}

function normalizeCartTotals(cart: RawCartTotals | undefined): WalletCartTotals {
  return {
    subtotal: Math.round(cart?.subtotal ?? 0),
    taxTotal: Math.round(cart?.tax_total ?? 0),
    shippingTotal: Math.round(cart?.shipping_total ?? 0),
    discountTotal: Math.round(cart?.discount_total ?? 0),
    walletCredit: Math.round(cart?.credit_line_total ?? 0),
    total: Math.round(cart?.total ?? 0),
  };
}

/* ── Reads ────────────────────────────────────────────────── */

/**
 * The customer's wallet and recent history. A customer who has never had
 * credit gets an empty wallet. Null means the wallet could not be read.
 */
export async function getWallet(customerId: string, limit = 50): Promise<Wallet | null> {
  const res = await adminFetch(
    `/admin/wallets?customer_id=${encodeURIComponent(customerId)}&limit=${limit}`
  );
  if (!res || res.status !== 200 || !res.body) return null;

  const wallet = res.body.wallet as
    | {
        balance: number;
        next_expiry: { amount: number; expires_at: string | null } | null;
        transactions: RawTransaction[];
      }
    | undefined;
  if (!wallet) return null;

  return {
    balance: wallet.balance,
    nextExpiry:
      wallet.next_expiry?.expires_at
        ? { amount: wallet.next_expiry.amount, expiresAt: wallet.next_expiry.expires_at }
        : null,
    transactions: wallet.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      reason: t.reason,
      amount: t.amount,
      balanceAfter: t.balance_after,
      remaining: t.remaining,
      expiresAt: t.expires_at,
      orderId: t.order_id,
      note: t.note,
      createdAt: t.created_at,
    })),
  };
}

/* ── Cart changes ─────────────────────────────────────────── */

function failure(
  res: { status: number; body: Record<string, unknown> | null } | null
): Extract<WalletCartResult, { ok: false }> {
  const message =
    typeof res?.body?.message === "string" ? (res.body.message as string) : "Wallet unavailable";
  if (res && res.status === 400 && /no wallet credit|nothing left/i.test(message)) {
    return { ok: false, reason: "no_credit", message };
  }
  if (res && res.status >= 400 && res.status < 500) {
    return { ok: false, reason: "not_allowed", message };
  }
  return { ok: false, reason: "failed", message };
}

/**
 * Put the customer's wallet credit on their cart. Medusa lowers the cart total
 * by that amount, so everything downstream (Razorpay, Cash on Delivery) charges
 * only what is left. Safe to call again: it replaces credit already on the cart.
 */
export async function applyWalletToCart(
  cartId: string,
  customerId: string
): Promise<WalletCartResult> {
  const res = await adminFetch("/admin/wallets/cart", {
    method: "POST",
    body: JSON.stringify({ cart_id: cartId, customer_id: customerId }),
  });
  if (!res || res.status !== 200 || !res.body) {
    if (res) console.error(`[medusa-wallet] apply failed ${res.status}:`, res.body);
    return failure(res);
  }

  return {
    ok: true,
    appliedAmount: Number(res.body.applied_amount ?? 0),
    walletBalance: Number(res.body.wallet_balance ?? 0),
    totals: normalizeCartTotals(res.body.cart as RawCartTotals | undefined),
  };
}

/** Take wallet credit off a cart so the customer pays the full total. */
export async function removeWalletFromCart(cartId: string): Promise<WalletCartResult> {
  const res = await adminFetch(`/admin/wallets/cart/${encodeURIComponent(cartId)}`, {
    method: "DELETE",
  });
  if (!res || res.status !== 200 || !res.body) {
    if (res) console.error(`[medusa-wallet] remove failed ${res.status}:`, res.body);
    return failure(res);
  }

  return {
    ok: true,
    appliedAmount: 0,
    walletBalance: 0,
    totals: normalizeCartTotals(res.body.cart as RawCartTotals | undefined),
  };
}

/* ── Checkout ─────────────────────────────────────────────── */

export type CheckoutWalletOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: "sign_in_required" | "no_credit" | "not_allowed" | "failed";
      message: string;
    };

/**
 * Make the cart match what the customer chose, right before payment starts.
 *
 * Wallet credit is re-applied here, after shipping is on the cart, so it can
 * cover the delivery charge too. When the customer did not choose wallet
 * credit, any credit left on the cart from an earlier toggle is removed, so an
 * order can never use credit the customer switched off. Guests have no wallet
 * and are left alone.
 */
export async function syncWalletForCheckout(
  cartId: string,
  useWallet: boolean
): Promise<CheckoutWalletOutcome> {
  const customer = await getWalletCustomer();

  if (!customer) {
    return useWallet
      ? { ok: false, reason: "sign_in_required", message: "Sign in to use wallet credit" }
      : { ok: true };
  }

  const result = useWallet
    ? await applyWalletToCart(cartId, customer.customerId)
    : await removeWalletFromCart(cartId);

  return result.ok ? { ok: true } : { ok: false, reason: result.reason, message: result.message };
}
