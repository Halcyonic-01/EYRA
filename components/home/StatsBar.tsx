import Image from "next/image";
import { FadeIn } from "@/components/ui/FadeIn";

const AVATARS = [
  { src: "/images/avatar-4.jpg", alt: "Customer" },
  { src: "/images/avatar-3.jpg", alt: "Customer" },
  { src: "/images/avatar-2.jpg", alt: "Customer" },
  { src: "/images/avatar-1.jpg", alt: "Customer" },
];

const STATS = [
  { value: "10K+", label: "Happy Customers" },
  { value: "45+", label: "Premium Silver Pieces" },
];

export function StatsBar() {
  return (
    <section className="border-y border-cloud bg-white">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-16 py-10">
        <FadeIn className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* Avatar cluster */}
          <div className="flex items-center flex-shrink-0">
            {AVATARS.map((av, i) => (
              <div
                key={i}
                className="relative size-14 rounded-full overflow-hidden border-2 border-white shadow-sm"
                style={{ marginLeft: i === 0 ? 0 : "-18px", zIndex: AVATARS.length - i }}
              >
                <Image src={av.src} alt={av.alt} fill className="object-cover" sizes="56px" />
              </div>
            ))}
          </div>

          {/* Description */}
          <p className="text-[0.9rem] font-light text-carbon leading-relaxed max-w-sm text-center md:text-left">
            Discover thoughtfully crafted silver jewellery designed to blend timeless sophistication with contemporary minimal style.
          </p>

          {/* Stats */}
          {STATS.map((stat, i) => (
            <div key={stat.value} className="flex items-center gap-6 md:gap-10">
              {i > 0 && (
                <div className="hidden md:block w-px h-12 bg-cloud rotate-[15deg]" aria-hidden="true" />
              )}
              <div className="text-center md:text-left">
                <p className="font-sans font-semibold text-2xl text-jet leading-none">{stat.value}</p>
                <p className="font-sans font-light text-base text-stone mt-1">{stat.label}</p>
              </div>
            </div>
          ))}
        </FadeIn>
      </div>
    </section>
  );
}
