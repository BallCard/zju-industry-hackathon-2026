#!/usr/bin/env bash
# 下载并解压官方 ima skill 到 vendor/ima-skill（已 gitignore；不提交第三方代码）。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
[ -f vendor/ima-skill/ima_api.cjs ] && { echo "已存在 vendor/ima-skill"; exit 0; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
curl -fsSL -m 120 -o "$tmp/s.zip" https://app-dl.ima.qq.com/skills/ima-skills-1.1.10.zip
unzip -q "$tmp/s.zip" -d "$tmp/x"
mkdir -p vendor && cp -r "$tmp/x/ima-skill" vendor/ima-skill
find vendor -name ".DS_Store" -delete; rm -rf vendor/ima-skill/.history
echo "OK vendor/ima-skill (v$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' vendor/ima-skill/meta.json))"
