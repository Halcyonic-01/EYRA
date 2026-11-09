import { HeroSection } from "@/components/home/HeroSection";
import { StatsBar } from "@/components/home/StatsBar";
import { AboutSection } from "@/components/home/AboutSection";
import { TrendingCarousel } from "@/components/home/TrendingCarousel";
import { CollectionsGrid } from "@/components/home/CollectionsGrid";
import { GenderSplit } from "@/components/home/GenderSplit";
import { ValuesSection } from "@/components/home/ValuesSection";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";

export default function Home() {
  return (
    <>
      <HeroSection />
      <StatsBar />
      <AboutSection />
      <TrendingCarousel />
      <CollectionsGrid />
      <GenderSplit />
      <ValuesSection />
      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}
