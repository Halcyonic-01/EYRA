/**
 * What an invoice or order receipt says, worked out once.
 *
 * The page on the site and the PDF both draw from this, so they can never show
 * different numbers. Pure functions only: no environment, no network. Amounts
 * are rupees, as Medusa stores them.
 *
 * Product prices include GST. The order's discount is spread over the product
 * lines in proportion to their price, then each line's GST is taken out of what
 * is left:
 *
 *   GST = net x 3 / 103        taxable value = net - GST
 *
 * so the taxable value plus the GST is exactly what the customer pays for the
 * products. The Cash on Delivery charge is its own invoice line: it includes
 * 18% GST under SAC 9997 (taxable value = charge x 100 / 118), is never mixed
 * into the product amount, and is itemised separately. The complimentary tote
 * is a line at a price of zero. The invoice a credit note reverses is exactly
 * this one: apps/backend gst-math.ts does the same sums.
 */
import { totalAfterWallet, walletCreditOf } from "./order-credit";
import { gstStateCode, inclusiveChargeAmounts, isInterState, productLineAmounts } from "@/lib/gst";
import type { InvoiceInfo } from "@/lib/invoice-kind";

export interface InvoiceOrderItem {
  id: string;
  title: string;
  /** For example "Pair" or "With silver chain". */
  variant_title?: string | null;
  quantity: number;
  unit_price: number;
}

export interface InvoiceOrderAddress {
  first_name: string | null;
  last_name: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  phone: string | null;
}

export interface InvoiceOrder {
  id: string;
  display_id: number;
  customer_id: string | null;
  email: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  currency_code: string;
  /** Items plus shipping, as Medusa reports it. Not used for the invoice body. */
  subtotal: number;
  /** Price of the items before any discount, without shipping. */
  item_subtotal?: number;
  discount_total?: number;
  shipping_total: number;
  total: number;
  /** Wallet credit used. It is a way of paying, so it never reduces the invoice value. */
  credit_line_total?: number;
  credit_lines?: { amount?: number | string | null; reference?: string | null }[];
  items: InvoiceOrderItem[];
  shipping_address: InvoiceOrderAddress | null;
  promotions?: { code?: string | null }[];
}

export interface InvoiceSeller {
  legalName: string;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

export interface InvoiceSettings {
  seller: InvoiceSeller;
  /** Total GST rate in percent on the jewellery, for example 3. */
  gstRate: number;
  hsnCode: string;
  /** GST rate in percent on the Cash on Delivery charge, for example 18. */
  codGstRate: number;
  /** SAC code of the Cash on Delivery charge, for example 9997. */
  sacCode: string;
  /** The seller's BIS hallmarking registration number, printed in the footer when set. */
  bisRegistration?: string;
}

export interface InvoiceLine {
  description: string;
  /** HSN for a product, SAC for the Cash on Delivery charge. */
  hsn: string | null;
  quantity: number;
  unitPrice: number;
  /** Price of the line before any discount. */
  grossAmount: number;
  /** This line's share of the order discount. Zero when there is none. */
  discount: number;
  /** What the customer pays for the line, GST included. */
  amount: number;
  /** The Cash on Delivery charge is a line of its own, apart from the products. */
  kind: "product" | "complimentary" | "cod_charge";
}

/** Tax for one HSN or SAC group, as the tax summary prints it. */
export interface TaxGroup {
  label: string;
  /** Total GST rate in percent. */
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
}

export interface TotalRow {
  label: string;
  /** Rupees, which can carry paise (for example ₹3,349.51). */
  amount: number;
  /** Drawn indented, as a part of the row above it. */
  indent?: boolean;
  /** Shown as "Free" when the amount is zero. */
  freeWhenZero?: boolean;
  /** A deduction, drawn with a minus sign. */
  deduction?: boolean;
}

export interface InvoiceView {
  kind: "tax_invoice" | "receipt";
  heading: string;
  invoiceNumber: string | null;
  orderNumber: number;
  dateText: string;
  cancelled: boolean;
  seller: { legalName: string; addressLines: string[]; gstin: string };
  buyer: { name: string; addressLines: string[]; email: string };
  supply: { state: string; stateCode: string; taxType: string } | null;
  lines: InvoiceLine[];
  /** True when any line carries a discount share, so the table shows that column. */
  hasDiscount: boolean;
  /** Tax per HSN or SAC group. Empty for a receipt. */
  taxGroups: TaxGroup[];
  /** Rows above the total: subtotal, discount, taxable value, tax, shipping. */
  rows: TotalRow[];
  totalLabel: string;
  total: number;
  /** Wallet credit paid with, and what is left to pay. Both null when no credit was used. */
  walletCredit: number | null;
  balancePayable: number | null;
  notice: string | null;
  footnote: string;
  /** The BIS hallmarking registration line for the footer, or null when the number is not set. */
  bisLine: string | null;
  /** Problems that stop this being a valid tax invoice. Empty when none. */
  issues: string[];
}

const GSTIN_FORMAT = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** A seller GSTIN that is missing or malformed, which stops this being a valid tax invoice. */
export function sellerIssues(seller: InvoiceSeller): string[] {
  const gstin = seller.gstin.trim().toUpperCase();
  if (!gstin) return ["The seller's GSTIN is not set (SELLER_GSTIN), so this is not a valid tax invoice."];
  if (!GSTIN_FORMAT.test(gstin)) {
    return ["The seller's GSTIN is not a valid 15-character GSTIN (SELLER_GSTIN)."];
  }
  return [];
}

/** Rupees as printed on an invoice: whole when they are, with paise when they are not. */
export function formatInvoiceAmount(amount: number): string {
  const paise = Math.round(amount * 100);
  const whole = paise % 100 === 0;
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function lineDescription(item: InvoiceOrderItem): string {
  const variant = (item.variant_title ?? "").trim();
  // A product with a single variant has one called "Default" (or "Default Title"): not worth printing.
  if (!variant || /^default( title| variant)?$/i.test(variant) || variant === item.title) return item.title;
  return `${item.title} (${variant})`;
}

/**
 * Builds the invoice or receipt. A receipt (before the order ships) has no
 * invoice number and no tax breakup; once shipped it is the numbered GST tax
 * invoice.
 */
export function buildInvoiceView(
  order: InvoiceOrder,
  invoice: InvoiceInfo,
  settings: InvoiceSettings
): InvoiceView {
  const { seller } = settings;
  const isTaxInvoice = invoice.kind === "tax_invoice";
  const cancelled = order.status === "canceled";

  const buyerState = order.shipping_address?.province ?? "";
  const inter = isInterState(buyerState, seller.state);
  const itemsSubtotal =
    order.item_subtotal ?? order.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const discount = order.discount_total ?? 0;

  const amounts = productLineAmounts(
    order.items.map((item) => ({ id: item.id, unit_price: item.unit_price, quantity: item.quantity })),
    discount,
    settings.gstRate,
    inter
  );

  const lines: InvoiceLine[] = order.items.map((item, index) => {
    const free = item.unit_price === 0;
    return {
      description: free ? `${lineDescription(item)} (complimentary)` : lineDescription(item),
      hsn: isTaxInvoice && !free ? settings.hsnCode : null,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      grossAmount: amounts[index].gross,
      discount: amounts[index].discount,
      amount: amounts[index].net,
      kind: free ? "complimentary" : "product",
    };
  });

  const sum = (pick: (line: (typeof amounts)[number]) => number) =>
    Math.round(amounts.reduce((total, line) => total + Math.round(pick(line) * 100), 0)) / 100;

  // What the customer pays for the products: the inclusive price, less the discount.
  const productAmount = sum((line) => line.net);
  const goodsTax = {
    taxable: sum((line) => line.base),
    cgst: sum((line) => line.cgst),
    sgst: sum((line) => line.sgst),
    igst: sum((line) => line.igst),
    gst: sum((line) => line.gst),
  };

  const code = order.promotions?.find((promotion) => promotion?.code)?.code ?? null;
  const codCharge = order.shipping_total;
  const cod = codCharge > 0 ? inclusiveChargeAmounts(codCharge, settings.codGstRate, inter) : null;

  // The Cash on Delivery charge: its own line, inclusive of its 18% GST.
  if (cod) {
    lines.push({
      description: "Cash on Delivery charge (incl. GST)",
      hsn: isTaxInvoice ? settings.sacCode : null,
      quantity: 1,
      unitPrice: codCharge,
      grossAmount: codCharge,
      discount: 0,
      amount: codCharge,
      kind: "cod_charge",
    });
  }

  const taxGroups: TaxGroup[] = [];
  if (isTaxInvoice) {
    taxGroups.push({
      label: `HSN ${settings.hsnCode}`,
      rate: settings.gstRate,
      taxable: goodsTax.taxable,
      cgst: goodsTax.cgst,
      sgst: goodsTax.sgst,
      igst: goodsTax.igst,
      gst: goodsTax.gst,
    });
    if (cod) {
      taxGroups.push({
        label: `SAC ${settings.sacCode}`,
        rate: settings.codGstRate,
        taxable: cod.base,
        cgst: cod.cgst,
        sgst: cod.sgst,
        igst: cod.igst,
        gst: cod.gst,
      });
    }
  }

  const half = (rate: number) => (inter ? rate : rate / 2);
  const rows: TotalRow[] = [];
  if (discount > 0) {
    rows.push({ label: "Items (incl. GST)", amount: itemsSubtotal });
    rows.push({ label: code ? `Discount (${code})` : "Discount", amount: discount, deduction: true });
  }
  rows.push({
    label: isTaxInvoice ? "Product amount (incl. GST)" : discount > 0 ? "Items after discount (incl. GST)" : "Items (incl. GST)",
    amount: productAmount,
  });
  if (isTaxInvoice) {
    rows.push({ label: `Taxable value, HSN ${settings.hsnCode} (excl. GST)`, amount: goodsTax.taxable, indent: true });
    if (inter) {
      rows.push({ label: `IGST (${half(settings.gstRate)}%)`, amount: goodsTax.igst, indent: true });
    } else {
      rows.push({ label: `CGST (${half(settings.gstRate)}%)`, amount: goodsTax.cgst, indent: true });
      rows.push({ label: `SGST (${half(settings.gstRate)}%)`, amount: goodsTax.sgst, indent: true });
    }
  }
  if (cod) {
    rows.push({ label: "Cash on Delivery charge (incl. GST)", amount: codCharge });
    if (isTaxInvoice) {
      rows.push({ label: `Taxable value, SAC ${settings.sacCode} (excl. GST)`, amount: cod.base, indent: true });
      if (inter) {
        rows.push({ label: `IGST (${half(settings.codGstRate)}%)`, amount: cod.igst, indent: true });
      } else {
        rows.push({ label: `CGST (${half(settings.codGstRate)}%)`, amount: cod.cgst, indent: true });
        rows.push({ label: `SGST (${half(settings.codGstRate)}%)`, amount: cod.sgst, indent: true });
      }
    }
  } else {
    rows.push({ label: "Shipping", amount: 0, freeWhenZero: true });
  }

  const walletCredit = walletCreditOf(order);
  const payable = totalAfterWallet(order);
  const total = payable + walletCredit;

  const invoiceDateText = invoice.invoiceDate
    ? new Date(`${invoice.invoiceDate}T00:00:00+05:30`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : formatDate(order.created_at);

  const buyerName = [order.shipping_address?.first_name, order.shipping_address?.last_name]
    .filter(Boolean)
    .join(" ");
  const address = order.shipping_address;

  let notice: string | null = null;
  if (order.metadata?.replacement_for_order) {
    notice =
      "This is for the replacement sent in an exchange. It was paid for by the item returned, which has its own credit note, and any price difference paid when the exchange was asked for.";
  }
  if (!isTaxInvoice) {
    notice = cancelled
      ? "This order was cancelled, so no tax invoice will be issued."
      : "This is an order receipt, not a tax invoice. Your GST tax invoice is issued when your order is dispatched, and will appear here and on your order page.";
  }

  return {
    kind: invoice.kind,
    heading: isTaxInvoice ? "Tax Invoice" : "Order Receipt",
    invoiceNumber: isTaxInvoice ? invoice.invoiceNumber ?? `INV-${order.display_id}` : null,
    orderNumber: order.display_id,
    dateText: isTaxInvoice && !invoice.legacy ? invoiceDateText : formatDate(order.created_at),
    cancelled,
    seller: {
      legalName: seller.legalName,
      addressLines: [
        [seller.addressLine1, seller.addressLine2].filter(Boolean).join(", "),
        `${seller.city}, ${seller.state} ${seller.pincode}`,
      ],
      gstin: seller.gstin.trim().toUpperCase(),
    },
    buyer: {
      name: buyerName || order.email || "",
      addressLines: [
        [address?.address_1, address?.address_2].filter(Boolean).join(", "),
        `${address?.city ?? ""}, ${address?.province ?? ""} ${address?.postal_code ?? ""}`.trim(),
      ].filter((line) => line.replace(/[,\s]/g, "")),
      email: order.email ?? "",
    },
    supply: isTaxInvoice
      ? {
          state: buyerState || "-",
          stateCode: gstStateCode(buyerState),
          taxType: inter ? "IGST (inter-state)" : "CGST + SGST (intra-state)",
        }
      : null,
    lines,
    hasDiscount: lines.some((line) => line.discount > 0),
    taxGroups,
    rows,
    totalLabel: walletCredit > 0 ? (isTaxInvoice ? "Invoice Total" : "Order Total") : "Total",
    total,
    walletCredit: walletCredit > 0 ? walletCredit : null,
    balancePayable: walletCredit > 0 ? payable : null,
    notice,
    footnote: isTaxInvoice
      ? "This is a computer-generated invoice and does not require a signature."
      : "This receipt confirms your order. It is not a tax invoice.",
    bisLine: settings.bisRegistration?.trim() ? `BIS Hallmarking registration no. ${settings.bisRegistration.trim()}` : null,
    issues: isTaxInvoice ? sellerIssues(seller) : [],
  };
}
