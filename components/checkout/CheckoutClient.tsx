"use client";

import { useState, useEffect, useMemo } from "react";
import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useCartStore } from "@/store/useStore";
import type { CartItem } from "@/store/useStore";
import { estimatedDeliveryDate, formatDeliveryDateShort } from "@/lib/delivery-date";
import { formatRupees } from "@/lib/money";
import { WalletPanel } from "@/components/checkout/WalletPanel";

const INDIAN_STATES = [
  "Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh",
  "Assam","Bihar","Chandigarh","Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu","Delhi","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir",
  "Jharkhand","Karnataka","Kerala","Ladakh","Lakshadweep",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Puducherry","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal",
];

/* ── Types ────────────────────────────────────────────────── */
interface ShippingForm {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

type ShippingErrors = Partial<Record<keyof ShippingForm, string>>;
type TouchedFields = Partial<Record<keyof ShippingForm, boolean>>;
type PaymentMethod = "cod" | "prepaid";
type CheckoutStep = 1 | 2 | 3;
type PincodeStatus = "idle" | "loading" | "valid" | "invalid" | "unserviceable";

interface ServiceabilityResult {
  serviceable: boolean;
  estimatedDays: number;
  availablePaymentMethods: string[];
}

/** Server-authoritative totals used throughout all checkout steps. */
interface DisplayTotals {
  subtotal: number;
  tax: number;
  delivery: number;
  discount: number;
  /** Wallet credit applied to the cart; `total` is already net of it. */
  walletCredit: number;
  total: number;
  /** True when Medusa cart hasn't synced yet, values are client estimates. */
  isEstimate: boolean;
}

/** Cart totals returned by /api/wallet/apply, in rupees. */
interface WalletCartTotals {
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  walletCredit: number;
  total: number;
}

/* ── Validation ───────────────────────────────────────────── */
function validateShipping(f: ShippingForm): ShippingErrors {
  const e: ShippingErrors = {};
  if (!f.fullName.trim()) e.fullName = "Full name is required.";
  else if (f.fullName.trim().length < 2) e.fullName = "Name must be at least 2 characters.";
  if (!f.addressLine1.trim()) e.addressLine1 = "Address is required.";
  else if (f.addressLine1.trim().length < 10) e.addressLine1 = "Please enter a complete address.";
  if (!f.city.trim()) e.city = "City is required.";
  if (!f.state) e.state = "Please select a state.";
  if (!f.pincode.trim()) e.pincode = "Pincode is required.";
  else if (!/^\d{6}$/.test(f.pincode.trim())) e.pincode = "Enter a valid 6-digit pincode.";
  if (!f.phone.trim()) e.phone = "Phone number is required.";
  else if (!/^[6-9]\d{9}$/.test(f.phone.trim())) e.phone = "Enter a valid 10-digit mobile number.";
  return e;
}

/* ── Helpers ──────────────────────────────────────────────── */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 text-[12px] text-[#D93025] flex items-center gap-1">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="#D93025" strokeWidth="2" />
        <path d="M12 7v5M12 16.5v.5" stroke="#D93025" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {msg}
    </p>
  );
}

function inputCls(err?: string, touched?: boolean): string {
  const base =
    "w-full px-4 h-[52px] bg-white text-[#3D3D3D] text-[15px] placeholder:text-[#909090] rounded-2xl outline-none transition-colors duration-150 border font-sans";
  if (touched && err) return `${base} border-[#D93025] focus:border-[#D93025]`;
  return `${base} border-[#E1E1E1] focus:border-[#AAAAAA]`;
}

function generateOrderId(): string {
  return `EYRA-${Date.now().toString(36).toUpperCase()}`;
}

/* ── Step indicator ───────────────────────────────────────── */
const STEP_LABELS = ["Shipping", "Review", "Payment"] as const;

function StepIndicator({ current }: { current: CheckoutStep }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {STEP_LABELS.map((label, i) => {
        const num = (i + 1) as CheckoutStep;
        const done = current > num;
        const active = current === num;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-medium transition-colors duration-200 font-sans ${
                  done || active ? "bg-black text-white" : "bg-[#F0F0F0] text-[#AAAAAA]"
                }`}
              >
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  num
                )}
              </div>
              <span className={`text-[12px] font-sans ${active ? "text-black font-medium" : done ? "text-[#555]" : "text-[#AAAAAA]"}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`w-20 h-[1.5px] mb-4 mx-2 transition-colors duration-300 ${current > num ? "bg-black" : "bg-[#E0E0E0]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Order sidebar ────────────────────────────────────────── */
function OrderSidebar({ items, totals }: { items: CartItem[]; totals: DisplayTotals }) {
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div
      className="w-full lg:w-[360px] flex-shrink-0 rounded-2xl p-6 flex flex-col gap-5 lg:sticky lg:self-start"
      style={{ background: "#F7F7F7", top: "calc(var(--nav-height) + 2rem)" }}
    >
      <h2 className="font-sans font-medium text-[16px] text-black">Order Summary</h2>

      <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={`${item.product.id}-${item.size}`} className="flex gap-3 items-center">
            <div className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-white border border-[#E1E1E1]">
              <Image src={item.product.images[0]} alt={item.product.name} fill className="object-contain p-1" sizes="48px" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans font-normal text-[13px] text-black truncate">{item.product.name}</p>
              {item.size && <p className="font-sans font-normal text-[11px] text-[#909090]">Size: {item.size}</p>}
              <p className="font-sans font-normal text-[11px] text-[#626262]">Qty: {item.quantity}</p>
            </div>
            <span className="font-sans font-medium text-[13px] text-black flex-shrink-0">
              ₹{(item.product.price * item.quantity).toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full h-px bg-[#DFDFDF]" />

      <div className="flex flex-col gap-2.5 text-[13px] font-sans">
        <div className="flex justify-between">
          <span className="text-[#626262]">Subtotal ({totalQty} {totalQty === 1 ? "item" : "items"})</span>
          <span className="text-black">₹{totals.subtotal.toLocaleString("en-IN")}</span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between">
            <span className="text-[#626262]">Discount</span>
            <span className="text-black">− ₹{totals.discount.toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[#626262]">Tax (GST)</span>
          <span className="text-black">
            {totals.isEstimate ? "-" : `₹${totals.tax.toLocaleString("en-IN")}`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#626262]">Delivery</span>
          {totals.isEstimate ? (
            <span className="text-black">-</span>
          ) : totals.delivery === 0 ? (
            <span className="font-medium" style={{ color: "#47B10A" }}>FREE</span>
          ) : (
            <span className="text-black">₹{totals.delivery}</span>
          )}
        </div>
        {totals.walletCredit > 0 && (
          <div className="flex justify-between">
            <span className="text-[#626262]">Wallet credit</span>
            <span className="font-medium" style={{ color: "#47B10A" }}>− {formatRupees(totals.walletCredit)}</span>
          </div>
        )}
      </div>

      <div className="w-full h-px bg-[#DFDFDF]" />

      <div className="flex justify-between items-center">
        <span className="font-sans font-semibold text-[16px] text-black">
          {totals.isEstimate ? "Estimated Total" : "Total"}
        </span>
        <span className="font-sans font-semibold text-[20px] text-black">
          ₹{totals.total.toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}

/* ── Step 1: Shipping ─────────────────────────────────────── */
function ShippingStep({
  form, errors, touched, pincodeStatus, serviceability, onChange, onBlur, onNext,
}: {
  form: ShippingForm;
  errors: ShippingErrors;
  touched: TouchedFields;
  pincodeStatus: PincodeStatus;
  serviceability: ServiceabilityResult | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="font-sans font-medium text-[20px] text-black mb-6">Shipping Details</h2>
      <form onSubmit={(e) => { e.preventDefault(); onNext(); }} noValidate className="flex flex-col gap-4">

        {/* Full name */}
        <div>
          <label className="block font-sans font-normal text-[13px] text-[#5D5D5D] mb-1.5">Full Name</label>
          <input
            type="text" name="fullName" value={form.fullName}
            onChange={onChange} onBlur={onBlur}
            placeholder="Aman Agarwal"
            className={inputCls(errors.fullName, touched.fullName)}
            autoComplete="name"
          />
          <FieldError msg={touched.fullName ? errors.fullName : undefined} />
        </div>

        {/* Address line 1 */}
        <div>
          <label className="block font-sans font-normal text-[13px] text-[#5D5D5D] mb-1.5">Address Line 1</label>
          <input
            type="text" name="addressLine1" value={form.addressLine1}
            onChange={onChange} onBlur={onBlur}
            placeholder="House no., Street, Area"
            className={inputCls(errors.addressLine1, touched.addressLine1)}
            autoComplete="address-line1"
          />
          <FieldError msg={touched.addressLine1 ? errors.addressLine1 : undefined} />
        </div>

        {/* Address line 2 */}
        <div>
          <label className="block font-sans font-normal text-[13px] text-[#5D5D5D] mb-1.5">
            Address Line 2 <span className="text-[#AAAAAA]">(optional)</span>
          </label>
          <input
            type="text" name="addressLine2" value={form.addressLine2}
            onChange={onChange} onBlur={onBlur}
            placeholder="Landmark, Apartment, Building"
            className={inputCls(undefined, false)}
            autoComplete="address-line2"
          />
        </div>

        {/* Pincode + City */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-sans font-normal text-[13px] text-[#5D5D5D] mb-1.5">Pincode</label>
            <div className="relative">
              <input
                type="text" name="pincode" value={form.pincode}
                onChange={onChange} onBlur={onBlur}
                placeholder="400001" maxLength={6}
                className={inputCls(errors.pincode, touched.pincode)}
                autoComplete="postal-code" inputMode="numeric"
              />
              {pincodeStatus === "loading" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#AAAAAA] border-t-black rounded-full animate-spin" />
              )}
              {pincodeStatus === "valid" && (
                <svg className="absolute right-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#47B10A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              {(pincodeStatus === "invalid" || pincodeStatus === "unserviceable") && (
                <svg className="absolute right-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D93025" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <FieldError msg={touched.pincode ? errors.pincode : undefined} />
            {/* Serviceability result badge */}
            {pincodeStatus === "valid" && serviceability?.serviceable && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F0FBE8] border border-[#C8EEB8] font-sans text-[11px] font-medium text-[#3D7A1A]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#47B10A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                  Delivery available
                </span>
                {serviceability.estimatedDays > 0 && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#F7F7F7] border border-[#E1E1E1] font-sans text-[11px] text-[#626262]">
                    Est. by {formatDeliveryDateShort(estimatedDeliveryDate(serviceability.estimatedDays))}
                  </span>
                )}
                {serviceability.availablePaymentMethods.includes("cod") && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#F7F7F7] border border-[#E1E1E1] font-sans text-[11px] text-[#626262]">COD available</span>
                )}
              </div>
            )}
            {pincodeStatus === "unserviceable" && (
              <p className="mt-2 font-sans text-[12px] text-[#D93025]">
                Sorry, we don&apos;t deliver to this pincode yet.
              </p>
            )}
          </div>
          <div>
            <label className="block font-sans font-normal text-[13px] text-[#5D5D5D] mb-1.5">City</label>
            <input
              type="text" name="city" value={form.city}
              onChange={onChange} onBlur={onBlur}
              placeholder="Mumbai"
              className={inputCls(errors.city, touched.city)}
              autoComplete="address-level2"
            />
            <FieldError msg={touched.city ? errors.city : undefined} />
          </div>
        </div>

        {/* State */}
        <div>
          <label className="block font-sans font-normal text-[13px] text-[#5D5D5D] mb-1.5">State</label>
          <div className="relative">
            <select
              name="state" value={form.state}
              onChange={onChange} onBlur={onBlur}
              className={`${inputCls(errors.state, touched.state)} appearance-none pr-10 ${!form.state ? "text-[#909090]" : "text-[#3D3D3D]"}`}
            >
              <option value="" disabled>Select state / UT</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#909090" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <FieldError msg={touched.state ? errors.state : undefined} />
        </div>

        {/* Phone */}
        <div>
          <label className="block font-sans font-normal text-[13px] text-[#5D5D5D] mb-1.5">Phone Number</label>
          <div className="flex gap-2">
            <div className="flex items-center px-4 h-[52px] bg-white border border-[#E1E1E1] rounded-2xl font-sans text-[15px] text-[#3D3D3D] flex-shrink-0 select-none">
              +91
            </div>
            <input
              type="tel" name="phone" value={form.phone}
              onChange={onChange} onBlur={onBlur}
              placeholder="98765 43210" maxLength={10}
              className={`flex-1 ${inputCls(errors.phone, touched.phone)}`}
              autoComplete="tel-national" inputMode="numeric"
            />
          </div>
          <FieldError msg={touched.phone ? errors.phone : undefined} />
        </div>

        <button
          type="submit"
          className="w-full h-[52px] bg-black text-white font-sans font-medium text-[16px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200 mt-2"
          style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
        >
          Continue to Review →
        </button>
      </form>
    </div>
  );
}

/* ── Step 2: Review ───────────────────────────────────────── */
function ReviewStep({
  items, shippingForm, totals, onBack, onNext,
}: {
  items: CartItem[]; shippingForm: ShippingForm;
  totals: DisplayTotals;
  onBack: () => void; onNext: () => void;
}) {
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-sans font-medium text-[20px] text-black">Order Review</h2>

      {/* Items */}
      <div className="rounded-2xl border border-[#E1E1E1] overflow-hidden">
        <div className="bg-[#F7F7F7] px-5 py-3">
          <p className="font-sans font-medium text-[12px] text-[#626262] uppercase tracking-wider">
            Items ({totalQty})
          </p>
        </div>
        <div className="divide-y divide-[#F5F5F5]">
          {items.map((item) => (
            <div key={`${item.product.id}-${item.size}`} className="flex gap-4 px-5 py-4 items-center">
              <div className="relative w-[60px] h-[60px] flex-shrink-0 rounded-xl overflow-hidden bg-[#F9F9F9] border border-[#E1E1E1]">
                <Image src={item.product.images[0]} alt={item.product.name} fill className="object-contain p-1.5" sizes="60px" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans font-normal text-[15px] text-black">{item.product.name}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {item.size && <span className="font-sans text-[12px] text-[#909090]">Size: {item.size}</span>}
                  <span className="font-sans text-[12px] text-[#909090]">Qty: {item.quantity}</span>
                </div>
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="font-sans font-medium text-[15px] text-black">
                  ₹{(item.product.price * item.quantity).toLocaleString("en-IN")}
                </span>
                {item.product.originalPrice > item.product.price && (
                  <span className="font-sans text-[12px] text-[#AAAAAA] line-through">
                    ₹{(item.product.originalPrice * item.quantity).toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Price breakdown, all values come from Medusa serverTotals */}
      <div className="rounded-2xl border border-[#E1E1E1] overflow-hidden">
        <div className="bg-[#F7F7F7] px-5 py-3">
          <p className="font-sans font-medium text-[12px] text-[#626262] uppercase tracking-wider">Price Breakdown</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3 font-sans text-[14px]">
          <div className="flex justify-between">
            <span className="text-[#626262]">Subtotal</span>
            <span className="text-black">₹{totals.subtotal.toLocaleString("en-IN")}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-[#626262]">Discount</span>
              <span className="text-black">− ₹{totals.discount.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[#626262]">Tax (GST)</span>
            <span className="text-black">
              {totals.isEstimate ? "-" : `₹${totals.tax.toLocaleString("en-IN")}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#626262]">Delivery</span>
            {totals.isEstimate ? (
              <span className="text-black">-</span>
            ) : totals.delivery === 0 ? (
              <span className="font-medium" style={{ color: "#47B10A" }}>FREE</span>
            ) : (
              <span className="text-black">₹{totals.delivery}</span>
            )}
          </div>
          {totals.walletCredit > 0 && (
            <div className="flex justify-between">
              <span className="text-[#626262]">Wallet credit</span>
              <span className="font-medium" style={{ color: "#47B10A" }}>− {formatRupees(totals.walletCredit)}</span>
            </div>
          )}
          <div className="h-px bg-[#F0F0F0]" />
          <div className="flex justify-between">
            <span className="font-semibold text-black">Total Payable</span>
            <span className="font-semibold text-[18px] text-black">₹{totals.total.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      {/* Delivery address */}
      <div className="rounded-2xl border border-[#E1E1E1] overflow-hidden">
        <div className="bg-[#F7F7F7] px-5 py-3">
          <p className="font-sans font-medium text-[12px] text-[#626262] uppercase tracking-wider">Delivery Address</p>
        </div>
        <div className="px-5 py-4">
          <p className="font-sans font-medium text-[15px] text-black">{shippingForm.fullName}</p>
          <p className="font-sans font-normal text-[14px] text-[#626262] mt-1 leading-[22px]">
            {shippingForm.addressLine1}
            {shippingForm.addressLine2 && `, ${shippingForm.addressLine2}`}
            <br />
            {shippingForm.city}, {shippingForm.state} {shippingForm.pincode}
            <br />
            +91 {shippingForm.phone}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 h-[52px] border border-[#CFCFCF] text-black font-sans font-medium text-[16px] rounded-full hover:bg-[#F7F7F7] transition-colors duration-200"
        >
          ← Edit
        </button>
        <button
          onClick={onNext}
          className="flex-[2] h-[52px] bg-black text-white font-sans font-medium text-[16px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200"
          style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
        >
          Confirm &amp; Pay →
        </button>
      </div>
    </div>
  );
}

/* ── Step 3: Payment ──────────────────────────────────────── */
function PaymentStep({
  totals, shippingForm, paymentMethod, loading, razorpayError, serviceability,
  walletBalance, walletBusy, walletError, walletOnly,
  onSelectMethod, onToggleWallet, onBack, onPlaceOrder,
}: {
  totals: DisplayTotals; shippingForm: ShippingForm;
  paymentMethod: PaymentMethod | null; loading: boolean; razorpayError: string;
  serviceability: ServiceabilityResult | null;
  /** Null until the wallet is read; the panel only shows when there is credit. */
  walletBalance: number | null; walletBusy: boolean; walletError: string;
  /** True when wallet credit pays for the whole order, so no payment method is needed. */
  walletOnly: boolean;
  onSelectMethod: (m: PaymentMethod) => void;
  onToggleWallet: (on: boolean) => void;
  onBack: () => void; onPlaceOrder: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-sans font-medium text-[20px] text-black">Select Payment Method</h2>

      {/* Delivery estimate chip when serviceability is confirmed */}
      {serviceability?.serviceable && serviceability.estimatedDays > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F0FBE8] border border-[#C8EEB8] rounded-2xl">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#47B10A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
          <p className="font-sans text-[12px] text-[#3D7A1A]">
            Estimated delivery by <strong>{formatDeliveryDateShort(estimatedDeliveryDate(serviceability.estimatedDays))}</strong> to {shippingForm.pincode}
          </p>
        </div>
      )}

      {/* Wallet credit, only for customers who have some (or have it applied) */}
      {walletBalance !== null && (walletBalance > 0 || totals.walletCredit > 0) && (
        <WalletPanel
          balance={walletBalance}
          applied={totals.walletCredit}
          busy={walletBusy}
          error={walletError}
          onToggle={onToggleWallet}
        />
      )}

      {walletOnly && (
        <div className="flex items-start gap-3 p-4 bg-[#F7FFF4] border border-[#C8EEB8] rounded-2xl">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0" aria-hidden="true">
            <path d="M9 12l2 2 4-4" stroke="#47B10A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="9" stroke="#47B10A" strokeWidth="1.5" />
          </svg>
          <p className="font-sans font-normal text-[13px] text-[#3D7A1A] leading-[19px]">
            Your wallet credit covers this whole order. Nothing is left to pay.
          </p>
        </div>
      )}

      {!walletOnly && <div className="flex flex-col gap-3">
        {/* COD, hidden when courier doesn't support it for this pincode */}
        {(!serviceability || serviceability.availablePaymentMethods.includes("cod")) && <button
          onClick={() => onSelectMethod("cod")}
          className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-colors duration-150 w-full ${
            paymentMethod === "cod" ? "border-black bg-[#FAFAFA]" : "border-[#E1E1E1] hover:border-[#AAAAAA]"
          }`}
        >
          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentMethod === "cod" ? "border-black" : "border-[#CFCFCF]"}`}>
            {paymentMethod === "cod" && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
          </div>
          <div className="flex-1">
            <p className="font-sans font-medium text-[16px] text-black">Cash on Delivery</p>
            <p className="font-sans font-normal text-[13px] text-[#626262] mt-1">
              Pay in cash when your order arrives. No online transaction needed.
            </p>
          </div>
          <svg className="flex-shrink-0 mt-0.5" width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="#626262" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="3" stroke="#626262" strokeWidth="1.5" />
            <path d="M2 9h20" stroke="#626262" strokeWidth="1.5" />
          </svg>
        </button>}

        {/* Razorpay */}
        <button
          onClick={() => onSelectMethod("prepaid")}
          className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-colors duration-150 w-full ${
            paymentMethod === "prepaid" ? "border-black bg-[#FAFAFA]" : "border-[#E1E1E1] hover:border-[#AAAAAA]"
          }`}
        >
          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentMethod === "prepaid" ? "border-black" : "border-[#CFCFCF]"}`}>
            {paymentMethod === "prepaid" && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
          </div>
          <div className="flex-1">
            <p className="font-sans font-medium text-[16px] text-black">Prepaid via Razorpay</p>
            <p className="font-sans font-normal text-[13px] text-[#626262] mt-1">
              Pay securely via UPI, credit/debit card, net banking, or wallet.
            </p>
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              {["UPI", "Cards", "Net Banking", "Wallets"].map((m) => (
                <span key={m} className="px-2 py-0.5 bg-[#F0F0F0] rounded text-[11px] font-sans font-medium text-[#444]">{m}</span>
              ))}
            </div>
          </div>
          {/* Razorpay wordmark */}
          <div className="flex-shrink-0 mt-0.5 flex items-center justify-center w-8 h-8 rounded-full bg-[#072654]">
            <span className="text-white font-bold text-[11px]">R</span>
          </div>
        </button>
      </div>}

      {/* Security badge, shown when prepaid selected */}
      {!walletOnly && paymentMethod === "prepaid" && (
        <div className="flex items-start gap-3 p-4 bg-[#F7FFF4] border border-[#C8EEB8] rounded-2xl">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#47B10A" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" stroke="#47B10A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="font-sans font-normal text-[12px] text-[#3D7A1A] leading-[18px]">
            Payments are 256-bit SSL encrypted via Razorpay. Your card details are never stored on our servers.
          </p>
        </div>
      )}

      {/* No method selected error */}
      {!walletOnly && paymentMethod === null && (
        <p className="font-sans text-[13px] text-[#D93025]">Please select a payment method to continue.</p>
      )}

      {/* Razorpay load error */}
      {razorpayError && (
        <p className="font-sans text-[13px] text-[#D93025]">{razorpayError}</p>
      )}

      {/* Address summary chip */}
      <div className="flex items-center gap-2 p-3 bg-[#F7F7F7] rounded-2xl">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#626262" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <p className="font-sans font-normal text-[12px] text-[#626262] truncate">
          {shippingForm.fullName} · {shippingForm.city}, {shippingForm.state} {shippingForm.pincode}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 h-[52px] border border-[#CFCFCF] text-black font-sans font-medium text-[16px] rounded-full hover:bg-[#F7F7F7] disabled:opacity-40 transition-colors duration-200"
        >
          ← Back
        </button>
        <button
          onClick={onPlaceOrder}
          disabled={(!walletOnly && !paymentMethod) || loading}
          className="flex-[2] h-[52px] bg-black text-white font-sans font-medium text-[16px] rounded-full hover:bg-[#1a1a1a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2"
          style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : walletOnly || paymentMethod === "cod" ? (
            "Place Order"
          ) : (
            `Pay ₹${totals.total.toLocaleString("en-IN")}`
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Empty cart ───────────────────────────────────────────── */
function EmptyCartView() {
  return (
    <div className="max-w-screen-xl mx-auto px-6 py-24 flex flex-col items-center gap-6 text-center">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#CFCFCF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      <p className="font-sans font-normal text-[20px] text-[#909090]">Your cart is empty</p>
      <Link
        href="/products"
        className="px-8 py-[14px] bg-black text-white font-sans font-medium text-[16px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200"
      >
        Browse Products
      </Link>
    </div>
  );
}

/* ── Root component ───────────────────────────────────────── */
export function CheckoutClient() {
  const router = useRouter();
  const { user } = useUser();

  const items = useCartStore((s) => s.items);
  const cartId = useCartStore((s) => s.cartId);
  const serverTotals = useCartStore((s) => s.serverTotals);
  const clearCart = useCartStore((s) => s.clearCart);

  // Server-authoritative totals from Medusa. Falls back to a client-side estimate
  // (no tax/delivery) only when the cart has not yet synced with the backend.
  //
  // Once the customer has toggled wallet credit, Medusa's answer to that call
  // (which includes the credit) takes over, since the cart store's own totals
  // do not know about the wallet.
  const [walletTotals, setWalletTotals] = useState<WalletCartTotals | null>(null);

  const displayTotals = useMemo<DisplayTotals>(() => {
    if (walletTotals) {
      return {
        subtotal: walletTotals.subtotal,
        tax: walletTotals.taxTotal,
        delivery: walletTotals.shippingTotal,
        discount: walletTotals.discountTotal,
        walletCredit: walletTotals.walletCredit,
        total: walletTotals.total,
        isEstimate: false,
      };
    }
    if (serverTotals) {
      return {
        subtotal: serverTotals.subtotal,
        tax: serverTotals.taxTotal,
        delivery: serverTotals.shippingTotal,
        discount: serverTotals.discountTotal,
        walletCredit: 0,
        total: serverTotals.total,
        isEstimate: false,
      };
    }
    const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    return { subtotal, tax: 0, delivery: 0, discount: 0, walletCredit: 0, total: subtotal, isEstimate: true };
  }, [walletTotals, serverTotals, items]);

  /* Step machine */
  const [step, setStep] = useState<CheckoutStep>(1);

  /* Shipping form */
  const [form, setForm] = useState<ShippingForm>({
    fullName: "", addressLine1: "", addressLine2: "",
    city: "", state: "", pincode: "", phone: "",
  });
  const [touched, setTouched] = useState<TouchedFields>({});
  const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>("idle");

  /* Serviceability */
  const [serviceability, setServiceability] = useState<ServiceabilityResult | null>(null);

  /* Payment */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [razorpayError, setRazorpayError] = useState("");

  /* Razorpay script readiness, set true by Script's onLoad callback */
  const [razorpayReady, setRazorpayReady] = useState(false);

  /* Wallet credit. `walletBalance` is null until it has been read. */
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");

  // Credit covers the whole order: no payment method is needed.
  const walletOnly = displayTotals.walletCredit > 0 && displayTotals.total <= 0 && !displayTotals.isEstimate;

  /* Read the wallet, and clear any credit left on the cart from an earlier
     visit to checkout, so what is shown always matches what will be charged. */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/wallet");
        const data = (await res.json()) as { balance?: number };
        if (!cancelled) setWalletBalance(typeof data.balance === "number" ? data.balance : 0);
      } catch {
        if (!cancelled) setWalletBalance(0);
      }

      if (!cartId) return;
      try {
        const res = await fetch("/api/wallet/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId, apply: false }),
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { totals: WalletCartTotals };
          setWalletTotals(data.totals);
        }
      } catch {
        // Not fatal: the server clears unused credit again when payment starts.
      }
    })();

    return () => { cancelled = true; };
  }, [user, cartId]);

  /* Switch wallet credit on or off for this cart. */
  async function handleToggleWallet(on: boolean) {
    if (!cartId || walletBusy) return;
    setWalletBusy(true);
    setWalletError("");
    try {
      const res = await fetch("/api/wallet/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId, apply: on }),
      });
      const data = (await res.json()) as {
        totals?: WalletCartTotals; walletBalance?: number; message?: string;
      };
      if (!res.ok || !data.totals) {
        setWalletError(data.message ?? "Could not update your wallet credit. Please try again.");
        return;
      }
      setWalletTotals(data.totals);
      if (on && typeof data.walletBalance === "number") setWalletBalance(data.walletBalance);
    } catch (err) {
      console.error("[EYRA/wallet] toggle failed:", err);
      setWalletError("Could not update your wallet credit. Please try again.");
    } finally {
      setWalletBusy(false);
    }
  }

  /* Prefill Clerk user data into shipping form on first load */
  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || [user.firstName, user.lastName].filter(Boolean).join(" "),
      phone: prev.phone || (user.phoneNumbers?.[0]?.phoneNumber?.replace(/^\+91/, "") ?? ""),
    }));
  }, [user]);

  /* Pincode serviceability check, routed through our server to avoid
     direct third-party browser calls and validate against real courier routes. */
  useEffect(() => {
    if (!/^\d{6}$/.test(form.pincode)) {
      setPincodeStatus("idle");
      setServiceability(null);
      return;
    }
    setPincodeStatus("loading");
    setServiceability(null);
    const controller = new AbortController();
    fetch("/api/shipping/serviceability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pincode: form.pincode }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: ServiceabilityResult) => {
        setServiceability(data);
        setPincodeStatus(data.serviceable ? "valid" : "unserviceable");
        // Reset selected payment method if it's no longer available for this pincode.
        setPaymentMethod((prev) =>
          prev && !data.availablePaymentMethods.includes(prev) ? null : prev
        );
      })
      .catch((err: unknown) => {
        // An abort is this effect's own cleanup firing because the pincode
        // changed, not a failed check. The replacement request has already
        // set "loading" by the time this rejection lands, so reporting it
        // would knock the newer check back to "idle" and flash the field
        // between states while the user is still typing.
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("[EYRA/serviceability] Pincode check failed for", form.pincode, ":", err);
        setPincodeStatus("idle");
      });
    return () => controller.abort();
  }, [form.pincode]);

  /* Form handlers */
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  }

  const shippingErrors = validateShipping(form);

  function handleShippingNext() {
    const allTouched: TouchedFields = {
      fullName: true, addressLine1: true, city: true,
      state: true, pincode: true, phone: true,
    };
    setTouched(allTouched);
    if (Object.keys(shippingErrors).length === 0) setStep(2);
  }

  /* Wallet-only order: wallet credit pays for everything, nothing is charged. */
  async function handleWalletOrder() {
    if (!cartId) {
      setRazorpayError("Your cart session has expired. Please refresh the page and try again.");
      setPayLoading(false);
      return;
    }

    const oid = generateOrderId();
    const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? "";
    const shippingAddress = {
      fullName: form.fullName,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      phone: form.phone,
    };

    let confirmedOrderId: string | null = null;
    let failure = "";
    try {
      const res = await fetch("/api/wallet/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId, email: clerkEmail, shippingAddress }),
      });
      const data = await res.json() as { orderId?: string | null; error?: string; message?: string };
      confirmedOrderId = data.orderId ?? null;
      if (!confirmedOrderId) failure = data.message ?? "";
    } catch (err) {
      console.error("[EYRA/wallet] wallet order request failed:", err);
    }

    if (!confirmedOrderId) {
      setRazorpayError(failure || "Could not place your order. Please try again or contact support.");
      setPayLoading(false);
      return;
    }

    // Fully paid, so the courier treats it as prepaid. The declared value is
    // the full order value, not the (zero) amount left to pay.
    let awbCode = "";
    let courierName = "";
    try {
      const sRes = await fetch("/api/shipping/create-shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medusaOrderId: confirmedOrderId,
          eyraOrderRef: oid,
          paymentMethod: "prepaid",
          shipping: { ...shippingAddress, email: clerkEmail },
          items: items.map((i) => ({
            name: i.product.name,
            sku: i.product.id,
            type: i.product.type,
            quantity: i.quantity,
            price: i.product.price,
          })),
          subtotal: displayTotals.total + displayTotals.walletCredit,
        }),
      });
      if (sRes.ok) {
        const sData = await sRes.json() as { awbCode?: string | null; courierName?: string | null };
        awbCode = sData.awbCode ?? "";
        courierName = sData.courierName ?? "";
      }
    } catch (err) {
      console.error("[EYRA/shipment] Wallet order shipment creation failed for order", confirmedOrderId, ":", err);
    }

    clearCart();
    const params = new URLSearchParams({
      orderId: confirmedOrderId,
      method: "wallet",
      wallet: String(displayTotals.walletCredit),
    });
    if (awbCode) params.set("awb", awbCode);
    if (courierName) params.set("courier", courierName);
    router.push(`/orders/success?${params.toString()}`);
  }

  /* Place order handler */
  async function handlePlaceOrder() {
    if (!paymentMethod && !walletOnly) return;
    setPayLoading(true);
    setRazorpayError("");

    if (walletOnly) {
      await handleWalletOrder();
      return;
    }

    // Whether the customer chose to spend wallet credit on this order.
    const useWallet = displayTotals.walletCredit > 0;

    /* ── COD ─────────────────────────────────────────────────── */
    if (paymentMethod === "cod") {
      if (!cartId) {
        console.error("[EYRA] COD checkout attempted with no active cart ID.");
        setRazorpayError("Your cart session has expired. Please refresh the page and try again.");
        setPayLoading(false);
        return;
      }

      const oid = generateOrderId();
      const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? "";
      const shippingAddress = {
        fullName: form.fullName,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        phone: form.phone,
      };

      // Turn the cart into a real Medusa order before anything else, a COD
      // "order" with no backend record means no inventory tracking and no
      // order history entry.
      let confirmedOrderId: string | null = null;
      let codFailure = "";
      try {
        const oRes = await fetch("/api/cod/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId, email: clerkEmail, shippingAddress, useWallet }),
        });
        const oData = await oRes.json() as { orderId?: string | null; message?: string };
        confirmedOrderId = oData.orderId ?? null;
        codFailure = oData.message ?? "";
      } catch (err) {
        console.error("[EYRA] COD order completion request failed:", err);
      }

      if (!confirmedOrderId) {
        console.error("[EYRA] COD order completion failed for cart", cartId);
        setRazorpayError(codFailure || "Could not place your order. Please try again or contact support.");
        setPayLoading(false);
        return;
      }

      let awbCode = "";
      let courierName = "";
      try {
        const sRes = await fetch("/api/shipping/create-shipment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medusaOrderId: confirmedOrderId,
            eyraOrderRef: oid,
            paymentMethod: "cod",
            shipping: { ...shippingAddress, email: clerkEmail },
            items: items.map((i) => ({
              name: i.product.name,
              sku: i.product.id,
              type: i.product.type,
              quantity: i.quantity,
              price: i.product.price,
            })),
            subtotal: displayTotals.total,
          }),
        });
        if (sRes.ok) {
          const sData = await sRes.json() as { awbCode?: string | null; courierName?: string | null };
          awbCode = sData.awbCode ?? "";
          courierName = sData.courierName ?? "";
        }
      } catch (err) {
        console.error("[EYRA/shipment] COD shipment creation failed for order", confirmedOrderId, ":", err);
      }
      clearCart();
      const params = new URLSearchParams({ orderId: confirmedOrderId, method: "cod" });
      if (useWallet) params.set("wallet", String(displayTotals.walletCredit));
      if (awbCode) params.set("awb", awbCode);
      if (courierName) params.set("courier", courierName);
      router.push(`/orders/success?${params.toString()}`);
      return;
    }

    /* ── Prepaid via Razorpay ───────────────────────────────────── */

    // Verify the Script has loaded before proceeding
    if (!razorpayReady || !window.Razorpay) {
      setRazorpayError("Payment gateway is still loading. Please wait a moment and try again.");
      setPayLoading(false);
      return;
    }

    const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!key) {
      setRazorpayError("Payment gateway is not configured. Please use Cash on Delivery or contact support.");
      setPayLoading(false);
      return;
    }

    // A Medusa cart session is required to create a verified Razorpay order.
    if (!cartId) {
      console.error("[EYRA Security] Prepaid checkout attempted with no active cart ID.");
      setRazorpayError("Your cart session has expired. Please refresh the page and try again.");
      setPayLoading(false);
      return;
    }

    const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? "";
    const shippingAddress = {
      fullName: form.fullName,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      phone: form.phone,
    };

    // Obtain a server-generated Razorpay order_id from Medusa.
    // This token is what makes HMAC signature verification possible,
    // Razorpay includes razorpay_signature in the response only when order_id is present.
    let razorpayOrderId: string | null = null;
    // What Razorpay will charge, as worked out by the server after wallet credit.
    let razorpayAmount: number | null = null;
    try {
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId, email: clerkEmail, shippingAddress, useWallet }),
      });
      if (res.ok) {
        const data = await res.json() as {
          razorpayOrderId?: string | null; amount?: number | null; error?: string; message?: string;
        };
        razorpayOrderId = data.razorpayOrderId ?? null;
        razorpayAmount = typeof data.amount === "number" ? data.amount : null;
        if (data.error === "wallet_unavailable" || data.error === "fully_covered_by_wallet") {
          setRazorpayError(
            data.error === "fully_covered_by_wallet"
              ? "Your wallet credit now covers this order. Please place the order again."
              : data.message || "Could not apply your wallet credit. Please try again."
          );
          setPayLoading(false);
          return;
        }
      } else {
        console.error(`[EYRA Security] create-order API returned ${res.status}, cannot proceed.`);
      }
    } catch (err) {
      console.error("[EYRA Security] create-order request failed:", err);
      setRazorpayError("Payment initialisation failed. Please try again or use Cash on Delivery.");
      setPayLoading(false);
      return;
    }

    // Hard block: without a server-generated order_id, Razorpay omits razorpay_signature
    // from the payment response, which silently skips HMAC verification and allows a
    // spoofed payment_id to be accepted as a completed order.
    if (!razorpayOrderId) {
      console.error(
        "[EYRA Security] TRANSACTION BLOCKED. Razorpay order_id is null. " +
        "The Razorpay provider is likely not registered in Medusa. " +
        `Cart: ${cartId}, Amount: ₹${displayTotals.total}. ` +
        "Opening the checkout modal without order_id would bypass cryptographic signature verification."
      );
      setRazorpayError(
        "Payment Gateway configuration mismatch. Transaction halted. Please use Cash on Delivery or contact support."
      );
      setPayLoading(false);
      return;
    }

    const oid = generateOrderId();

    // Clerk user data for prefill, supplements the shipping form
    const clerkName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

    const rzpOptions: RazorpayOptions = {
      key,
      // paise, from the server's own total (net of any wallet credit)
      amount: Math.round((razorpayAmount ?? displayTotals.total) * 100),
      currency: "INR",
      name: "EYRA",
      description: "Sterling silver jewellery order",
      order_id: razorpayOrderId, // guaranteed non-null, hard-blocked above
      prefill: {
        name: form.fullName || clerkName,
        email: clerkEmail,
        contact: `+91${form.phone}`,
      },
      notes: {
        order_ref: oid,
        address: `${form.addressLine1}, ${form.city}, ${form.state} ${form.pincode}`,
        // Fallback cart reference for /api/razorpay/webhook when the
        // server-side mapping is unavailable (no Upstash configured). Treated
        // as untrusted there, it is amount-checked before completing.
        medusa_cart_id: cartId,
      },
      theme: { color: "#000000" },
      async handler(response: RazorpayPaymentResponse) {
        // order_id was sent to Razorpay, so the response must carry both
        // razorpay_order_id and razorpay_signature. A missing signature here
        // means the response was tampered with before reaching this handler.
        if (!response.razorpay_order_id || !response.razorpay_signature) {
          console.error(
            "[EYRA Security] Payment response is missing order_id or signature. " +
            "This may indicate a tampered callback. " +
            `payment_id: ${response.razorpay_payment_id}`
          );
          setRazorpayError("Payment verification failed. Please contact support with your payment ID.");
          setPayLoading(false);
          return;
        }

        // Server-side HMAC signature verification + Medusa order creation.
        let confirmedOrderId = oid;
        try {
          const vRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              medusa_cart_id: cartId,
            }),
          });
          if (!vRes.ok) {
            setRazorpayError("Payment verification failed. Please contact support with your payment ID.");
            setPayLoading(false);
            return;
          }
          const vData = await vRes.json() as { verified: boolean; medusa_order_id?: string | null };
          if (vData.medusa_order_id) confirmedOrderId = vData.medusa_order_id;
        } catch (err) {
          console.error("[EYRA/razorpay] Verify request failed for payment", response.razorpay_payment_id, ":", err);
          setRazorpayError("Could not verify payment. Please contact support.");
          setPayLoading(false);
          return;
        }

        // Create Shiprocket shipment now that payment is captured.
        let awbCode = "";
        let courierName = "";
        try {
          const sRes = await fetch("/api/shipping/create-shipment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              medusaOrderId: confirmedOrderId,
              eyraOrderRef: oid,
              paymentMethod: "prepaid",
              shipping: { ...shippingAddress, email: clerkEmail },
              items: items.map((i) => ({
                name: i.product.name,
                sku: i.product.id,
                type: i.product.type,
                quantity: i.quantity,
                price: i.product.price,
              })),
              // Declared value is the full order, wallet credit included.
              subtotal: displayTotals.total + displayTotals.walletCredit,
            }),
          });
          if (sRes.ok) {
            const sData = await sRes.json() as { awbCode?: string | null; courierName?: string | null };
            awbCode = sData.awbCode ?? "";
            courierName = sData.courierName ?? "";
          }
        } catch (err) {
          console.error("[EYRA/shipment] Prepaid shipment creation failed for order", oid, "(medusa:", confirmedOrderId, "):", err);
        }

        clearCart();
        const params = new URLSearchParams({
          orderId: confirmedOrderId,
          method: "prepaid",
          payment_id: response.razorpay_payment_id,
        });
        if (useWallet) params.set("wallet", String(displayTotals.walletCredit));
        if (awbCode) params.set("awb", awbCode);
        if (courierName) params.set("courier", courierName);
        router.push(`/orders/success?${params.toString()}`);
      },
      modal: {
        ondismiss() {
          setPayLoading(false);
        },
      },
    };

    const rzp = new window.Razorpay(rzpOptions);
    rzp.open();
  }

  /* Empty cart guard */
  if (items.length === 0) return <EmptyCartView />;

  return (
    <>
      {/* Razorpay SDK, loaded lazily, fires setRazorpayReady on success */}
      <Script
        id="razorpay-checkout"
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setRazorpayReady(true)}
        onError={() =>
          setRazorpayError(
            "Could not load payment gateway. Please check your connection."
          )
        }
      />

      <div className="max-w-screen-xl mx-auto px-6 lg:px-10 py-10 pb-20">
        <StepIndicator current={step} />

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left: active step */}
          <div className="flex-1 min-w-0">
            {step === 1 && (
              <ShippingStep
                form={form}
                errors={shippingErrors}
                touched={touched}
                pincodeStatus={pincodeStatus}
                serviceability={serviceability}
                onChange={handleChange}
                onBlur={handleBlur}
                onNext={handleShippingNext}
              />
            )}
            {step === 2 && (
              <ReviewStep
                items={items}
                shippingForm={form}
                totals={displayTotals}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <PaymentStep
                totals={displayTotals}
                shippingForm={form}
                paymentMethod={paymentMethod}
                loading={payLoading}
                razorpayError={razorpayError}
                serviceability={serviceability}
                walletBalance={walletBalance}
                walletBusy={walletBusy}
                walletError={walletError}
                walletOnly={walletOnly}
                onSelectMethod={setPaymentMethod}
                onToggleWallet={handleToggleWallet}
                onBack={() => setStep(2)}
                onPlaceOrder={handlePlaceOrder}
              />
            )}
          </div>

          {/* Right: sticky order summary */}
          <OrderSidebar
            items={items}
            totals={displayTotals}
          />
        </div>
      </div>
    </>
  );
}
