#!/bin/bash
# 获取东八区昨日8点到今日8点的 commit 范围
# 用法: ./get-daily-commit-range.sh [时区偏移小时数]
# 默认时区: +8 (东八区)

set -e

# 默认东八区 (+8)
TZ_OFFSET="${1:-+8}"

# 验证时区格式
if [[ ! "$TZ_OFFSET" =~ ^[+-][0-9]+$ ]]; then
    echo "错误: 时区格式不正确，应为 +/-数字，例如 +8 或 -5"
    exit 1
fi

echo "使用时区偏移: $TZ_OFFSET 小时"

# 获取当前时间（UTC）
NOW_UTC=$(date -u +"%Y-%m-%d %H:%M:%S")
echo "当前 UTC 时间: $NOW_UTC"

# 计算东八区时间
# 注意: GitHub Actions 默认是 UTC 时间，我们需要转换为东八区
if [[ "$TZ_OFFSET" == "+8" ]]; then
    # 东八区早上8点对应 UTC 时间 0点
    TODAY_8AM_UTC="$(date -u -d 'today 00:00:00' +'%Y-%m-%d %H:%M:%S')"
    YESTERDAY_8AM_UTC="$(date -u -d 'yesterday 00:00:00' +'%Y-%m-%d %H:%M:%S')"
else
    # 对于其他时区，需要更复杂的计算
    echo "警告: 非东八区时区可能需要调整计算逻辑"
    # 这里简化处理，假设时区偏移为整数小时
    OFFSET_HOURS=${TZ_OFFSET#+}  # 移除 + 号
    OFFSET_HOURS=${OFFSET_HOURS#-}  # 移除 - 号

    # 计算今天早上8点对应的 UTC 时间
    if [[ "$TZ_OFFSET" == +* ]]; then
        # 东区时间比 UTC 晚，早上8点对应 UTC 时间 (8 - 偏移) 点
        UTC_HOUR=$((8 - OFFSET_HOURS))
        if [ $UTC_HOUR -lt 0 ]; then
            UTC_HOUR=$((UTC_HOUR + 24))
            DAY_ADJUST="-1 day"
        else
            DAY_ADJUST=""
        fi
    else
        # 西区时间比 UTC 早，早上8点对应 UTC 时间 (8 + 偏移) 点
        UTC_HOUR=$((8 + OFFSET_HOURS))
        if [ $UTC_HOUR -ge 24 ]; then
            UTC_HOUR=$((UTC_HOUR - 24))
            DAY_ADJUST="+1 day"
        else
            DAY_ADJUST=""
        fi
    fi

    TODAY_8AM_UTC="$(date -u -d "today $UTC_HOUR:00:00 $DAY_ADJUST" +'%Y-%m-%d %H:%M:%S')"
    YESTERDAY_8AM_UTC="$(date -u -d "yesterday $UTC_HOUR:00:00 $DAY_ADJUST" +'%Y-%m-%d %H:%M:%S')"
fi

echo "今日8点 (UTC): $TODAY_8AM_UTC"
echo "昨日8点 (UTC): $YESTERDAY_8AM_UTC"

# 查找对应时间点的 commit
# 使用 --before 和 --after 参数，并取第一个匹配的 commit
OLD_COMMIT=$(git rev-list -n 1 --before="$YESTERDAY_8AM_UTC" HEAD 2>/dev/null || true)
NEW_COMMIT=$(git rev-list -n 1 --before="$TODAY_8AM_UTC" HEAD 2>/dev/null || true)

if [ -z "$OLD_COMMIT" ]; then
    echo "警告: 未找到昨日8点之前的提交，使用最早提交"
    OLD_COMMIT=$(git rev-list --max-parents=0 HEAD)
fi

if [ -z "$NEW_COMMIT" ]; then
    echo "警告: 未找到今日8点之前的提交，使用最新提交"
    NEW_COMMIT=$(git rev-parse HEAD)
fi

echo "起始提交 (昨日8点前): $OLD_COMMIT"
echo "结束提交 (今日8点前): $NEW_COMMIT"

# 检查是否有提交
if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
    echo "警告: 起始和结束提交相同，可能没有新提交"
    # 如果没有新提交，我们使用 HEAD~1 作为起始，HEAD 作为结束
    # 这样可以生成一个空的报告
    COMMIT_COUNT=$(git rev-list --count "$OLD_COMMIT".."$NEW_COMMIT" 2>/dev/null || echo "0")
    if [ "$COMMIT_COUNT" -eq 0 ]; then
        echo "没有新提交，使用 HEAD 和 HEAD~1"
        OLD_COMMIT=$(git rev-parse HEAD~1 2>/dev/null || git rev-list --max-parents=0 HEAD)
        NEW_COMMIT=$(git rev-parse HEAD)
    fi
fi

# 输出结果
echo "::set-output name=old_commit::$OLD_COMMIT"
echo "::set-output name=new_commit::$NEW_COMMIT"
echo "::set-output name=old_commit_short::$(git rev-parse --short "$OLD_COMMIT")"
echo "::set-output name=new_commit_short::$(git rev-parse --short "$NEW_COMMIT")"

# 计算提交数量
COMMIT_COUNT=$(git rev-list --count "$OLD_COMMIT".."$NEW_COMMIT" 2>/dev/null || echo "0")
echo "::set-output name=commit_count::$COMMIT_COUNT"

echo "提交范围: $OLD_COMMIT..$NEW_COMMIT ($COMMIT_COUNT 个提交)"