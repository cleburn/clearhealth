# ==============================================================================
# ClearHealth — Multi-stage Docker Build
# ==============================================================================
# Build stages: base -> deps -> builder -> runner
# Only dist/ and production node_modules are copied to the final image.
# ==============================================================================

# --- Base stage ---
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- Dependencies stage ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --ignore-scripts

# --- Builder stage ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN npm run build

# --- Production runner ---
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 clearhealth && \
    adduser --system --uid 1001 clearhealth

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

USER clearhealth
EXPOSE 3001

CMD ["node", "packages/api/dist/index.js"]
