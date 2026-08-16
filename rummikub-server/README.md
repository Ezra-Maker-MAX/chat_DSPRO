# Rummikub online server (boardgame.io)

独立联机服务，供 chatmosphere 游戏广场的「拉密」真联机对战使用。

## 本地运行

```bash
cd rummikub-server
npm install
CORS_ORIGINS="http://localhost:3000" npm start   # 监听 :9119
```

## 部署到 Railway（推荐）

### 方式一：GitHub 集成（网页操作）
1. 把仓库推到 GitHub（本目录已随 `chatmosphere` 一起推送）
2. Railway → **New Project** → **Deploy from GitHub repo** → 选 `Ezra-Maker-MAX/chat_DSPRO`
3. 服务设置：
   - **Root Directory**：`rummikub-server`
   - 构建：NIXPACKS 自动识别 Node（已配 `railway.json`）
   - 启动命令：`npm start`（自动）
4. 添加环境变量：
   - `CORS_ORIGINS`：填你的 Vercel 前端域名，如 `https://suwan-five.vercel.app,https://chat-dspro.vercel.app`
   - 如遇跨域问题再加 `PORT`（Railway 自动注入）
5. 部署完成后拿到服务 URL（形如 `https://rummikub-production-xxxx.up.railway.app`）

### 方式二：Token + 一键脚本（AI 自动部署）
1. Railway → **Account Settings → Tokens → Generate** 创建 account token
2. 把 token 给 AI，AI 执行：

```bash
RAILWAY_TOKEN=<你的token> bash scripts/deploy_rummikub_railway.sh
```

脚本会自动：验证 token → 创建 project → 创建 service → 设置 `CORS_ORIGINS` → `railway up` 上传部署。完成后把 Railway 面板里的公开域名填到 Vercel 的 `NEXT_PUBLIC_RUMMIKUB_SERVER`。

## 前端连接

在 Vercel 项目设置里加环境变量：

```
NEXT_PUBLIC_RUMMIKUB_SERVER=https://你的railway域名
```

前端 `RummikubGame` 会自动用这个地址连 socket（生产）；本地开发默认 `http://localhost:9119`。

## 说明

- 存储：内存（重启丢对局）。休闲够用；要持久化可换 boardgame.io 的 FlatFile/DB storage。
- 端口：`process.env.PORT || 9119`。
