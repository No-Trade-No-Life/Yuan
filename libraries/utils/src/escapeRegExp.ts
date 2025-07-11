/**
 * Replace all special characters with escape characters
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions
 * @public
 */
export const escapeRegExp = (string: string): string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
