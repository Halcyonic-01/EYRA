"use client";

import { UserProfile } from "@clerk/nextjs";
import Link from "next/link";

/*
  Clerk's `appearance` prop accepts an object with:
    - variables   → CSS custom properties forwarded into Clerk's component stylesheet
    - elements    → per-element className overrides (merged with Clerk's defaults)

  We map directly to the EYRA design-token palette defined in globals.css:
    jet #020202 · charcoal #3d3d3d · cloud #ebebeb · ivory #f9f9f9
    Poppins (--font-poppins) · rounded-2xl (16px) · rounded-full (100px)
*/
const clerkAppearance = {
  variables: {
    colorPrimary: "#020202",
    colorTextOnPrimaryBackground: "#ffffff",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#3d3d3d",
    colorText: "#020202",
    colorTextSecondary: "#626262",
    colorNeutral: "#909090",
    colorDanger: "#D93025",
    fontFamily: "var(--font-poppins), sans-serif",
    fontSize: "14px",
    borderRadius: "16px",
    spacingUnit: "1rem",
  },
  elements: {
    // Root card, borderless, no shadow, matches page bg
    card: "shadow-none border-0 bg-transparent p-0",
    // Navbar and header inside the profile panel
    navbar: "border-r border-[#F0F0F0] bg-[#F9F9F9]",
    navbarButton:
      "font-sans font-normal text-[13px] text-[#626262] hover:text-black hover:bg-[#F0F0F0] rounded-xl transition-colors duration-150",
    navbarButtonActive: "text-black bg-[#EBEBEB] font-medium",
    // Page header
    headerTitle: "font-sans font-medium text-[18px] text-black",
    headerSubtitle: "font-sans font-normal text-[13px] text-[#909090]",
    // Form inputs
    formFieldInput:
      "border border-[#E1E1E1] focus:border-[#AAAAAA] rounded-2xl bg-white font-sans text-[14px] text-[#3d3d3d] outline-none transition-colors duration-150 h-[44px] px-4",
    formFieldLabel: "font-sans font-normal text-[13px] text-[#5D5D5D]",
    formFieldHintText: "font-sans text-[12px] text-[#909090]",
    formFieldErrorText: "font-sans text-[12px] text-[#D93025]",
    // Primary action buttons
    formButtonPrimary:
      "bg-black text-white font-sans font-medium text-[14px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200 h-[44px] px-8 shadow-none",
    // Secondary / destructive buttons
    formButtonReset:
      "border border-[#CFCFCF] text-black font-sans font-medium text-[14px] rounded-full hover:bg-[#F7F7F7] transition-colors duration-200 h-[44px] px-6 bg-white shadow-none",
    // Badge / chip components
    badge: "font-sans text-[11px] rounded-full",
    // Section dividers
    dividerLine: "bg-[#F0F0F0]",
    dividerText: "font-sans text-[12px] text-[#909090]",
    // Avatar
    avatarBox: "rounded-2xl",
    // Profile image upload
    fileDropAreaBox: "border-2 border-dashed border-[#E1E1E1] rounded-2xl",
  },
};

export default function AccountPage() {
  return (
    <div className="max-w-screen-lg mx-auto px-6 lg:px-10 py-12">

      {/* Header */}
      <div className="mb-8">
        <p className="font-sans font-light tracking-[0.3em] uppercase text-[0.78rem] text-[#909090] mb-1">
          Account
        </p>
        <h1 className="font-sans font-medium text-[26px] text-black">Profile Settings</h1>
      </div>

      {/* Quick nav */}
      <div className="flex gap-4 mb-8">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E1E1E1] font-sans text-[13px] text-[#626262] hover:border-[#AAAAAA] hover:text-black transition-colors duration-200"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          My Orders
        </Link>
      </div>

      {/* Clerk UserProfile panel. The route is a catch-all so its sub-pages (e.g. /account/security) resolve. */}
      <div className="rounded-2xl border border-[#E1E1E1] overflow-hidden bg-white">
        <UserProfile routing="path" path="/account" appearance={clerkAppearance} />
      </div>
    </div>
  );
}
