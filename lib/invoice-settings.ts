import { storeConfig } from "@/config/storeConfig";
import type { InvoiceSettings } from "@/lib/invoice-view";

/** The seller and tax settings every invoice and credit note is drawn with. One place, so none can differ. */
export function invoiceSettings(): InvoiceSettings {
  return {
    seller: storeConfig.seller,
    gstRate: storeConfig.jewelry.gstRate,
    hsnCode: storeConfig.jewelry.hsnCode,
    codGstRate: storeConfig.service.gstRate,
    sacCode: storeConfig.service.sacCode,
    bisRegistration: storeConfig.company.bisRegistration,
  };
}
