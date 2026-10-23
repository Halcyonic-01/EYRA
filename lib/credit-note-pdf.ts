/**
 * Server-only: draws a credit note view as a real PDF with pdfmake and the
 * Roboto face that ships inside it (it has the rupee sign). Reads only that font
 * folder and the logo file; fetches nothing. The numbers come from the credit
 * note the backend issued and are not recalculated.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import { money, type CreditNoteView } from "@/lib/credit-note-view";

const INK = "#020202";
const MUTED = "#626262";
const FAINT = "#909090";
const RULE = "#E1E1E1";

const m = (left: number, top: number, right: number, bottom: number): [number, number, number, number] => [left, top, right, bottom];

export function creditNoteFileName(view: CreditNoteView): string {
  return `${view.creditNoteNumber.replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`;
}

function logoContent(): Content {
  try {
    const svg = readFileSync(path.join(process.cwd(), "public", "images", "logo-eyra-black.svg"), "utf8");
    return { svg, width: 84, margin: m(0, 0, 0, 8) };
  } catch {
    return { text: "EYRA", bold: true, fontSize: 22, characterSpacing: 6, margin: m(0, 0, 0, 8) };
  }
}

export function creditNoteDocDefinition(view: CreditNoteView): TDocumentDefinitions {
  const th = (text: string, alignment: "left" | "right" = "left") => ({
    text,
    fontSize: 8,
    color: FAINT,
    characterSpacing: 0.6,
    alignment,
    margin: m(0, 0, 0, 2),
  });

  const header: Content = {
    columns: [
      {
        width: "*",
        stack: [
          logoContent(),
          { text: view.seller.legalName, fontSize: 9.5, color: MUTED },
          ...view.seller.addressLines.map((line) => ({ text: line, fontSize: 9.5, color: MUTED })),
          { text: `GSTIN: ${view.seller.gstin || "-"}`, fontSize: 9.5, color: MUTED },
        ],
      },
      {
        width: "auto",
        alignment: "right" as const,
        stack: [
          { text: view.heading.toUpperCase(), fontSize: 14, bold: true, characterSpacing: 1 },
          {
            margin: m(0, 6, 0, 0),
            fontSize: 9.5,
            color: MUTED,
            stack: [
              { text: `Credit note #: ${view.creditNoteNumber}` },
              { text: `Date: ${view.dateText}` },
              { text: `Original invoice #: ${view.originalInvoiceNumber}` },
              { text: `Original invoice date: ${view.originalInvoiceDateText}` },
              { text: `Order #: ${view.orderNumber}` },
            ],
          },
        ],
      },
    ],
    margin: m(0, 0, 0, 14),
  };

  const parties: Content = {
    columns: [
      {
        width: "*",
        stack: [
          { text: "CREDITED TO", fontSize: 8, color: FAINT, characterSpacing: 0.8, margin: m(0, 0, 0, 3) },
          { text: view.buyer.name, fontSize: 10.5 },
          { text: `${view.buyer.state} (${view.buyer.stateCode})`, fontSize: 10.5 },
          ...(view.buyer.gstin ? [{ text: `GSTIN: ${view.buyer.gstin}`, fontSize: 10.5 }] : []),
        ],
      },
      {
        // As wide as the totals block below, so the two start at the same left edge.
        width: 270,
        stack: [
          { text: "PLACE OF SUPPLY", fontSize: 8, color: FAINT, characterSpacing: 0.8, margin: m(0, 0, 0, 3) },
          { text: `${view.supply.state} (${view.supply.stateCode})`, fontSize: 10.5 },
          { text: "TAX TYPE", fontSize: 8, color: FAINT, characterSpacing: 0.8, margin: m(0, 8, 0, 3) },
          { text: view.supply.taxType, fontSize: 10.5 },
          { text: "REASON", fontSize: 8, color: FAINT, characterSpacing: 0.8, margin: m(0, 8, 0, 3) },
          { text: view.reasonText, fontSize: 10.5 },
        ],
      },
    ],
    margin: m(0, 0, 0, 14),
  };

  const taxHeads = view.igst ? [th("IGST", "right")] : [th("CGST", "right"), th("SGST", "right")];
  const items: Content = {
    table: {
      headerRows: 1,
      widths: view.igst ? ["*", 44, 26, 60, 40, 56, 66] : ["*", 44, 26, 60, 40, 48, 48, 62],
      body: [
        [
          th("DESCRIPTION"),
          th("HSN / SAC"),
          th("QTY", "right"),
          th("TAXABLE VALUE", "right"),
          th("RATE", "right"),
          ...taxHeads,
          th("TOTAL", "right"),
        ],
        ...view.lines.map((line) => [
          { text: line.description, fontSize: 10 },
          { text: line.hsn_sac, fontSize: 10, color: MUTED },
          { text: String(line.quantity), fontSize: 10, alignment: "right" as const },
          { text: money(line.taxable_value), fontSize: 10, alignment: "right" as const },
          { text: `${line.gst_rate}%`, fontSize: 10, alignment: "right" as const },
          ...(view.igst
            ? [{ text: money(line.igst), fontSize: 10, alignment: "right" as const }]
            : [
                { text: money(line.cgst), fontSize: 10, alignment: "right" as const },
                { text: money(line.sgst), fontSize: 10, alignment: "right" as const },
              ]),
          { text: money(line.total), fontSize: 10, alignment: "right" as const },
        ]),
      ],
    },
    layout: {
      hLineWidth: (index: number, node: { table: { body: unknown[] } }) =>
        index === 1 || index === node.table.body.length ? 0.6 : 0.3,
      hLineColor: () => RULE,
      vLineWidth: () => 0,
      paddingTop: () => 6,
      paddingBottom: () => 6,
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
    margin: m(0, 0, 0, 4),
  };

  const totals: Content = {
    columns: [
      { width: "*", text: "" },
      {
        width: 270,
        table: {
          widths: ["*" as const, "auto" as const],
          body: view.rows.map((row) => [
            {
              text: row.label,
              fontSize: row.bold ? 11 : row.indent ? 9.5 : 10.5,
              bold: row.bold,
              color: row.bold ? INK : MUTED,
              margin: m(row.indent ? 10 : 0, 2, 0, 2),
            },
            {
              text: `${row.deduction ? "- " : ""}${money(row.amount)}`,
              fontSize: row.bold ? 11 : row.indent ? 9.5 : 10.5,
              bold: row.bold,
              alignment: "right" as const,
              margin: m(0, 2, 0, 2),
            },
          ]),
        },
        layout: "noBorders" as const,
      },
    ],
    margin: m(0, 8, 0, 0),
  };

  return {
    pageSize: "A4",
    pageMargins: m(40, 40, 40, 56),
    info: {
      title: `${view.heading} ${view.creditNoteNumber}`,
      author: view.seller.legalName,
      subject: `Credit note for invoice ${view.originalInvoiceNumber}`,
    },
    defaultStyle: { font: "Roboto", fontSize: 10.5, color: INK },
    content: [header, parties, items, totals],
    footer: () => ({ text: view.bisLine ? `${view.footnote}\n${view.bisLine}` : view.footnote, fontSize: 8, color: FAINT, margin: m(40, 12, 40, 0) }),
  };
}

export interface RenderedCreditNotePdf {
  filename: string;
  bytes: Buffer;
  sha256: string;
}

export async function renderCreditNotePdf(view: CreditNoteView): Promise<RenderedCreditNotePdf> {
  const { default: pdfmake } = await import("pdfmake");
  const fontDir = path.join(process.cwd(), "node_modules", "pdfmake", "fonts", "Roboto");

  pdfmake.addFonts({
    Roboto: {
      normal: path.join(fontDir, "Roboto-Regular.ttf"),
      bold: path.join(fontDir, "Roboto-Medium.ttf"),
      italics: path.join(fontDir, "Roboto-Italic.ttf"),
      bolditalics: path.join(fontDir, "Roboto-MediumItalic.ttf"),
    },
  });
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((file: string) => path.resolve(file).startsWith(fontDir + path.sep));

  const bytes = Buffer.from(await pdfmake.createPdf(creditNoteDocDefinition(view)).getBuffer());
  return { filename: creditNoteFileName(view), bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}
