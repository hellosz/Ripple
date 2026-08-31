FROM node:22-slim

WORKDIR /app
RUN corepack enable

# workspace 清单先行以利用层缓存
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/contract/package.json packages/contract/package.json
COPY packages/skill-core/package.json packages/skill-core/package.json
RUN pnpm install --frozen-lockfile --filter @ripple/server...

COPY packages/contract packages/contract
COPY packages/skill-core packages/skill-core
COPY apps/server apps/server

ENV NODE_ENV=production
EXPOSE 8000
# 迁移随部署前置执行：docker run ... pnpm --dir apps/server db:upgrade
CMD ["pnpm", "--dir", "apps/server", "exec", "tsx", "src/index.ts"]
