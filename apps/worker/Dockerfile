FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @godmodeprod/worker...

FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
COPY pnpm-workspace.yaml package.json ./

WORKDIR /app/apps/worker
CMD ["npx", "tsx", "src/index.ts"]
