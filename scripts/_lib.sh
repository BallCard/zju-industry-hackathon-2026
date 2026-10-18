#!/usr/bin/env bash
# 被其他脚本 source
root="$(git rev-parse --git-common-dir)"; root="$(cd "$root/.." && pwd)"   # 主检出目录
me="$(git config hack.owner || true)"
need_me() { [ -n "$me" ] || { echo "先运行: bash scripts/setup.sh <name>"; exit 1; }; }
need_origin() { git remote get-url origin >/dev/null 2>&1 || { echo "没有 origin 远端，先建远端并 git remote add origin"; exit 1; }; }
