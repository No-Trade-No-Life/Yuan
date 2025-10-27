/**
 * Re-implements Alertmanager's group key formatting.
 *
 * Sources in upstream Alertmanager / Prometheus:
 * - dispatch.aggrGroup.GroupKey(): github.com/prometheus/alertmanager/dispatch/dispatch.go
 *   → group key is `${routeKey}:${groupLabels}`.
 * - Route.Key(): github.com/prometheus/alertmanager/dispatch/route.go
 *   → recursively concatenates `labels.Matchers.String()` for every route segment.
 * - labels.Matchers.String(): github.com/prometheus/alertmanager/pkg/labels/matcher.go
 *   → renders matchers as `{name="value"}` (comma separated, no spaces), escaping per OpenMetrics.
 * - model.LabelSet.String(): github.com/prometheus/common/model/labelset_string.go
 *   → renders label sets as `{foo="bar", baz="qux"}` (sorted, `, ` separator, Go-style quoting).
 *
 * Matching the upstream format lets us generate Alertmanager-identical group keys when
 * the webhook payload omits `groupKey`, or when we synthesise alerts locally.
 */

const RESERVED_LABEL_NAME = /[\s{}!=~,\\"'`]/u;

export type MatcherOperator = '=' | '!=' | '=~' | '!~';

export interface IRouteMatcher {
  name: string;
  value: string;
  operator: MatcherOperator;
}

export type RouteSegment = readonly IRouteMatcher[];

const MATCHER_OPERATOR_TO_STRING: Record<MatcherOperator, string> = {
  '=': '=',
  '!=': '!=',
  '=~': '=~',
  '!~': '!~',
};

const escapeOpenMetricsValue = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
};

const quote = (value: string): string => JSON.stringify(value);

const formatMatcher = (matcher: IRouteMatcher): string => {
  const op = MATCHER_OPERATOR_TO_STRING[matcher.operator];
  const val = matcher.value ?? '';
  if (RESERVED_LABEL_NAME.test(matcher.name)) {
    return `${quote(matcher.name)}${op}${quote(val)}`;
  }
  return `${matcher.name}${op}"${escapeOpenMetricsValue(val)}"`;
};

const formatRouteSegment = (segment: RouteSegment): string => {
  if (!segment.length) return '{}';
  return `{${segment.map(formatMatcher).join(',')}}`;
};

export const formatRouteKey = (segments: readonly RouteSegment[]): string => {
  if (segments.length === 0) {
    // Alertmanager's root route renders as "{}".
    return '{}';
  }
  return segments.map(formatRouteSegment).join('/');
};

const formatLabelValue = (value: string): string => quote(value ?? '');

export const formatGroupLabels = (labels: Record<string, string>): string => {
  const keys = Object.keys(labels).sort();
  const parts = keys.map((key) => `${key}=${formatLabelValue(labels[key] ?? '')}`);
  return `{${parts.join(', ')}}`;
};

export type RouteKeyInput = string | readonly RouteSegment[];

const normaliseRouteKey = (route: RouteKeyInput): string => {
  if (typeof route === 'string') {
    return route;
  }
  return formatRouteKey(route);
};

export const computeAlertGroupKey = (route: RouteKeyInput, groupLabels: Record<string, string>): string => {
  return `${normaliseRouteKey(route)}:${formatGroupLabels(groupLabels)}`;
};
