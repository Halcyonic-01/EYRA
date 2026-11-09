"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { usePincodeServiceability } from "@/lib/hooks/usePincodeServiceability";
import { formatDeliveryRange } from "@/lib/delivery-date";

/**
 * Icon-only "check delivery to your pincode" trigger in the header, in the
 * slot the search icon used to occupy. Reuses Dropdown for the popover, it already solves
 * portal positioning and viewport clamping correctly, no need to redo that,
 * and the shared usePincodeServiceability hook for a real, Shiprocket-backed
 * answer rather than a guess.
 */
export function DeliveryCheckWidget({ dark = false }: { dark?: boolean }) {
  const [pincode, setPincode] = useState("");
  const pincodeCheck = usePincodeServiceability();

  function handleCheck() {
    pincodeCheck.check(pincode);
  }

  return (
    <Dropdown
      label="Check delivery"
      active={pincodeCheck.status === "success"}
      icon={<Truck size={17} strokeWidth={1.5} />}
      iconClassName={dark ? "text-pearl hover:text-white" : "text-[#333] hover:text-black"}
    >
      {() => (
        <div className="flex flex-col gap-3 w-[260px]">
          <p className="font-sans font-medium text-[13px] text-black">
            Check delivery to your pincode
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCheck();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              inputMode="numeric"
              placeholder="6-digit pincode"
              value={pincode}
              onChange={(e) => {
                setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
                pincodeCheck.reset();
              }}
              autoFocus
              className="flex-1 min-w-0 px-3 py-2 border border-[#CFCFCF] rounded-full font-sans text-[13px] text-black placeholder:text-[#909090] focus:outline-none focus:border-black transition-colors duration-200"
            />
            <button
              type="submit"
              disabled={pincodeCheck.status === "loading"}
              className="shrink-0 px-4 py-2 bg-black text-white font-sans font-normal text-[13px] rounded-full hover:bg-[#1a1a1a] disabled:opacity-60 transition-colors duration-200"
            >
              {pincodeCheck.status === "loading" ? "…" : "Check"}
            </button>
          </form>

          {pincodeCheck.status === "error" && (
            <p role="alert" className="font-sans text-[12px] leading-snug text-[#D93025]">
              {pincodeCheck.error}
            </p>
          )}
          {pincodeCheck.status === "success" && pincodeCheck.result && (
            <p className="font-sans text-[12px] leading-snug text-[#3D3D3D]">
              {pincodeCheck.result.serviceable ? (
                <>
                  <span className="text-[#3D7A1A] font-medium">Delivery available.</span>{" "}
                  Arriving {formatDeliveryRange(pincodeCheck.result.estimatedDays, pincodeCheck.result.estimatedDays + 1)}
                  {pincodeCheck.result.availablePaymentMethods.includes("cod")
                    ? ", cash on delivery available."
                    : ", prepaid only."}
                </>
              ) : (
                "Sorry, we don't currently deliver to this pincode."
              )}
            </p>
          )}
        </div>
      )}
    </Dropdown>
  );
}
