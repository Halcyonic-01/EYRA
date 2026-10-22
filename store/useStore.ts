import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product, ProductVariant } from "@/components/products/types";
import type { CartSummary, CartTotals } from "@/lib/medusa-cart";

export interface CartItem {
  product: Product;
  size: number | null;
  quantity: number;
  /** Medusa variant ID, undefined for mock-data items */
  variantId?: string;
  /** Medusa line item ID, set after the first successful backend sync */
  lineItemId?: string;
  /** What distinguishes this variant, for example "Pair" or "With silver chain". */
  variantLabel?: string | null;
  /** Price of one unit at the chosen variant, as Medusa charges it. */
  unitPrice: number;
  /** Compare-at price of one unit, for the strikethrough. */
  originalUnitPrice: number;
}

/**
 * One cart line is one variant. Rings and every other product are keyed by the
 * variant Medusa sells, so two variants of one product (a single anklet and a
 * pair) are two lines, each at its own price. Items without a variant (mock
 * data) fall back to product and size.
 */
export function lineKey(item: { product: { id: string }; size: number | null; variantId?: string }): string {
  return item.variantId ?? `${item.product.id}-${item.size ?? "null"}`;
}

/** The part of a variant that is not ring size, for example "Pair". Null when there is nothing to say. */
export function variantLabelFor(variant: ProductVariant | undefined): string | null {
  if (!variant) return null;
  const parts = Object.entries(variant.options)
    .filter(([title, value]) => !/size/i.test(title) && !(title === "Title" && value === "Default Title"))
    .map(([, value]) => value);
  return parts.length ? parts.join(" · ") : null;
}

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  syncStatus: "idle" | "syncing" | "error";
  syncError: string | null;
  serverTotals: CartTotals | null;
  /** Set when a discount code stopped applying because the cart changed. */
  promoNotice: string | null;

  addToCart: (product: Product, size?: number | null, variantId?: string) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
  clearSyncError: () => void;
  clearPromoNotice: () => void;
  setCartId: (id: string) => void;
  /** Take the backend's cart summary as the truth for prices and totals. */
  applySummary: (summary: CartSummary) => void;
  initCart: () => Promise<void>;
}

/** Module-level debounce map for updateQuantity syncs. */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
  items: [],
  cartId: null,
  syncStatus: "idle",
  syncError: null,
  serverTotals: null,
  promoNotice: null,

  setCartId(id) {
    set({ cartId: id });
  },

  clearSyncError() {
    set({ syncError: null, syncStatus: "idle" });
  },

  clearPromoNotice() {
    set({ promoNotice: null });
  },

  applySummary(summary) {
    set((state) => {
      const paid = summary.items;
      const items = state.items.map((item) => {
        const match =
          paid.find((line) => line.id === item.lineItemId) ??
          paid.find((line) => line.variant_id && line.variant_id === item.variantId);
        return match ? { ...item, lineItemId: match.id, unitPrice: match.unit_price } : item;
      });

      const before = state.serverTotals;
      const lost =
        before && before.promoCodes.length > 0 && summary.promo_codes.length === 0
          ? `${before.promoCodes[0]} no longer applies to your order.`
          : state.promoNotice;

      return {
        items,
        serverTotals: {
          subtotal: Math.round(summary.totals.items_subtotal),
          taxTotal: Math.round(summary.totals.tax_total),
          shippingTotal: Math.round(summary.totals.shipping_total),
          discountTotal: Math.round(summary.totals.discount_total),
          walletCredit: Math.round(summary.totals.wallet_credit),
          // Wallet credit is a way of paying, not a price change, so the cart
          // always shows the full total. Checkout shows the credit as its own line.
          total: Math.round(summary.totals.total + summary.totals.wallet_credit),
          promoCodes: summary.promo_codes,
          paymentMode: summary.payment_mode,
          tote: { qualifies: summary.tote.qualifies, inCart: summary.tote.in_cart },
        },
        promoNotice: lost,
      };
    });
  },

  addToCart(product, size = null, variantId) {
    const variant = product.variants?.find((v) => v.id === variantId);
    const unitPrice = variant?.price ?? product.price;
    const originalUnitPrice = variant?.originalPrice ?? product.originalPrice;
    const candidate = { product, size, variantId };
    const key = lineKey(candidate);
    // Captured before the optimistic mutation so a failed sync can undo
    // exactly what this call did, rather than wiping the whole line.
    const existedBefore = get().items.some((i) => lineKey(i) === key);

    // Optimistic update
    set((state) => {
      const existing = state.items.find((i) => lineKey(i) === key);
      if (existing) {
        return {
          items: state.items.map((i) =>
            lineKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i
          ),
          syncStatus: "syncing" as const,
        };
      }
      return {
        items: [
          ...state.items,
          {
            product,
            size,
            quantity: 1,
            variantId,
            variantLabel: variantLabelFor(variant),
            unitPrice,
            originalUnitPrice,
          },
        ],
        syncStatus: "syncing" as const,
      };
    });

    // Background Medusa sync, only when a variant ID is available
    if (!variantId) {
      set({ syncStatus: "idle" });
      return;
    }

    // If the server explicitly rejected this item (e.g. insufficient
    // inventory), undo the optimistic add/increment so "Added to cart" can't
    // linger over an item that was actually refused. Only called for a
    // definitive rejection, not for a request that never got a response, see
    // the CartRequestRejected comment below for why that distinction matters.
    function rollback() {
      set((state) => ({
        items: existedBefore
          ? state.items
              .map((i) =>
                lineKey(i) === key ? { ...i, quantity: i.quantity - 1 } : i
              )
              .filter((i) => i.quantity > 0)
          : state.items.filter((i) => lineKey(i) !== key),
      }));
    }

    (async () => {
      // Imported outside the try block so CartRequestRejected stays in scope
      // for the catch clause below, which needs to check `instanceof` it.
      const { createCart, setStoredCartId, addCartLineItem, CartRequestRejected } =
        await import("@/lib/medusa-cart");

      try {
        // Prefer the cartId already in the store (rehydrated by persist middleware).
        // Only create a new cart when there genuinely isn't one.
        let cartId = get().cartId;
        if (!cartId) {
          cartId = await createCart();
          if (!cartId) {
            // createCart returning null (rather than throwing) means the
            // request never got a response at all, offline, or the page is
            // mid-navigation, not that the server refused it. There's
            // nothing item-specific to undo here either way.
            set({ syncStatus: "error", syncError: "Could not add item to cart. Please try again." });
            return;
          }
          setStoredCartId(cartId); // keep eyra_cart_id in sync as a fallback
        }

        const result = await addCartLineItem(cartId, variantId, 1);
        if (!result) {
          // Same as above: the request never completed, so we genuinely
          // don't know whether Medusa has this item or not. Rolling back
          // here would wrongly discard a real add that just hadn't finished
          // yet, e.g. because the user navigated away right after clicking,
          // which is exactly what CartRequestRejected below exists to avoid.
          set({ syncStatus: "error", syncError: "Could not add item to cart. Please try again." });
          return;
        }

        set((state) => ({
          cartId,
          syncStatus: "idle",
          syncError: null,
          items: state.items.map((i) =>
            lineKey(i) === key ? { ...i, lineItemId: result.lineItemId } : i
          ),
        }));
        get().applySummary(result.summary);
      } catch (err) {
        console.error("[cart] addToCart sync failed:", err);
        // Only a definitive server rejection (Medusa actually responded "no",
        // e.g. insufficient_inventory) justifies discarding what the user
        // already saw as "Added to cart". Any other thrown error here is
        // inconclusive, an aborted request, a dropped connection, and
        // shouldn't erase state the customer already saw confirmed.
        if (err instanceof CartRequestRejected) {
          rollback();
          set({ syncStatus: "error", syncError: "This item is no longer available in that option." });
        } else {
          set({ syncStatus: "error", syncError: "Cart sync failed. Please try again." });
        }
      }
    })();
  },

  removeFromCart(key) {
    // Capture lineItemId before optimistic remove
    const item = get().items.find((i) => lineKey(i) === key);
    const { lineItemId } = item ?? {};
    const cartId = get().cartId;

    // Optimistic update
    set((state) => ({
      items: state.items.filter((i) => lineKey(i) !== key),
      syncStatus: lineItemId ? ("syncing" as const) : ("idle" as const),
    }));

    if (!lineItemId || !cartId) return;

    (async () => {
      try {
        const { removeCartLineItem } = await import("@/lib/medusa-cart");
        const summary = await removeCartLineItem(cartId, lineItemId);
        set({ syncStatus: "idle", syncError: null });
        if (summary) get().applySummary(summary);
      } catch (err) {
        console.error("[cart] removeFromCart sync failed:", err);
        set({ syncStatus: "error", syncError: "Could not remove item from the server cart. It has been removed locally." });
      }
    })();
  },

  updateQuantity(key, qty) {
    if (qty < 1) {
      get().removeFromCart(key);
      return;
    }

    // Optimistic update
    set((state) => ({
      items: state.items.map((i) => (lineKey(i) === key ? { ...i, quantity: qty } : i)),
    }));

    // Debounced sync
    const existing = debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    debounceTimers.set(
      key,
      setTimeout(async () => {
        debounceTimers.delete(key);

        const cartId = get().cartId;
        const item = get().items.find((i) => lineKey(i) === key);
        const lineItemId = item?.lineItemId;
        if (!cartId || !lineItemId) return;

        try {
          const { updateCartLineItem } = await import("@/lib/medusa-cart");
          const summary = await updateCartLineItem(cartId, lineItemId, qty);
          if (summary) {
            set({ syncStatus: "idle", syncError: null });
            get().applySummary(summary);
          }
        } catch (err) {
          console.error("[cart] updateQuantity sync failed:", err);
          set({ syncStatus: "error", syncError: "Quantity updated locally but could not sync to server." });
        }
      }, 500)
    );
  },

  clearCart() {
    // Cancel any pending debounced updates
    debounceTimers.forEach((timer) => clearTimeout(timer));
    debounceTimers.clear();

    set({
      items: [],
      cartId: null,
      serverTotals: null,
      promoNotice: null,
      syncStatus: "idle",
      syncError: null,
    });

    // Fire-and-forget localStorage cleanup (client-only)
    if (typeof window !== "undefined") {
      import("@/lib/medusa-cart").then(({ clearStoredCartId }) => clearStoredCartId());
    }
  },

  cartTotal() {
    return get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  },

  async initCart() {
    if (typeof window === "undefined") return;

    // cartId is already rehydrated from localStorage by persist middleware.
    // Use it directly; no need to read localStorage manually.
    const cartId = get().cartId;
    if (!cartId) return;

    const { fetchCart, clearStoredCartId } = await import("@/lib/medusa-cart");
    let fetched: CartSummary | null;
    try {
      fetched = await fetchCart(cartId);
    } catch (err) {
      // The backend could not be reached just now: keep what the customer has.
      console.error("[cart] initCart could not reach the backend:", err);
      return;
    }

    if (!fetched || fetched.completed) {
      // Cart expired on the server or already became an order, clear stale
      // state so the next addToCart creates a fresh cart rather than retrying
      // a dead cartId.
      clearStoredCartId();
      set({ cartId: null, items: [], serverTotals: null });
      return;
    }

    // Reconnect server lines to the persisted items array, and take the
    // server's quantity and price as the truth.
    const paid = fetched.items;
    set((state) => ({
      items: state.items.map((item) => {
        const serverItem = paid.find((line) => line.variant_id && line.variant_id === item.variantId);
        return serverItem
          ? { ...item, lineItemId: serverItem.id, quantity: serverItem.quantity, unitPrice: serverItem.unit_price }
          : item;
      }),
    }));
    get().applySummary(fetched);
  },
}),
    {
      name: "eyra-cart-storage",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // Carts saved before variant pricing have no unit price: use the product's.
      migrate: (persisted) => {
        const state = persisted as { items?: Partial<CartItem>[]; cartId?: string | null };
        return {
          cartId: state.cartId ?? null,
          items: (state.items ?? []).map((item) => ({
            ...item,
            unitPrice: item.unitPrice ?? item.product?.price ?? 0,
            originalUnitPrice: item.originalUnitPrice ?? item.product?.originalPrice ?? 0,
            variantLabel: item.variantLabel ?? null,
          })),
        } as unknown as CartStore;
      },
      // Only persist the cart contents and backend cart ID.
      // UI flags and server-computed totals are always derived fresh.
      partialize: (state) => ({
        items: state.items,
        cartId: state.cartId,
      }),
    }
  )
);

/** A wishlist entry pairs the product with the variant that was active when
 *  the user hearted it. variantId is forwarded to addToCart so Medusa can
 *  sync the correct SKU without requiring the user to re-select a size. */
export interface WishlistItem {
  product: Product;
  /** Resolved Medusa variant ID (size-specific or product default). */
  variantId: string | undefined;
  /**
   * Ring size chosen when the item was hearted, null when none was. Kept
   * alongside variantId because variantId identifies the SKU for Medusa but
   * says nothing the customer can read: without this, moving a wishlisted
   * ring to the cart produced a line with the right variant and no visible
   * size at all. Absent on entries saved before this field existed.
   */
  size?: number | null;
}

interface WishlistStore {
  items: WishlistItem[];
  hasSynced: boolean;
  toggle: (product: Product, variantId?: string, size?: number | null) => void;
  isWishlisted: (productId: string) => boolean;
  remove: (productId: string) => void;
  initWishlist: () => Promise<void>;
  /** Forget the local list on sign-out. Does not touch the saved server copy. */
  reset: () => void;
}

/** Push the current wishlist to Medusa. No-ops server-side for guests/unsynced customers. */
function syncWishlist(items: WishlistItem[]) {
  fetch("/api/wishlist", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((i) => ({
        productId: i.product.id,
        variantId: i.variantId,
        size: i.size ?? null,
      })),
    }),
  }).catch((err) => {
    console.error("[wishlist] sync failed:", err);
  });
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      hasSynced: false,

      toggle(product, variantId, size = null) {
        set((state) => {
          const exists = state.items.some((i) => i.product.id === product.id);
          // Store variantId exactly as the caller resolved it. Falling back
          // to product.variantId here used to silently overwrite an
          // intentional "no size chosen yet" (undefined) with an arbitrary
          // variant, defeating the caller's own size-required check.
          const items = exists
            ? state.items.filter((i) => i.product.id !== product.id)
            : [...state.items, { product, variantId, size }];
          syncWishlist(items);
          return { items };
        });
      },

      isWishlisted(productId) {
        return get().items.some((i) => i.product.id === productId);
      },

      remove(productId) {
        set((state) => {
          const items = state.items.filter((i) => i.product.id !== productId);
          syncWishlist(items);
          return { items };
        });
      },

      /**
       * Reconcile with the server wishlist once per session, after sign-in.
       * Merges by product ID rather than replacing outright, so items a guest
       * favourited before logging in aren't lost, then pushes the merged
       * result back so the server reflects it too.
       */
      reset() {
        set({ items: [], hasSynced: false });
      },

      async initWishlist() {
        if (get().hasSynced) return;
        set({ hasSynced: true });

        try {
          const res = await fetch("/api/wishlist");
          if (!res.ok) return;
          const data = (await res.json()) as { items?: WishlistItem[] };
          const serverItems = data.items ?? [];
          if (serverItems.length === 0) return;

          set((state) => {
            const merged = [...state.items];
            for (const serverItem of serverItems) {
              if (!merged.some((i) => i.product.id === serverItem.product.id)) {
                merged.push(serverItem);
              }
            }
            if (merged.length !== state.items.length) syncWishlist(merged);
            return { items: merged };
          });
        } catch (err) {
          console.error("[wishlist] init sync failed:", err);
        }
      },
    }),
    {
      name: "eyra-wishlist-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
