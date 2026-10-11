# ---- 构建阶段 ----
FROM node:22-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
# sqlite3 为原生模块：优先下载预编译产物，失败时回退 node-gyp 编译
RUN npm ci

COPY tsconfig.json tsconfig.prod.json ./
COPY src ./src
RUN npm run build:prod

# ---- 运行阶段 ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# 不装 python3/make/g++：sqlite3 v6 是 N-API 模块，bookworm 上可直接取得预编译产物。
# 若某平台无对应预编译包导致 npm ci 失败，再补上构建工具（注意会显著拖长构建时间）：
#   RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# 数据目录需可写（SQLite 库与自动生成的加密密钥文件都落在这里）
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 默认以 HTTP 模式启动；凭据与令牌通过环境变量注入
CMD ["node", "dist/src/cli.js", "mcp", "-m", "http", "--host", "0.0.0.0"]
