# syntax=docker/dockerfile:1.7
# ============================================================
# MONEY MIND — Web (Next.js standalone)
# ============================================================

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat tini curl \
 && corepack enable \
 && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter "./apps/web" build

FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache tini curl \
 && addgroup -S nodejs -g 1001 \
 && adduser -S nextjs -u 1001 -G nodejs
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js `output: 'standalone'` deve estar habilitado em next.config.js
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./public
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
