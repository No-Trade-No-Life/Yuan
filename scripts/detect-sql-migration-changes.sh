#!/usr/bin/env bash

set -euo pipefail

BASE_REF_SHA="${BASE_SHA:-}"
EVENT_NAME="${EVENT_NAME:-}"
SQL_DIR="${SQL_DIR:-tools/sql-migration/sql}"

if [[ "${EVENT_NAME}" != "pull_request" ]]; then
  if git rev-parse HEAD^ >/dev/null 2>&1; then
    BASE_REF_SHA="$(git rev-parse HEAD^)"
  fi
fi

if [[ -z "${BASE_REF_SHA}" ]]; then
  echo "changed=true" >> "${GITHUB_OUTPUT}"
  exit 0
fi

if ! git cat-file -e "${BASE_REF_SHA}^{commit}" >/dev/null 2>&1; then
  echo "changed=true" >> "${GITHUB_OUTPUT}"
  exit 0
fi

CHANGED_SQL_FILES="$(git diff --name-only "${BASE_REF_SHA}"..HEAD -- "${SQL_DIR}")"

if [[ -n "${CHANGED_SQL_FILES}" ]] && printf '%s\n' "${CHANGED_SQL_FILES}" | grep -qE '\\.sql$'; then
  echo "changed=true" >> "${GITHUB_OUTPUT}"
else
  echo "changed=false" >> "${GITHUB_OUTPUT}"
fi
