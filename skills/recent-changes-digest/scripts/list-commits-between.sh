#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/list-commits-between.sh <old_commit> <new_commit>

Prints all commits between the two references (exclusive of <old_commit>, inclusive of <new_commit>),
showing commit hashes, subjects, and per-file change stats via `git log --stat`.
Examples:
  scripts/list-commits-between.sh 49fed7ac HEAD
  scripts/list-commits-between.sh main feature/branch
USAGE
}

if [[ ${1-} == "" || ${2-} == "" ]]; then
  usage
  exit 1
fi

old_ref=$1
new_ref=$2

# Ensure we are inside the repo root
repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
cd "$repo_root"

echo "Listing commits between $old_ref and $new_ref" >&2

git log --oneline "$old_ref".."$new_ref"

echo "" >&2
echo "Detailed diff stats:" >&2

git log --stat --reverse "$old_ref".."$new_ref"
