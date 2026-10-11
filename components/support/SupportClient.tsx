"use client";

import { useState } from "react";

/* ── Types ────────────────────────────────────────────────── */
interface FormFields {
  name: string;
  email: string;
  category: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  category?: string;
  message?: string;
}

type TouchedFields = Partial<Record<keyof FormFields, boolean>>;

/**
 * Support copy that quotes policy numbers. Passed in from the server page:
 * only NEXT_PUBLIC_ env vars reach the browser, so reading storeConfig in a
 * client component would show defaults even when an override is set.
 */
export interface SupportCopy {
  returnDays: number;
  exchangeDays: number;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  freeShippingAbove: number;
  warrantyMonths: number;
  supportEmail: string;
  ordersEmail: string;
}

/* ── FAQ data ─────────────────────────────────────────────── */
function buildFaqItems(c: SupportCopy) {
  return [
  {
    q: "What materials are your jewellery made from?",
    a: "All EYRA pieces are crafted from 925 sterling silver, which is 92.5% pure silver alloyed with copper for durability. Select pieces feature 18K gold vermeil or rhodium plating for enhanced finish and longevity.",
  },
  {
    q: "How long does shipping take?",
    a: `Each piece is made to order and crafted within 7 to 10 business days. Standard shipping takes a further ${c.deliveryDaysMin} to ${c.deliveryDaysMax} working days and is free on prepaid orders above ₹${c.freeShippingAbove.toLocaleString("en-IN")}.`,
  },
  {
    q: "What is your return and exchange policy?",
    a: `We accept returns within ${c.returnDays} days of delivery, and exchanges within ${c.exchangeDays} days, for unworn, undamaged items in original packaging. Customised or engraved pieces are non-returnable. Approved returns and exchanges are paid back as EYRA wallet credit, which you can use on your next order. Raise a return request via your account or email ${c.ordersEmail}.`,
  },
  {
    q: "How do I care for my silver jewellery?",
    a: "Store pieces in the provided anti-tarnish pouch when not wearing. Avoid contact with perfumes, lotions, and chlorinated water. Clean gently with a soft silver polishing cloth to restore shine.",
  },
  {
    q: "Do you offer customisation or engraving?",
    a: `Yes! Many of our pieces can be personalised with names, initials, or short messages. Look for the 'Customise' option on individual product pages, or email us at ${c.supportEmail} with your request.`,
  },
  {
    q: "Is there a warranty on EYRA products?",
    a: `All EYRA products come with a ${c.warrantyMonths}-month warranty against manufacturing defects. This covers issues such as broken clasps, stone settings falling out, or plating defects under normal wear conditions.`,
  },
  ];
}

/* ── Validation ───────────────────────────────────────────── */
function validate(fields: FormFields): FormErrors {
  const errors: FormErrors = {};
  if (!fields.name.trim()) {
    errors.name = "Name is required.";
  } else if (fields.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  }
  if (!fields.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }
  if (!fields.category) {
    errors.category = "Please select a category.";
  }
  if (!fields.message.trim()) {
    errors.message = "Message is required.";
  } else if (fields.message.trim().length < 20) {
    errors.message = `Message must be at least 20 characters (${fields.message.trim().length}/20).`;
  }
  return errors;
}

/* ── Field wrapper ────────────────────────────────────────── */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-[13px] text-[#D93025] flex items-center gap-1">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="#D93025" strokeWidth="2" />
        <path d="M12 7v5M12 16.5v.5" stroke="#D93025" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {message}
    </p>
  );
}

function inputClass(error?: string, touched?: boolean) {
  const base =
    "w-full px-4 h-[52px] bg-white text-[#3D3D3D] text-[16px] placeholder:text-[#909090] rounded-2xl outline-none transition-colors duration-150";
  if (touched && error) return `${base} border border-[#D93025] focus:border-[#D93025]`;
  return `${base} border border-[#E1E1E1] focus:border-[#AAAAAA]`;
}

/* ── Accordion item ───────────────────────────────────────── */
function AccordionItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[#E8E8E8] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
        aria-expanded={open}
      >
        <span
          className={`font-sans text-[16px] leading-[24px] transition-colors duration-150 ${
            open ? "text-[#000000] font-medium" : "text-[#3D3D3D] font-normal"
          }`}
        >
          {question}
        </span>
        <span
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 ${
            open ? "bg-black" : "bg-[#F2F2F2] group-hover:bg-[#E8E8E8]"
          }`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={open ? "#FFFFFF" : "#3D3D3D"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[200px] opacity-100 pb-5" : "max-h-0 opacity-0"
        }`}
      >
        <p className="font-sans font-normal text-[15px] leading-[24px] text-[#6A6A6A]">
          {answer}
        </p>
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────── */
export function SupportClient({ copy }: { copy: SupportCopy }) {
  const FAQ_ITEMS = buildFaqItems(copy);
  /* Form state */
  const [fields, setFields] = useState<FormFields>({
    name: "",
    email: "",
    category: "",
    message: "",
  });
  const [touched, setTouched] = useState<TouchedFields>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  /* Accordion state */
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const errors = validate(fields);
  const isValid = Object.keys(errors).length === 0;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, category: true, message: true });
    if (!isValid) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json() as { error?: string };
        setSubmitError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setFields({ name: "", email: "", category: "", message: "" });
    setTouched({});
    setSubmitted(false);
    setSubmitError("");
  }

  return (
    <>
      {/* ── Hero / Form section ──────────────────────────── */}
      <section className="bg-[#F7F7F7] py-16">
        <div className="max-w-[1148px] mx-auto px-6">
          <div className="flex flex-col items-center gap-4 mb-10">
            <h1 className="font-sans font-medium text-[24px] leading-[36px] text-[#000000] text-center">
              How Can We Help You?
            </h1>
            <p className="font-sans font-normal text-[20px] leading-[30px] text-[#555555] text-center max-w-[861px]">
              We&apos;re here to assist you with orders, shipping, returns, jewellery care,
              payments, and anything else you need.
            </p>
          </div>

          {/* Contact form */}
          <div className="max-w-[480px] mx-auto">
            {submitted ? (
              <div className="flex flex-col items-center gap-6 py-8">
                <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-sans font-medium text-[18px] text-[#000000]">
                    Request Submitted!
                  </p>
                  <p className="font-sans font-normal text-[15px] text-[#6A6A6A] mt-1">
                    We&apos;ll get back to you within 24 hours.
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="font-sans font-normal text-[15px] text-[#000000] underline underline-offset-4"
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                {/* Name */}
                <div>
                  <input
                    type="text"
                    name="name"
                    value={fields.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Your name"
                    className={inputClass(errors.name, touched.name)}
                    autoComplete="name"
                  />
                  <FieldError message={touched.name ? errors.name : undefined} />
                </div>

                {/* Email */}
                <div>
                  <input
                    type="email"
                    name="email"
                    value={fields.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Email address"
                    className={inputClass(errors.email, touched.email)}
                    autoComplete="email"
                  />
                  <FieldError message={touched.email ? errors.email : undefined} />
                </div>

                {/* Category */}
                <div>
                  <div className="relative">
                    <select
                      name="category"
                      value={fields.category}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`${inputClass(errors.category, touched.category)} appearance-none pr-10 ${
                        !fields.category ? "text-[#909090]" : "text-[#3D3D3D]"
                      }`}
                    >
                      <option value="" disabled>
                        Select a topic
                      </option>
                      <option value="order">Order & Shipping</option>
                      <option value="return">Returns & Exchanges</option>
                      <option value="product">Product Query</option>
                      <option value="payment">Payments & Billing</option>
                      <option value="custom">Customisation</option>
                      <option value="other">Other</option>
                    </select>
                    <svg
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#909090"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                  <FieldError message={touched.category ? errors.category : undefined} />
                </div>

                {/* Message */}
                <div>
                  <textarea
                    name="message"
                    value={fields.message}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Message"
                    rows={4}
                    className={`${inputClass(errors.message, touched.message)} !h-auto py-3 resize-none`}
                  />
                  <div className="flex items-start justify-between mt-1.5">
                    <FieldError message={touched.message ? errors.message : undefined} />
                    <span
                      className={`text-[12px] ml-auto flex-shrink-0 ${
                        fields.message.trim().length >= 20 ? "text-[#909090]" : "text-[#BBBBBB]"
                      }`}
                    >
                      {fields.message.trim().length}/20
                    </span>
                  </div>
                </div>

                {/* Server-side error */}
                {submitError && (
                  <div className="flex items-start gap-2 p-3.5 bg-[#FFF0F0] border border-[#FECACA] rounded-2xl">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="#D93025" strokeWidth="2" />
                      <path d="M12 7v5M12 16.5v.5" stroke="#D93025" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <p className="font-sans text-[13px] text-[#B91C1C] leading-[18px]">{submitError}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-[52px] bg-black text-white font-sans font-medium text-[18px] leading-[20px] rounded-full shadow-[inset_0px_6px_10px_rgba(211,211,211,0.3)] hover:bg-[#1a1a1a] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Contact cards ───────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-[756px] mx-auto px-6">
          <div className="flex flex-col sm:flex-row">
            {/* Email */}
            <div className="flex-1 flex flex-col items-center gap-1 p-6 border border-[#D8D8D8]">
              <div className="w-[54px] h-[54px] rounded-full bg-[#F9F9F9] flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2" stroke="#000" strokeWidth="1.5" />
                  <path d="M2 7l10 7 10-7" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="font-sans font-normal text-[16px] leading-[24px] text-[#6A6A6A] text-center mt-1">
                Email Support
              </span>
              <span className="font-sans font-normal text-[20px] leading-[30px] text-[#000000] text-center">
                admin@eyra.org.in
              </span>
            </div>

            {/* Call */}
            <div className="flex-1 flex flex-col items-center gap-1 p-6 border-y border-[#D8D8D8] sm:border-x-0 sm:border-y sm:border-t sm:border-b">
              <div className="w-[54px] h-[54px] rounded-full bg-[#F9F9F9] flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C9.6 21 3 14.4 3 6c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="font-sans font-normal text-[16px] leading-[24px] text-[#6A6A6A] text-center mt-1">
                Call Us
              </span>
              <span className="font-sans font-normal text-[20px] leading-[30px] text-[#000000] text-center">
                +91 87927 67878
              </span>
            </div>

            {/* Availability */}
            <div className="flex-1 flex flex-col items-center gap-1 p-6 border border-[#D8D8D8]">
              <div className="w-[54px] h-[54px] rounded-full bg-[#F9F9F9] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="#000" strokeWidth="1.5" />
                  <path d="M12 6v6l4 2" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="font-sans font-normal text-[16px] leading-[24px] text-[#6A6A6A] text-center mt-1">
                Availability
              </span>
              <span className="font-sans font-normal text-[20px] leading-[30px] text-[#000000] text-center">
                9AM &ndash; 8PM
              </span>
              <span className="font-sans font-normal text-[13px] text-[#909090] text-center">
                All Days
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ accordion ───────────────────────────────── */}
      <section className="py-16 bg-white border-t border-[#F0F0F0]">
        <div className="max-w-[760px] mx-auto px-6">
          <div className="flex flex-col items-center gap-3 mb-10">
            <h2 className="font-sans font-medium text-[24px] leading-[36px] text-[#000000] text-center">
              Frequently Asked Questions
            </h2>
            <p className="font-sans font-normal text-[16px] leading-[24px] text-[#6A6A6A] text-center">
              Quick answers to the questions we hear most.
            </p>
          </div>

          <div className="border-t border-[#E8E8E8]">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={i}
                question={item.q}
                answer={item.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>

          <p className="text-center font-sans font-normal text-[15px] text-[#6A6A6A] mt-10">
            Still have questions?{" "}
            <a href="mailto:admin@eyra.org.in" className="text-black underline underline-offset-4 hover:text-[#555555] transition-colors">
              Email us directly
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
