import type { Metadata } from "next";
import { SupportClient } from "@/components/support/SupportClient";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with orders, shipping, returns, and anything else you need.",
};

export default function SupportPage() {
  const { policy, contact } = storeConfig;
  return (
    <SupportClient
      copy={{
        returnDays: policy.returnDays,
        exchangeDays: policy.exchangeDays,
        deliveryDaysMin: policy.metroDaysMin,
        deliveryDaysMax: policy.indiaDaysMax,
        freeShippingAbove: policy.freeShippingAbove,
        warrantyMonths: policy.warrantyMonths,
        supportEmail: contact.supportEmail,
        ordersEmail: contact.ordersEmail,
      }}
    />
  );
}
