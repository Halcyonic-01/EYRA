import { create } from "zustand";

/**
 * Whether the slide-out bag is open. It is tied to the page it was opened on,
 * so moving to another page (checkout, the full bag) closes it on its own.
 */
interface CartDrawerState {
  openOn: string | null;
  open: (pathname: string) => void;
  close: () => void;
}

export const useCartDrawer = create<CartDrawerState>((set) => ({
  openOn: null,
  open: (pathname) => set({ openOn: pathname }),
  close: () => set({ openOn: null }),
}));

/** Pages that already show the bag in full, where the drawer would only repeat it. */
export function drawerAllowedOn(pathname: string): boolean {
  return pathname !== "/cart" && !pathname.startsWith("/checkout");
}
