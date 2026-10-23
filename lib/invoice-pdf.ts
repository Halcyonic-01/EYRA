/**
 * Server-only (it reads files and uses Node's crypto, so a browser bundle could
 * not load it anyway): draws an invoice view as a real PDF file.
 *
 * Uses pdfmake with the Roboto face that ships inside it, which has the rupee
 * sign. It reads only that font folder and the logo file; it fetches nothing
 * from the network. The numbers come from buildInvoiceView and are not
 * recalculated here.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import { formatInvoiceAmount, type InvoiceView, type TotalRow } from "@/lib/invoice-view";

const INK = "#020202";
const MUTED = "#626262";
const FAINT = "#909090";
const RULE = "#E1E1E1";

/** A four-sided margin, typed the way pdfmake wants it. */
const m = (left: number, top: number, right: number, bottom: number): [number, number, number, number] => [left, top, right, bottom];

const money = formatInvoiceAmount;

function rowValue(row: TotalRow): string {
  if (row.freeWhenZero && row.amount === 0) return "Free";
  return `${row.deduction ? "- " : ""}${money(row.amount)}`;
}

/** The file name for a document: the invoice number where there is one. */
export function invoiceFileName(view: InvoiceView): string {
  const base = view.invoiceNumber ?? `EYRA-order-${view.orderNumber}`;
  return `${base.replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`;
}

function logoContent(): Content {
  try {
    const svg = readFileSync(path.join(process.cwd(), "public", "images", "logo-eyra-black.svg"), "utf8");
    return { svg, width: 84, margin: m(0, 0, 0, 8) };
  } catch {
    return { text: "EYRA", bold: true, fontSize: 22, characterSpacing: 6, margin: m(0, 0, 0, 8) };
  }
}

/** The document pdfmake draws. Exported so tests can look at it without rendering. */
export function invoiceDocDefinition(view: InvoiceView): TDocumentDefinitions {
  const isTax = view.kind === "tax_invoice";

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
              ...(view.invoiceNumber ? [{ text: `Invoice #: ${view.invoiceNumber}` }] : []),
              { text: `Order #: ${view.orderNumber}` },
              { text: `Date: ${view.dateText}` },
              ...(view.cancelled ? [{ text: "Status: Cancelled" }] : []),
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
          { text: "BILL TO", fontSize: 8, color: FAINT, characterSpacing: 0.8, margin: m(0, 0, 0, 3) },
          { text: view.buyer.name, fontSize: 10.5 },
          ...view.buyer.addressLines.map((line) => ({ text: line, fontSize: 10.5 })),
          { text: view.buyer.email, fontSize: 10.5 },
        ],
      },
      ...(view.supply
        ? [
            {
              // As wide as the totals block below, so the two start at the same left edge.
              width: 270,
              stack: [
                { text: "PLACE OF SUPPLY", fontSize: 8, color: FAINT, characterSpacing: 0.8, margin: m(0, 0, 0, 3) },
                { text: `${view.supply.state} (${view.supply.stateCode})`, fontSize: 10.5 },
                { text: "TAX TYPE", fontSize: 8, color: FAINT, characterSpacing: 0.8, margin: m(0, 8, 0, 3) },
                { text: view.supply.taxType, fontSize: 10.5 },
              ],
            },
          ]
        : []),
    ],
    margin: m(0, 0, 0, 14),
  };

  const th = (text: string, alignment: "left" | "right" = "left") => ({
    text,
    fontSize: 8,
    color: FAINT,
    characterSpacing: 0.6,
    alignment,
    margin: m(0, 0, 0, 2) as [number, number, number, number],
  });

  const tableHead = [
    th("DESCRIPTION"),
    ...(isTax ? [th("HSN / SAC")] : []),
    th("QTY", "right"),
    th("UNIT PRICE", "right"),
    ...(view.hasDiscount ? [th("DISCOUNT", "right")] : []),
    th("AMOUNT", "right"),
  ];

  const tableBody = view.lines.map((line) => [
    { text: line.description, fontSize: 10.5 },
    ...(isTax ? [{ text: line.hsn ?? "-", fontSize: 10.5, color: MUTED }] : []),
    { text: String(line.quantity), fontSize: 10.5, alignment: "right" as const },
    { text: money(line.unitPrice), fontSize: 10.5, alignment: "right" as const },
    ...(view.hasDiscount
      ? [{ text: line.discount > 0 ? `- ${money(line.discount)}` : "-", fontSize: 10.5, color: MUTED, alignment: "right" as const }]
      : []),
    { text: money(line.amount), fontSize: 10.5, alignment: "right" as const },
  ]);

  const items: Content = {
    table: {
      headerRows: 1,
      widths: [
        "*",
        ...(isTax ? [52] : []),
        26,
        64,
        ...(view.hasDiscount ? [58] : []),
        72,
      ],
      body: [tableHead, ...tableBody],
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

  const igst = Boolean(view.supply?.taxType.startsWith("IGST"));
  const taxSummary: Content | null = view.taxGroups.length
    ? {
        table: {
          headerRows: 1,
          widths: igst ? ["*", 80, 70, 70] : ["*", 80, 60, 60, 66],
          body: [
            [
              th("TAX SUMMARY"),
              th("TAXABLE VALUE", "right"),
              ...(igst ? [th("IGST", "right")] : [th("CGST", "right"), th("SGST", "right")]),
              th("TOTAL GST", "right"),
            ],
            ...view.taxGroups.map((group) => [
              { text: `${group.label} at ${group.rate}%`, fontSize: 10 },
              { text: money(group.taxable), fontSize: 10, alignment: "right" as const },
              ...(igst
                ? [{ text: money(group.igst), fontSize: 10, alignment: "right" as const }]
                : [
                    { text: money(group.cgst), fontSize: 10, alignment: "right" as const },
                    { text: money(group.sgst), fontSize: 10, alignment: "right" as const },
                  ]),
              { text: money(group.gst), fontSize: 10, alignment: "right" as const },
            ]),
          ],
        },
        layout: {
          hLineWidth: (index: number) => (index === 1 ? 0.6 : 0.3),
          hLineColor: () => RULE,
          vLineWidth: () => 0,
          paddingTop: () => 5,
          paddingBottom: () => 5,
          paddingLeft: () => 0,
          paddingRight: () => 0,
        },
        margin: m(0, 6, 0, 4),
      }
    : null;

  const totalsRows = view.rows.map((row) => [
    {
      text: row.label,
      fontSize: row.indent ? 9.5 : 10.5,
      color: MUTED,
      margin: m(row.indent ? 10 : 0, 0, 0, 0),
    },
    { text: rowValue(row), fontSize: row.indent ? 9.5 : 10.5, alignment: "right" as const },
  ]);

  const totals: Content = {
    columns: [
      { width: "*", text: "" },
      {
        width: 270,
        stack: [
          { table: { widths: ["*" as const, "auto" as const], body: totalsRows }, layout: "noBorders" as const },
          { canvas: [{ type: "line", x1: 0, y1: 4, x2: 270, y2: 4, lineWidth: 0.6, lineColor: RULE }], margin: m(0, 2, 0, 4) },
          {
            columns: [
              { text: view.totalLabel, bold: true, fontSize: 12 },
              { text: money(view.total), bold: true, fontSize: 12, alignment: "right" as const },
            ],
          },
          { text: "Inclusive of all taxes", fontSize: 8, color: FAINT, alignment: "right" as const, margin: m(0, 1, 0, 0) },
          ...(view.walletCredit !== null
            ? [
                {
                  margin: m(0, 6, 0, 0) as [number, number, number, number],
                  columns: [
                    { text: "Paid with wallet credit", fontSize: 10.5, color: MUTED },
                    { text: `- ${money(view.walletCredit)}`, fontSize: 10.5, alignment: "right" as const },
                  ],
                },
                {
                  margin: m(0, 3, 0, 0) as [number, number, number, number],
                  columns: [
                    { text: "Balance payable", bold: true, fontSize: 10.5 },
                    { text: money(view.balancePayable ?? 0), bold: true, fontSize: 10.5, alignment: "right" as const },
                  ],
                },
                { text: "Inclusive of all taxes", fontSize: 8, color: FAINT, alignment: "right" as const, margin: m(0, 1, 0, 0) },
              ]
            : []),
        ],
      },
    ],
    margin: m(0, 8, 0, 0),
  };

  const content: Content[] = [];
  if (view.issues.length) {
    content.push({
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                { text: "NOT A VALID TAX INVOICE", bold: true, fontSize: 10, color: "#B3261E" },
                ...view.issues.map((issue) => ({ text: issue, fontSize: 9.5, color: "#B3261E" })),
              ],
              fillColor: "#FDECEA",
              margin: m(8, 6, 8, 6),
            },
          ],
        ],
      },
      layout: "noBorders" as const,
      margin: m(0, 0, 0, 12),
    });
  }
  content.push(header);
  if (view.notice) {
    content.push({
      text: view.notice,
      fontSize: 9.5,
      color: "#444444",
      fillColor: "#F7F7F7",
      margin: m(0, 0, 0, 12),
    });
  }
  content.push(parties, items);
  if (taxSummary) content.push(taxSummary);
  content.push(totals);

  return {
    pageSize: "A4",
    pageMargins: m(40, 40, 40, 56),
    info: {
      title: `${view.heading} ${view.invoiceNumber ?? `Order ${view.orderNumber}`}`,
      author: view.seller.legalName,
      subject: `Order ${view.orderNumber}`,
    },
    defaultStyle: { font: "Roboto", fontSize: 10.5, color: INK },
    content,
    footer: () => ({
      text: view.bisLine ? `${view.footnote}\n${view.bisLine}` : view.footnote,
      fontSize: 8,
      color: FAINT,
      margin: m(40, 12, 40, 0),
    }),
  };
}

export interface RenderedInvoicePdf {
  filename: string;
  bytes: Buffer;
  sha256: string;
}

/** Draws the PDF. Rejects if the document cannot be built. */
export async function renderInvoicePdf(view: InvoiceView): Promise<RenderedInvoicePdf> {
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
  // Nothing in an invoice is fetched from the network, and only the font
  // folder and the logo may be read from disk.
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((file: string) => {
    const resolved = path.resolve(file);
    return resolved.startsWith(fontDir + path.sep);
  });

  const bytes = Buffer.from(await pdfmake.createPdf(invoiceDocDefinition(view)).getBuffer());
  return {
    filename: invoiceFileName(view),
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
