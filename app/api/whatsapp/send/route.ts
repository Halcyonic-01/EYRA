import type { NextRequest } from "next/server";

import { checkShipmentRequest } from "@/lib/internal-auth";
import { TEMPLATE_PARAMS, sendWhatsappMessage, type WhatsappMessage, type WhatsappTemplate } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends one WhatsApp template message. Called only by the Medusa backend, which
 * decides who is told what; the keys of the provider (WATI or AiSensy) stay here.
 * With no provider set up it says "not configured" and sends nothing.
 *
 * Body: { template, phone, name?, params }
 */
export async function POST(request: NextRequest) {
  const auth = checkShipmentRequest(request);
  if (auth === "unconfigured") return Response.json({ sent: false, error: "not_configured" }, { status: 503 });
  if (auth === "unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<WhatsappMessage>;
  try {
    body = (await request.json()) as Partial<WhatsappMessage>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const template = body.template as WhatsappTemplate | undefined;
  if (!template || !(template in TEMPLATE_PARAMS)) return Response.json({ error: "Unknown template." }, { status: 400 });
  if (typeof body.phone !== "string" || !/^91[6-9]\d{9}$/.test(body.phone)) {
    return Response.json({ error: "phone must be 91 and a ten digit mobile number." }, { status: 400 });
  }
  const params = body.params && typeof body.params === "object" ? (body.params as Record<string, string | number>) : {};

  const result = await sendWhatsappMessage(
    { template, phone: body.phone, name: typeof body.name === "string" ? body.name : null, params },
    process.env
  );
  if (result.sent) return Response.json({ sent: true });
  if ("skipped" in result) return Response.json({ sent: false, skipped: result.skipped });
  console.error("[whatsapp] not sent:", template, result.error);
  return Response.json({ sent: false, error: result.error }, { status: 502 });
}
