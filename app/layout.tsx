import type { Metadata } from "next";
import { Poppins, Cormorant_Garamond } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { getCurrentUser } from "@/lib/current-user";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CartSyncBanner } from "@/components/layout/CartSyncBanner";
import { HeroSection } from "@/components/home/HeroSection";
import { syncMedusaCustomer } from "@/lib/medusa-customer";
import { storeConfig } from "@/config/storeConfig";

/* Poppins, UI / body font (replaces Inter; matches Figma Poppins usage) */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  display: "swap",
  variable: "--font-poppins",
});

/* Cormorant Garamond, display / wordmark font (closest Google Fonts
   equivalent to Charlotte Veronica used in the Figma logo) */
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: {
    default: "EYRA Silver Jewelry",
    template: "%s | EYRA",
  },
  description:
    "Premium sterling silver jewelry, crafted for a bold generation.",
  openGraph: {
    siteName: "EYRA",
    locale: "en_IN",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Provision or re-bind the Medusa customer profile for authenticated users.
  // Short-circuits on repeat visits once publicMetadata.medusaCustomerId is set.
  let user = null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    // Treat an unreachable Clerk as signed out so the shop still loads.
    console.error("[layout] could not read the signed-in user:", err);
  }
  if (user) await syncMedusaCustomer(user);

  return (
    <ClerkProvider
      localization={{
        signIn: {
          start: {
            title: "Sign in to continue",
            subtitle: "Your cart and wishlist stay right where you left them.",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Track orders, use wallet credit and save your wishlist.",
          },
        },
        // Deleting here removes the login only. Say so, and where to ask for more.
        userProfile: {
          deletePage: {
            messageLine1: "Deleting your account removes your EYRA login.",
            messageLine2: `Your past orders are kept for tax records. To erase your personal details, or to use your wallet credit first, email ${storeConfig.contact.adminEmail} from your account address. We reply within ${storeConfig.policy.grievanceResolutionDays} days.`,
          },
        },
      }}
    >
      <html
        lang="en"
        className={`${poppins.variable} ${cormorant.variable}`}
      >
        <body className="bg-ivory text-carbon font-sans min-h-screen flex flex-col antialiased">
          <AppShell
            navbar={<Navbar />}
            footer={<Footer />}
            cartSyncBanner={<CartSyncBanner />}
            authBackdrop={<HeroSection />}
          >
            {children}
          </AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
