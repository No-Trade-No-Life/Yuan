#!/usr/bin/env bash
# Create or update the daily git report PR.
# Arguments:
#   1) report date (YYYY-MM-DD)
#   2) old commit short hash
#   3) new commit short hash
#   4) commit count
#   5) json path (optional, default docs/reports/git-changes-<date>.json)
#   6) report path (optional, default docs/reports/git-changes-report-<date>.md)
#
# Env:
#   APP_TOKEN (required)
#   DRY_RUN=1 to skip push/PR for local testing.

set -euo pipefail

REPORT_DATE="${1:-}"
OLD_SHORT="${2:-}"
NEW_SHORT="${3:-}"
COMMIT_COUNT="${4:-}"
JSON_PATH="${5:-docs/reports/git-changes-${REPORT_DATE}.json}"
REPORT_PATH="${6:-docs/reports/git-changes-report-${REPORT_DATE}.md}"

if [[ -z "$REPORT_DATE" || -z "$OLD_SHORT" || -z "$NEW_SHORT" || -z "$COMMIT_COUNT" ]]; then
  echo "Usage: $0 <report_date> <old_short> <new_short> <commit_count> [json_path] [report_path]"
  exit 1
fi

if [[ -z "${APP_TOKEN:-}" ]]; then
  echo "APP_TOKEN is required"
  exit 1
fi

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "DRY_RUN=1, skip git/PR actions"
  exit 0
fi

export GH_TOKEN="$APP_TOKEN"

git config --global user.name "github-actions[bot]"
git config --global user.email "github-actions[bot]@users.noreply.github.com"

BRANCH_NAME="daily-report-${REPORT_DATE}"
git checkout -B "$BRANCH_NAME"
git add "docs/reports/"

if git diff --cached --quiet; then
  echo "没有变更，跳过 PR 创建"
  exit 0
fi

git commit -m "feat: add daily git change report for ${REPORT_DATE} - ${COMMIT_COUNT} commits"

if [[ "${DRY_RUN:-0}" != "1" ]]; then
  git push origin "$BRANCH_NAME" --force
else
  echo "DRY_RUN=1, skip push"
fi

PR_TITLE="Daily Git Change Report ${REPORT_DATE}"
PR_BODY_FILE="$(mktemp)"
trap 'rm -f "$PR_BODY_FILE"' EXIT

cat > "$PR_BODY_FILE" <<EOF
## 每日 Git 变更报告

### 报告信息
- **日期**: ${REPORT_DATE}
- **提交范围**: ${OLD_SHORT}..${NEW_SHORT}
- **提交数量**: ${COMMIT_COUNT}
- **生成时间**: $(date -Iseconds)

### 包含文件
1. ${JSON_PATH} - 结构化 JSON 数据
2. ${REPORT_PATH} - 完整的语义化报告

### 自动化
此 PR 由 GitHub Actions 自动生成，计划每天东八区早上8点运行。

### 报告正文
EOF

cat "$REPORT_PATH" >> "$PR_BODY_FILE"
printf "\n\n🤖 Generated with Claude Code\n" >> "$PR_BODY_FILE"

if [[ "${DRY_RUN:-0}" != "1" ]]; then
  gh pr create \
    --title "$PR_TITLE" \
    --body-file "$PR_BODY_FILE" \
    --base main \
    --head "$BRANCH_NAME" \
    --label skip-ci || echo "PR 创建失败，可能已存在"
else
  echo "DRY_RUN=1, skip gh pr create"
fi
