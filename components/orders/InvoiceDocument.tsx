import Image from "next/image";

import type { InvoiceInfo } from "@/lib/invoice-kind";
import { invoiceSettings } from "@/lib/invoice-settings";
import {
  buildInvoiceView,
  formatInvoiceAmount,
  type InvoiceOrder,
  type InvoiceView,
  type TotalRow,
} from "@/lib/invoice-view";
import { formatRupees } from "@/lib/money";

/** The order shape the invoice is built from. */
export type MedusaOrder = InvoiceOrder;

const formatAmount = formatInvoiceAmount;

function Row({ row }: { row: TotalRow }) {
  const value =
    row.freeWhenZero && row.amount === 0
      ? "Free"
      : `${row.deduction ? "− " : ""}${formatAmount(row.amount)}`;
  return (
    <div className={`flex justify-between font-sans text-[14px] ${row.indent ? "pl-4 text-[13px]" : ""}`}>
      <span className="text-[#626262]">{row.label}</span>
      <span className="text-black">{value}</span>
    </div>
  );
}

/**
 * The invoice or receipt itself. Until the order ships it is an order receipt,
 * with no invoice number and no tax breakup; once it ships it is the GST tax
 * invoice, numbered and dated by the day it was dispatched. Everything it says
 * comes from buildInvoiceView, which the PDF uses too.
 */
export function InvoiceDocument({ order, invoice }: { order: MedusaOrder; invoice: InvoiceInfo }) {
  const view = buildInvoiceView(order, invoice, invoiceSettings());
  return <InvoiceBody view={view} />;
}

export function InvoiceBody({ view }: { view: InvoiceView }) {
  const isTaxInvoice = view.kind === "tax_invoice";

  return (
  <div className="border border-[#E1E1E1] rounded-2xl p-8 lg:p-12">
    {/* Header */}
    <div className="flex justify-between items-start gap-6 mb-8 pb-8 border-b border-[#E1E1E1]">
      <div>
        <Image
          src="/images/logo-eyra-black.svg"
          alt="EYRA"
          width={112}
          height={65}
          priority
          unoptimized
          className="mb-3 h-[65px] w-auto"
        />
        <p className="font-sans text-[13px] text-[#626262] leading-[20px]">
          {view.seller.legalName}
          {view.seller.addressLines.map((line) => (
            <span key={line}>
              <br />
              {line}
            </span>
          ))}
          <br />
          GSTIN: {view.seller.gstin || "-"}
        </p>
      </div>
      <div className="text-right">
        <p className="font-sans font-medium text-[18px] text-black uppercase tracking-wide">
          {view.heading}
        </p>
        <p className="font-sans text-[13px] text-[#626262] mt-2">
          {view.invoiceNumber && (
            <>
              Invoice #: {view.invoiceNumber}
              <br />
            </>
          )}
          Order #: {view.orderNumber}
          <br />
          Date: {view.dateText}
          {view.cancelled && (
            <>
              <br />
              Status: Cancelled
            </>
          )}
        </p>
      </div>
    </div>

    {view.notice && (
      <p className="mb-8 rounded-xl bg-[#F7F7F7] px-4 py-3 font-sans text-[13px] leading-relaxed text-[#444]">
        {view.notice}
      </p>
    )}

    {/* Bill to / Place of supply */}
    <div className={`grid gap-8 mb-8 pb-8 border-b border-[#E1E1E1] ${isTaxInvoice ? "grid-cols-2" : "grid-cols-1"}`}>
      <div>
        <p className="font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] mb-2">
          Bill To
        </p>
        <p className="font-sans text-[14px] text-black leading-[22px]">
          {view.buyer.name}
          {view.buyer.addressLines.map((line) => (
            <span key={line}>
              <br />
              {line}
            </span>
          ))}
          <br />
          {view.buyer.email}
        </p>
      </div>
      {view.supply && (
      <div>
        <p className="font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] mb-2">
          Place of Supply
        </p>
        <p className="font-sans text-[14px] text-black leading-[22px]">
          {view.supply.state} ({view.supply.stateCode})
        </p>
        <p className="font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] mt-4 mb-2">
          Tax Type
        </p>
        <p className="font-sans text-[14px] text-black">{view.supply.taxType}</p>
      </div>
      )}
    </div>

    {/* Line items */}
    <table className="w-full mb-8 border-collapse">
      <thead>
        <tr className="border-b border-[#E1E1E1]">
          <th className="text-left font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
            Description
          </th>
          {isTaxInvoice && (
            <th className="text-left font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
              HSN / SAC
            </th>
          )}
          <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
            Qty
          </th>
          <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
            Unit Price
            <span className="block normal-case tracking-normal text-[10px] font-normal">incl. all taxes</span>
          </th>
          {view.hasDiscount && (
            <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
              Discount
            </th>
          )}
          <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
            Amount
            <span className="block normal-case tracking-normal text-[10px] font-normal">incl. all taxes</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {view.lines.map((line, index) => (
          <tr key={`${line.description}-${index}`} className="border-b border-[#F0F0F0]">
            <td className="py-3 font-sans text-[14px] text-black">{line.description}</td>
            {isTaxInvoice && (
              <td className="py-3 font-sans text-[14px] text-[#626262]">{line.hsn ?? "-"}</td>
            )}
            <td className="py-3 font-sans text-[14px] text-black text-right">{line.quantity}</td>
            <td className="py-3 font-sans text-[14px] text-black text-right">
              {formatAmount(line.unitPrice)}
            </td>
            {view.hasDiscount && (
              <td className="py-3 font-sans text-[14px] text-[#626262] text-right">
                {line.discount > 0 ? `- ${formatAmount(line.discount)}` : "-"}
              </td>
            )}
            <td className="py-3 font-sans text-[14px] text-black text-right">
              {formatAmount(line.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {/* Tax summary: one row per HSN or SAC group */}
    {view.taxGroups.length > 0 && (
      <table className="w-full mb-8 border-collapse">
        <thead>
          <tr className="border-b border-[#E1E1E1]">
            <th className="text-left font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
              Tax summary
            </th>
            <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
              Taxable value
            </th>
            {view.supply?.taxType.startsWith("IGST") ? (
              <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
                IGST
              </th>
            ) : (
              <>
                <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
                  CGST
                </th>
                <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
                  SGST
                </th>
              </>
            )}
            <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
              Total GST
            </th>
          </tr>
        </thead>
        <tbody>
          {view.taxGroups.map((group) => (
            <tr key={group.label} className="border-b border-[#F0F0F0]">
              <td className="py-3 font-sans text-[13px] text-black">
                {group.label} at {group.rate}%
              </td>
              <td className="py-3 font-sans text-[13px] text-black text-right">{formatAmount(group.taxable)}</td>
              {view.supply?.taxType.startsWith("IGST") ? (
                <td className="py-3 font-sans text-[13px] text-black text-right">{formatAmount(group.igst)}</td>
              ) : (
                <>
                  <td className="py-3 font-sans text-[13px] text-black text-right">{formatAmount(group.cgst)}</td>
                  <td className="py-3 font-sans text-[13px] text-black text-right">{formatAmount(group.sgst)}</td>
                </>
              )}
              <td className="py-3 font-sans text-[13px] text-black text-right">{formatAmount(group.gst)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}

    {/* Totals */}
    <div className="flex justify-end">
      <div className="w-full max-w-[340px] flex flex-col gap-2">
        {view.rows.map((row) => (
          <Row key={row.label} row={row} />
        ))}
        <div className="h-px bg-[#E1E1E1] my-1" />
        <div className="flex justify-between font-sans font-medium text-[16px]">
          <span className="text-black">{view.totalLabel}</span>
          <span className="text-black">{formatAmount(view.total)}</span>
        </div>
        <p className="text-right font-sans text-[11px] text-[#909090] -mt-1">Inclusive of all taxes</p>
        {view.walletCredit !== null && (
          <>
            <div className="flex justify-between font-sans text-[14px]">
              <span className="text-[#626262]">Paid with wallet credit</span>
              <span className="text-black">− {formatRupees(view.walletCredit)}</span>
            </div>
            <div className="flex justify-between font-sans font-medium text-[14px]">
              <span className="text-black">Balance payable</span>
              <span className="text-black">{formatAmount(view.balancePayable ?? 0)}</span>
            </div>
            <p className="text-right font-sans text-[11px] text-[#909090] -mt-1">Inclusive of all taxes</p>
          </>
        )}
      </div>
    </div>

    <p className="font-sans text-[11px] text-[#909090] mt-10 pt-6 border-t border-[#E1E1E1]">
      {view.footnote}
      {view.bisLine && (
        <>
          <br />
          {view.bisLine}
        </>
      )}
    </p>
  </div>
  );
}
