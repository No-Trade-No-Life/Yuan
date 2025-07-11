/**
 * Short for `crypto.randomUUID`.
 *
 * @public
 *
 * @returns Universal Unique ID string
 */
export const UUID = (): string => globalThis.crypto.randomUUID();
