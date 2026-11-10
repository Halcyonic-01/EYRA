import type { Metadata } from "next";
import { WishlistClient } from "@/components/wishlist/WishlistClient";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Your saved items. Jewellery you love.",
};

export default function WishlistPage() {
  return (
    <>
      <WishlistClient />
      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}
