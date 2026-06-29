#!/usr/bin/env bash
# P9 回滚:把 projecta-current symlink 指回上一发布 + 重启旧栈。
# (DB 如需回滚:mysql ... InfiniteChat < projecta-runtime/backups/InfiniteChat-pre-p9-*.sql,人工确认后执行。)
# 用法:runtime-rollback.sh [--restore-env]
set -euo pipefail
RUNTIME="$HOME/projecta-runtime"
BACKUP="$RUNTIME/backups"

TARGET_FILE="$(ls -t "$BACKUP"/symlink-target-*.txt 2>/dev/null | head -1)"
[ -n "$TARGET_FILE" ] || { echo "找不到 symlink 备份记录($BACKUP/symlink-target-*.txt),无法自动回滚"; exit 1; }
OLD="$(cat "$TARGET_FILE")"
[ -d "$OLD" ] || { echo "旧发布目录不存在: $OLD"; exit 1; }

echo "== 停当前栈 =="; bash "$RUNTIME/stop-apps.sh" all || true; sleep 3
[ -f "$RUNTIME/run/agent-app.pid" ] && kill "$(cat "$RUNTIME/run/agent-app.pid" 2>/dev/null || echo 0)" 2>/dev/null || true

if [ "${1:-}" = "--restore-env" ]; then
  local_chat="$(ls -t "$BACKUP"/chat.env.* 2>/dev/null | head -1)"
  local_agent="$(ls -t "$BACKUP"/agent.env.* 2>/dev/null | head -1)"
  [ -n "$local_chat" ] && cp -f "$local_chat" "$RUNTIME/chat.env" && echo "  恢复 chat.env ← $local_chat"
  [ -n "$local_agent" ] && cp -f "$local_agent" "$RUNTIME/agent.env" && echo "  恢复 agent.env ← $local_agent"
fi

echo "== symlink 指回 $OLD =="; ln -sfn "$OLD" "$HOME/projecta-current"
echo "== 起旧栈 =="; bash "$RUNTIME/start-apps.sh" all
echo "[done] 已回滚到 $OLD"
