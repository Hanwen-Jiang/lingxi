#!/usr/bin/env bash
# 把含本轮修复的源码同步到 E2E 构建副本并打包(不动线上 projecta-current)。
set -euo pipefail

SRC="${SRC:-/mnt/e/jhw/proj/chat}"            # 含本轮修复的源码(Windows 挂载)
E2E_SRC="${E2E_SRC:-$HOME/projecta-e2e/chat}" # E2E 构建副本(WSL 原生盘，构建更快)
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$PATH"

[ -d "$SRC" ] || { echo "源码目录不存在：$SRC"; exit 1; }
mkdir -p "$E2E_SRC"

echo "== 同步源码(排除 target/.git/.idea/e2e.env) =="
rsync -a --delete \
  --exclude target --exclude .git --exclude .idea --exclude 'e2e/e2e.env' \
  "$SRC"/ "$E2E_SRC"/

echo "== 打包(系统 mvn,clean 防陈旧胖 jar,跳测试;首次需联网拉依赖) =="
cd "$E2E_SRC"
# 必须 clean:rsync --exclude target 会保留旧 target,增量 package 可能产出"半胖"jar
# (曾导致 Auth 运行期 NoClassDefFound: ModelAndViewDefiningException)。clean 杜绝此坑。
mvn -B -DskipTests clean package

echo "== 构建完成。示例 jar：$(ls "$E2E_SRC/GateWay/target"/GateWay-*.jar | head -1) =="
