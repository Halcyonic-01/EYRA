/**
 * The look shared by every customer email: EYRA's palette, the frame with the
 * wordmark on top, and the small building blocks inside it. Free of
 * server-only code so templates can be rendered in tests.
 */

import { EMAIL_LOGO_HEIGHT, EMAIL_LOGO_WIDTH } from "@/lib/email-logo";

/** EYRA's brand palette (app/globals.css), mirrored here since email clients can't read @theme tokens. */
export const COLOR = {
  jet: "#020202",
  carbon: "#4d4d4d",
  ash: "#626262",
  stone: "#909090",
  cloud: "#ebebeb",
  ivory: "#f9f9f9",
  white: "#ffffff",
};

export const SITE_URL = "https://www.eyra.org.in";

/** Offer links may lead only to our own site, never to an address someone typed into a request. */
export function isOwnSiteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      (parsed.hostname === "www.eyra.org.in" || parsed.hostname === "eyra.org.in")
    );
  } catch {
    return false;
  }
}

/**
 * The EYRA logo for emails, on a white tile so it stays visible when a mail app
 * is in dark mode (see scripts/generate-email-logo.mjs). It is an attachment of
 * the email itself, referenced as cid:eyra-logo, and sendThroughResend adds the
 * attachment whenever it finds that reference.
 */
export const LOGO_CID = "eyra-logo";

export function logoImage(): string {
  return `<img src="cid:${LOGO_CID}" width="${EMAIL_LOGO_WIDTH}" height="${EMAIL_LOGO_HEIGHT}" alt="EYRA" style="display:block;margin:0 auto;border:0;outline:none;font-family:Georgia,serif;font-size:28px;letter-spacing:6px;color:${COLOR.jet};">`;
}

export const FONT = "Poppins,Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The frame. `footer` replaces the default help line, for emails that need more (an unsubscribe link). */
export function shell(content: string, footer?: string): string {
  return `
  <div style="background:${COLOR.ivory};padding:40px 16px;">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:${COLOR.white};border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:40px 40px 0 40px;text-align:center;">
          ${logoImage()}
        </td>
      </tr>
      ${content}
      <tr>
        <td style="padding:32px 40px 40px 40px;text-align:center;font-family:${FONT};font-size:12px;line-height:18px;color:${COLOR.stone};">
          ${footer ?? `Questions? Reply to this email or visit <a href="${SITE_URL}/support" style="color:${COLOR.stone};">our support page</a>.`}
        </td>
      </tr>
    </table>
  </div>`;
}

export function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${COLOR.jet};color:${COLOR.white};font-family:${FONT};font-size:14px;text-decoration:none;padding:14px 32px;border-radius:999px;">${label}</a>`;
}

/** One label-and-value line in a details table. */
export function row(label: string, value: string): string {
  return `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${COLOR.cloud};font-family:${FONT};font-size:14px;color:${COLOR.ash};">${label}</td>
              <td style="padding:10px 0;border-bottom:1px solid ${COLOR.cloud};font-family:${FONT};font-size:14px;color:${COLOR.jet};text-align:right;">${value}</td>
            </tr>`;
}

/** A centred heading with a line of text under it. */
export function heading(title: string, body: string): string {
  return `
      <tr>
        <td style="padding:32px 40px 0 40px;text-align:center;">
          <div style="font-family:${FONT};font-size:22px;font-weight:500;color:${COLOR.jet};">${title}</div>
          <div style="font-family:${FONT};font-size:14px;color:${COLOR.ash};margin-top:12px;line-height:22px;">${body}</div>
        </td>
      </tr>`;
}
