#!/usr/bin/env bash
# ============================================================
# Railway 一键部署脚本 — rummikub-server
# 用法:
#   RAILWAY_TOKEN=<你的token> bash scripts/deploy_rummikub_railway.sh
# ============================================================
set -euo pipefail

TOKEN="${RAILWAY_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "❌ 请先设置 RAILWAY_TOKEN 环境变量"
  echo "   用法: RAILWAY_TOKEN=xxx bash scripts/deploy_rummikub_railway.sh"
  exit 1
fi

CORS="${CORS_ORIGINS:-https://suwan-five.vercel.app}"
API="https://backboard.railway.com/graphql/v2"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRV_DIR="$ROOT_DIR/rummikub-server"

echo "═══ 第 1 步：验证 token ═══"
curl -s --request POST "$API" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"query":"query { me { name email } }"}' | head -c 300
echo ""

echo ""
echo "═══ 第 2 步：创建 project ═══"
PROJECT_JSON=$(curl -s --request POST "$API" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"query":"mutation ($input: ProjectCreateInput!) { projectCreate(input: $input) { id } }","variables":{"input":{"name":"rummikub-server"}}}')
PROJECT_ID=$(echo "$PROJECT_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['projectCreate']['id'])")
echo "project id: $PROJECT_ID"

echo ""
echo "═══ 第 3 步：创建 service ═══"
SERVICE_JSON=$(curl -s --request POST "$API" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"query\":\"mutation (\\\$input: ServiceCreateInput!) { serviceCreate(input: \\\$input) { id } }\",\"variables\":{\"input\":{\"projectId\":\"$PROJECT_ID\",\"name\":\"rummikub\"}}}")
SERVICE_ID=$(echo "$SERVICE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['serviceCreate']['id'])")
echo "service id: $SERVICE_ID"

echo ""
echo "═══ 第 4 步：设置 CORS_ORIGINS 变量 ═══"
curl -s --request POST "$API" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"query\":\"mutation (\\\$input: VariableCollectionInput!) { variableCollection(input: \\\$input) { id } }\",\"variables\":{\"input\":{\"serviceId\":\"$SERVICE_ID\",\"environmentId\":\"production\",\"variables\":[{\"name\":\"CORS_ORIGINS\",\"value\":\"$CORS\"}]}}}" | head -c 300
echo ""

echo ""
echo "═══ 第 5 步：从本地上传部署 (railway up) ═══"
cd "$SRV_DIR"
export RAILWAY_TOKEN="$TOKEN"
"$ROOT_DIR/node_modules/.bin/railway" up --detach 2>&1 | tail -15 || {
  echo ""
  echo "⚠️ railway up 失败，尝试备用方式：railway deploy"
  "$ROOT_DIR/node_modules/.bin/railway" deploy 2>&1 | tail -15
}

echo ""
echo "═══ 部署完成 ═══"
echo "接下来："
echo "  1. 打开 Railway 面板找到该 service 的公开域名（*.up.railway.app）"
echo "  2. 把域名告诉我，或自己填到 Vercel 的 NEXT_PUBLIC_RUMMIKUB_SERVER 环境变量"
echo "  3. 验证: curl -X POST https://<域名>/games/Rummikub/create -H 'Content-Type: application/json' -d '{\"numPlayers\":2}'"
