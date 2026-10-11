"use client";

import { useClerk } from "@clerk/nextjs";
import { useCallback } from "react";

import { useWishlistStore } from "@/store/useStore";

/** Signs out and returns to the shop, leaving no wishlist behind for the next person. */
export function useSignOut() {
  const { signOut } = useClerk();
  const resetWishlist = useWishlistStore((s) => s.reset);

  return useCallback(() => {
    resetWishlist();
    void signOut({ redirectUrl: "/" });
  }, [resetWishlist, signOut]);
}
