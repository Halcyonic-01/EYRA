/**
 * Centralised business constants for EYRA.
 *
 * All values fall back to safe defaults but can be overridden at runtime via
 * server-side environment variables, no redeploy required when logistics
 * thresholds or tax rates change.
 *
 * Env vars (never prefixed with NEXT_PUBLIC_, server-only):
 *   JEWELRY_HSN_CODE          BIS HSN code (default: "7113")
 *   JEWELRY_GST_RATE          GST % as a number (default: 3)
 *   SHIP_WEIGHT_RING_G        Ring weight in grams (default: 6)
 *   SHIP_WEIGHT_CHAIN_G       Chain/necklace weight in grams (default: 15)
 *   SHIP_WEIGHT_BRACELET_G    Bracelet weight in grams (default: 12)
 *   SHIP_WEIGHT_ANKLET_G      Anklet weight in grams (default: 10)
 *   SHIP_DEFAULT_WEIGHT_G     Fallback per-item weight in grams (default: 10)
 *   SHIP_MIN_WEIGHT_KG        Shiprocket minimum chargeable slab in kg (default: 0.5)
 *   SHIP_BOX_LENGTH_CM        Jewellery box length in cm (default: 10)
 *   SHIP_BOX_BREADTH_CM       Jewellery box breadth in cm (default: 8)
 *   SHIP_BOX_HEIGHT_CM        Jewellery box height in cm (default: 3)
 *   SELLER_GSTIN              15-character GST registration number (no default, invoices flag it missing)
 *   SELLER_LEGAL_NAME         Registered business name for invoices
 *   SELLER_ADDRESS_LINE1      Registered address, line 1
 *   SELLER_ADDRESS_LINE2      Registered address, line 2
 *   SELLER_CITY               Registered city
 *   SELLER_STATE              Registered state (must match a GST_STATE_CODES key in lib/gst.ts)
 *   SELLER_PINCODE            Registered PIN code
 */

function envFloat(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return isFinite(parsed) ? parsed : fallback;
}

function envString(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const storeConfig = {
  jewelry: {
    /** Articles of jewelry of precious metal, BIS standard HSN. */
    hsnCode: envString("JEWELRY_HSN_CODE", "7113"),
    /** GST rate (%) applied to each order item in Shiprocket payloads. */
    gstRate: envFloat("JEWELRY_GST_RATE", 3),
  },

  shipping: {
    /** Shiprocket minimum chargeable weight slab (kg). */
    minChargeableWeightKg: envFloat("SHIP_MIN_WEIGHT_KG", 0.5),
    /** Per-item weight (g) used when the product type is unrecognised. */
    defaultItemWeightG: envFloat("SHIP_DEFAULT_WEIGHT_G", 10),
    /** Per-product-type manufacturing weights (g). */
    itemWeightsG: {
      ring: envFloat("SHIP_WEIGHT_RING_G", 6),
      chain: envFloat("SHIP_WEIGHT_CHAIN_G", 15),
      bracelet: envFloat("SHIP_WEIGHT_BRACELET_G", 12),
      anklet: envFloat("SHIP_WEIGHT_ANKLET_G", 10),
    } as Record<string, number>,
    /** Standard jewellery box dimensions (cm) sent to Shiprocket. */
    box: {
      length: envFloat("SHIP_BOX_LENGTH_CM", 10),
      breadth: envFloat("SHIP_BOX_BREADTH_CM", 8),
      height: envFloat("SHIP_BOX_HEIGHT_CM", 3),
    },
  },

  /**
   * Registered-seller details for GST invoices, the "Bill From" identity,
   * confirmed against the real GSTIN (state code 20 = Jharkhand). This is
   * deliberately independent of the Shiprocket pickup address above: the
   * warehouse a courier collects packages from has no bearing on where the
   * business is actually GST-registered, and the GST split (CGST+SGST vs
   * IGST) must compare the buyer's state against *this* state, not that one.
   */
  seller: {
    legalName: envString("SELLER_LEGAL_NAME", "EYRA JEWELS PRIVATE LIMITED"),
    gstin: envString("SELLER_GSTIN", ""),
    addressLine1: envString("SELLER_ADDRESS_LINE1", "Ward No. 12, Main Road"),
    addressLine2: envString("SELLER_ADDRESS_LINE2", ""),
    city: envString("SELLER_CITY", "Garhwa"),
    state: envString("SELLER_STATE", "Jharkhand"),
    pincode: envString("SELLER_PINCODE", "822114"),
  },

  /**
   * Public contact points. These are quoted verbatim in the policy pages and
   * the contact page, so they live here rather than being retyped per page.
   * The domain matches the one EYRA actually owns and sends mail from.
   */
  contact: {
    supportEmail: envString("SUPPORT_PUBLIC_EMAIL", "support@eyra.org.in"),
    /** Statutory / corporate mailbox used for legal and data requests. */
    adminEmail: envString("ADMIN_PUBLIC_EMAIL", "admin@eyra.org.in"),
    pressEmail: envString("PRESS_PUBLIC_EMAIL", "press@eyra.org.in"),
    careersEmail: envString("CAREERS_PUBLIC_EMAIL", "careers@eyra.org.in"),
    /**
     * WhatsApp support number in international format without symbols, e.g.
     * "919876543210". The footer and contact page only render a WhatsApp link
     * when this is set, so an unconfigured number never becomes a dead link.
     */
    whatsapp: envString("SUPPORT_WHATSAPP_NUMBER", ""),
    /** Support hours shown on the contact page. */
    hours: "Monday to Saturday, 10am to 7pm IST",
  },

  /**
   * Corporate identity required on the footer and legal pages under the
   * Companies Act and the Consumer Protection (E-Commerce) Rules, 2020.
   */
  company: {
    cin: envString("COMPANY_CIN", "U32111JH2026PTC028056"),
    grievanceOfficer: envString("GRIEVANCE_OFFICER_NAME", "Aman Agarwal"),
    grievanceOfficerTitle: "Grievance and Nodal Officer",
  },

  /**
   * Customer-facing policy windows. The product page badges, the support FAQ,
   * and every policy page read from here so they cannot drift apart.
   */
  policy: {
    /** Return window, in days from delivery. */
    returnDays: envFloat("POLICY_RETURN_DAYS", 15),
    /** Exchange window, in days from delivery. */
    exchangeDays: envFloat("POLICY_EXCHANGE_DAYS", 15),
    /**
     * Months wallet credit stays usable after it is issued; 0 means never.
     * The backend reads the same WALLET_CREDIT_VALIDITY_MONTHS to set expiry
     * dates, so set it to the same value in both places.
     */
    walletCreditMonths: envFloat("WALLET_CREDIT_VALIDITY_MONTHS", 6),
    /** Hours to pack and hand an in-stock order to the courier. */
    dispatchHoursMin: envFloat("POLICY_DISPATCH_HOURS_MIN", 24),
    dispatchHoursMax: envFloat("POLICY_DISPATCH_HOURS_MAX", 48),
    /** Extra working days needed for personalised or engraved pieces. */
    customExtraDaysMin: envFloat("POLICY_CUSTOM_DAYS_MIN", 3),
    customExtraDaysMax: envFloat("POLICY_CUSTOM_DAYS_MAX", 5),
    /** Delivery time in business days for metro addresses. */
    metroDaysMin: envFloat("POLICY_METRO_DAYS_MIN", 2),
    metroDaysMax: envFloat("POLICY_METRO_DAYS_MAX", 4),
    /** Delivery time in business days for the rest of India. */
    indiaDaysMin: envFloat("POLICY_INDIA_DAYS_MIN", 4),
    indiaDaysMax: envFloat("POLICY_INDIA_DAYS_MAX", 7),
    /** Order value (INR) above which prepaid shipping is free. */
    freeShippingAbove: envFloat("POLICY_FREE_SHIPPING_ABOVE", 499),
    /** Business days for a refund to reach the original payment source. */
    refundDaysMin: envFloat("POLICY_REFUND_DAYS_MIN", 5),
    refundDaysMax: envFloat("POLICY_REFUND_DAYS_MAX", 7),
    /** Hours within which transit damage or a tampered parcel must be reported. */
    damageClaimHours: envFloat("POLICY_DAMAGE_CLAIM_HOURS", 48),
    /** Return postage (INR) reimbursed when a pincode is not reverse-serviceable. */
    selfShipReimbursement: envFloat("POLICY_SELF_SHIP_REIMBURSEMENT", 70),
    /** Grievance acknowledgement and resolution SLA. */
    grievanceAckHours: envFloat("POLICY_GRIEVANCE_ACK_HOURS", 48),
    grievanceResolutionDays: envFloat("POLICY_GRIEVANCE_RESOLUTION_DAYS", 30),
    /** Warranty on manufacturing defects, in months. */
    warrantyMonths: envFloat("POLICY_WARRANTY_MONTHS", 6),
  },
} as const;
