#!/usr/bin/env bash
# 一键安装 ripple CLI：把本地 cli 链接到全局 bin
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "→ 安装 ripple CLI ..."
npm link

echo ""
echo "✓ 安装完成。现在可以使用 ripple 命令："
echo "  ripple --help        查看帮助"
echo "  ripple login         登录（浏览器授权）"
echo "  ripple search <q>    搜索 skill"
echo "  ripple install <n>   安装 skill"
