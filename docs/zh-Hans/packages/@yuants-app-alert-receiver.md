# Yuan Alerting Specification

Alerts in Yuan follows the specification of prometheus operator [runbook](https://runbooks.prometheus-operator.dev/).

Each Alerting Rule is relevant to a specific runbook page, consisting of the following sections:

1. Meaning
2. Impact
3. Diagnosis
4. Mitigation

the annotations of alerting rules are defined as follows:

```yaml
annotations:
  runbook: <runbook page url>
  summary: <alert summary>
  description: <alert description>
```

and with the following labels:

```yaml
labels:
  severity: <unknown | info | warning | error | critical>
```

it is worth noting that the difference between `summary` and `description` is that `summary` is a short description of what the alert is about, while `description` has more details of what's happening right now, usually with labels detailing which specific time series is firing the alert.

## Alert Notification

alerts are sent from prometheus alertmanager to an app `alert-receiver` via webhook.

as alertmanager's [documentation](https://prometheus.io/docs/alerting/latest/configuration/#webhook_config) states, the messages posted from alertmanager are complied with the following schema:

```json
{
  "version": "4",
  "groupKey": <string>,              // key identifying the group of alerts (e.g. to deduplicate)
  "truncatedAlerts": <int>,          // how many alerts have been truncated due to "max_alerts"
  "status": "<resolved|firing>",
  "receiver": <string>,
  "groupLabels": <object>,
  "commonLabels": <object>,
  "commonAnnotations": <object>,
  "externalURL": <string>,           // backlink to the Alertmanager.
  "alerts": [
    {
      "status": "<resolved|firing>",
      "labels": <object>,
      "annotations": <object>,
      "startsAt": "<rfc3339>",
      "endsAt": "<rfc3339>",
      "generatorURL": <string>,      // identifies the entity that caused the alert
      "fingerprint": <string>        // fingerprint to identify the alert
    },
    ...
  ]
}
```

note that the `alerts` field is an array of alerts, which means that alertmanager sends multiple alerts in one message grouped by the keys defined in its [configuration](https://prometheus.io/docs/alerting/latest/configuration/#route).

here we suggest to use `alertname` as the group key, which means that alerts with the same `alertname` will be grouped together in one message to avoid message flooding.
