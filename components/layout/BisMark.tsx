import Image from "next/image";

import { storeConfig } from "@/config/storeConfig";
import { bisLogoPath } from "@/lib/bis-logo";

/**
 * The BIS hallmark registration: the official logo (when its file has been added,
 * see lib/bis-logo.ts) beside the registration number, as the e-commerce
 * compliance rules ask of a seller of hallmarked jewellery.
 */
export function BisMark({ className = "" }: { className?: string }) {
  const logo = bisLogoPath();
  const { bisRegistration } = storeConfig.company;
  if (!bisRegistration) return null;

  return (
    <div className={`flex items-center gap-3 ${className}`} data-testid="bis-mark">
      {logo && (
        <Image src={logo} alt="BIS Hallmark" width={300} height={200} className="h-[60px] w-auto rounded-sm bg-white" unoptimized />
      )}
      <p className="text-[0.76rem] font-normal leading-snug text-pearl tracking-[0.02em]">
        BIS Hallmarking
        <br />
        Registration No.: <span className="text-white">{bisRegistration}</span>
      </p>
    </div>
  );
}
