import crypto from "node:crypto";
import http from "node:http";

/**
 * A stand-in for PayU: the hosted checkout page (/_payment) and the merchant
 * API the backend asks (verify_payment). The local backend must be started with
 * PAYU_CHECKOUT_URL and PAYU_API_URL pointing here and the same key and salt.
 * Hashes follow PayU's documented formulas, so a wrong hash anywhere fails here.
 */

export const FAKE_PAYU_PORT = Number(process.env.E2E_PAYU_PORT ?? 19443);
export const FAKE_PAYU_KEY = process.env.E2E_PAYU_KEY ?? "e2eKey";
export const FAKE_PAYU_SALT = process.env.E2E_PAYU_SALT ?? "e2eSalt";

const sha512 = (text: string) => crypto.createHash("sha512").update(text).digest("hex");

type Outcome = "success" | "failure" | "cancel" | "pending";

interface Txn {
  txnid: string;
  mihpayid: string;
  amount: string;
  status: "success" | "failure" | "pending";
  unmappedstatus: string;
  request: Record<string, string>;
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function requestHashValid(f: Record<string, string>): boolean {
  const expected = sha512(
    [f.key, f.txnid, f.amount, f.productinfo, f.firstname, f.email, f.udf1 ?? "", f.udf2 ?? "", f.udf3 ?? "", f.udf4 ?? "", f.udf5 ?? "", "", "", "", "", "", FAKE_PAYU_SALT].join("|")
  );
  return f.key === FAKE_PAYU_KEY && f.hash === expected;
}

/** What PayU posts to surl/furl, signed with the documented reverse hash. */
export function signedResponse(request: Record<string, string>, txn: Pick<Txn, "status" | "mihpayid" | "unmappedstatus">, salt = FAKE_PAYU_SALT) {
  const udf = [request.udf1 ?? "", request.udf2 ?? "", request.udf3 ?? "", request.udf4 ?? "", request.udf5 ?? ""];
  const hash = sha512(
    [salt, txn.status, "", "", "", "", "", udf[4], udf[3], udf[2], udf[1], udf[0], request.email, request.firstname, request.productinfo, request.amount, request.txnid, FAKE_PAYU_KEY].join("|")
  );
  return {
    key: FAKE_PAYU_KEY, txnid: request.txnid, amount: request.amount, productinfo: request.productinfo,
    firstname: request.firstname, email: request.email, udf1: udf[0], udf2: udf[1], udf3: udf[2], udf4: udf[3], udf5: udf[4],
    status: txn.status, unmappedstatus: txn.unmappedstatus, mihpayid: txn.mihpayid, hash,
    // Card details PayU sends too; the storefront must drop them.
    cardnum: "512345XXXXXX2346", name_on_card: "E2E", mode: "CC",
  };
}

function autoPostPage(action: string, fields: Record<string, string>): string {
  const inputs = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(v)}">`).join("");
  return `<!doctype html><html><body><form id="back" method="POST" action="${escape(action)}">${inputs}</form><script>document.getElementById("back").submit()</script></body></html>`;
}

export async function startFakePayu() {
  const txns = new Map<string, Txn>();
  const sessions = new Map<string, Record<string, string>>();
  const verifyCalls: string[] = [];
  let seq = 0;

  function decide(txnid: string, outcome: Outcome): Txn {
    const request = sessions.get(txnid)!;
    const txn: Txn = {
      txnid,
      mihpayid: txns.get(txnid)?.mihpayid ?? `40${Date.now()}${++seq}`,
      amount: request.amount,
      status: outcome === "success" ? "success" : outcome === "pending" ? "pending" : "failure",
      unmappedstatus: outcome === "success" ? "captured" : outcome === "pending" ? "pending" : outcome === "cancel" ? "userCancelled" : "failed",
      request,
    };
    txns.set(txnid, txn);
    return txn;
  }

  function api(params: URLSearchParams): unknown {
    const command = params.get("command") ?? "";
    const expected = sha512([params.get("key"), command, params.get("var1") ?? "", FAKE_PAYU_SALT].join("|"));
    if (params.get("key") !== FAKE_PAYU_KEY || params.get("hash") !== expected) return { status: 0, msg: "Invalid Hash." };
    if (command !== "verify_payment") return { status: 0, msg: "Unknown command" };
    const txnid = params.get("var1") ?? "";
    verifyCalls.push(txnid);
    const txn = txns.get(txnid);
    if (!txn) return { status: 0, msg: "0 out of 1", transaction_details: { [txnid]: { mihpayid: "Not Found", status: "Not Found" } } };
    return {
      status: 1,
      msg: "1 out of 1 Transactions Fetched Successfully",
      transaction_details: { [txnid]: { mihpayid: txn.mihpayid, txnid, amt: txn.amount, transaction_amount: txn.amount, status: txn.status, unmappedstatus: txn.unmappedstatus } },
    };
  }

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const params = new URLSearchParams(Buffer.concat(chunks).toString());
      const path = new URL(req.url ?? "/", "http://x").pathname;
      const html = (status: number, body: string) => res.writeHead(status, { "Content-Type": "text/html" }).end(body);

      if (path === "/merchant/postservice.php") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(api(params)));
        return;
      }
      if (path === "/_payment") {
        const fields = Object.fromEntries(params.entries());
        if (!requestHashValid(fields)) return html(400, "<h1 data-testid='payu-bad-request'>Invalid hash</h1>");
        sessions.set(fields.txnid, fields);
        const button = (outcome: Outcome, label: string) =>
          `<form method="POST" action="/_decide"><input type="hidden" name="txnid" value="${escape(fields.txnid)}"><input type="hidden" name="outcome" value="${outcome}"><button data-testid="payu-${outcome}">${label}</button></form>`;
        return html(200, `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body>
          <h1 data-testid="payu-page">PayU test checkout</h1>
          <p data-testid="payu-amount">Rs. ${escape(fields.amount)}</p>
          ${button("success", "Pay")}${button("failure", "Fail")}${button("cancel", "Cancel")}${button("pending", "Leave pending")}
        </body></html>`);
      }
      if (path === "/_decide") {
        const txnid = params.get("txnid") ?? "";
        const request = sessions.get(txnid);
        if (!request) return html(404, "unknown txn");
        const txn = decide(txnid, (params.get("outcome") as Outcome) ?? "failure");
        const target = txn.status === "success" ? request.surl : request.furl;
        return html(200, autoPostPage(target, signedResponse(request, txn)));
      }
      html(404, "not found");
    });
  });
  await new Promise<void>((done) => server.listen(FAKE_PAYU_PORT, "127.0.0.1", () => done()));

  return {
    txns,
    sessions,
    verifyCalls,
    /** A pending payment settling later at PayU. */
    settle: (txnid: string, outcome: "success" | "failure" | "pending") => decide(txnid, outcome),
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}
