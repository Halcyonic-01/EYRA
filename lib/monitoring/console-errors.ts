import * as Sentry from "@sentry/nextjs";

/**
 * Most server failures are caught and logged, never thrown: a failed Shiprocket
 * call, a refused payment session, an email that did not send. Those logs all
 * start with a "[area]" tag; this reports them to Sentry too. Next's own logs of
 * crashes ("⨯ …") are left alone, because onRequestError already reports those
 * as unhandled, with the request attached.
 */

const TAG = /^\[([^\]]+)\]/;

/** The area of an EYRA error log ("medusa-order"), or null for any other log. */
export function logArea(args: unknown[]): string | null {
  return typeof args[0] === "string" ? (TAG.exec(args[0])?.[1] ?? null) : null;
}

/** The log line without its Error objects, which are reported with their stack instead. */
export function logMessage(args: unknown[]): string {
  return args
    .filter((arg) => !(arg instanceof Error))
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg) ?? String(arg)))
    .join(" ")
    .slice(0, 1000);
}

export function reportConsoleErrors(): void {
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    const area = logArea(args);
    if (!area) return;
    try {
      const error = args.find((arg): arg is Error => arg instanceof Error);
      const message = logMessage(args);
      Sentry.withScope((scope) => {
        scope.setTag("log_area", area);
        scope.setContext("log", { message });
        if (error) Sentry.captureException(error);
        else Sentry.captureMessage(message, "error");
      });
    } catch {
      // Reporting never breaks the code that logged.
    }
  };
}
