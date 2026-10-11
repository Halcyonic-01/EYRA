import type { Metadata } from "next";
import { ComingSoon } from "@/components/launch/ComingSoon";

const TITLE = "EYRA | Launching 08/11/2026";
const DESCRIPTION =
  "Fine 925 sterling silver jewelry. Reflecting Your Essence. EYRA launches on 8 November 2026, follow our journey on Instagram.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.eyra.org.in"),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "EYRA",
    locale: "en_IN",
    type: "website",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function LaunchingSoonPage() {
  return <ComingSoon />;
}
