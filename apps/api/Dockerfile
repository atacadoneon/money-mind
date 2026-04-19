# syntax=docker/dockerfile:1.7
# ============================================================
# MONEY MIND — API (NestJS)
# Multi-stage, non-root, Node 20 Alpine
# ============================================================

ARG NODE_VERSION=20-alpine

# ----------- Stage 1: base -----------
FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat tini curl \
 && corepack enable \
 && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# ----------- Stage 2: deps -----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ----------- Stage 3: build -----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter "./apps/api" build \
 && pnpm --filter "./apps/api" --prod deploy /tmp/api-prod

# ----------- Stage 4: runner -----------
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache tini curl \
 && addgroup -S nodejs -g 1001 \
 && adduser -S nestjs -u 1001 -G nodejs
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3333

COPY --from=build --chown=nestjs:nodejs /tmp/api-prod/dist ./dist
COPY --from=build --chown=nestjs:nodejs /tmp/api-prod/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /tmp/api-prod/package.json ./package.json

USER nestjs
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
