import type { PayuCheckoutForm } from "@/lib/payu";

/**
 * Send the browser to PayU's hosted checkout: PayU takes a form post, not a
 * link. Self-contained (no imports at runtime) so tests can run it in a page.
 */
export function submitHostedForm(form: PayuCheckoutForm): void {
  const el = document.createElement("form");
  el.method = "POST";
  el.action = form.action;
  el.style.display = "none";
  for (const [name, value] of Object.entries(form.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    el.appendChild(input);
  }
  document.body.appendChild(el);
  el.submit();
}
