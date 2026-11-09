import type { Metadata } from "next";
import { WishlistClient } from "@/components/wishlist/WishlistClient";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Your saved items. Jewellery you love.",
};

export default function WishlistPage() {
  return (
    <>
      <WishlistClient
        policy={{
          returnDays: storeConfig.policy.returnDays,
          exchangeDays: storeConfig.policy.exchangeDays,
        }}
      />
      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}
