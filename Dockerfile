# ================================================================================
# PRODUCTION DOCKERFILE - LumenCRM/FLUOW AI
# Optimizado para Fly.io
# ================================================================================

# ------------------------------------------------------------------------------
# BUILDER STAGE - Build frontend
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ------------------------------------------------------------------------------
# PRODUCTION STAGE
# ------------------------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/components ./components
COPY --from=builder /app/services ./services
COPY --from=builder /app/types.ts ./
COPY --from=builder /app/vite.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/index.html ./
COPY --from=builder /app/.env.example ./.env.example
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx

RUN mkdir -p /app/auth_info_baileys && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", "--import", "tsx", "server.ts"]
