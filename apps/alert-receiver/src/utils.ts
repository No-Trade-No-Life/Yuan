export const SEVERITY_ORDER = ['UNKNOWN', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'] as const;

export const getSeverityIndex = (value: string) =>
  SEVERITY_ORDER.indexOf(value as (typeof SEVERITY_ORDER)[number]);

export const normalizeSeverity = (severity: string | undefined): string => {
  if (!severity) return 'UNKNOWN';
  const upper = severity.toUpperCase();
  if (getSeverityIndex(upper) !== -1) {
    return upper;
  }
  return 'UNKNOWN';
};
