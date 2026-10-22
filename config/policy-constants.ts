/**
 * The fixed numbers of the return policy. They are the same at the Medusa
 * backend (apps/backend src/utils/tax-config.ts), which enforces them, and are
 * kept in a file of their own so browser code can read them without pulling in
 * the rest of the store configuration.
 */

/** Days after delivery within which a return or exchange can be asked for. */
export const RETURN_WINDOW_DAYS = 7;

/** Kept from a returned item's store credit, and from the refund of a refused parcel. */
export const REVERSE_LOGISTICS_FEE = 99;
