# ==============================================================================
# ClearHealth — Multi-stage Docker Build
# ==============================================================================
# Build stages: base -> deps -> builder -> runner
# Only dist/ and production node_modules are copied to the final image.
# Dev dependencies are NOT included in the production image.
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

# Generate Prisma client before building so TypeScript can resolve @prisma/client types
RUN npx prisma generate

RUN npm run build

# --- Production runner ---
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 clearhealth && \
    adduser --system --uid 1001 clearhealth

# Copy build artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Install production dependencies only (no dev dependencies in production image)
COPY --from=deps /app/package.json /tmp/package.json
COPY --from=deps /app/package-lock.json* /tmp/
COPY --from=deps /app/packages/api/package.json /tmp/packages/api/
COPY --from=deps /app/packages/shared/package.json /tmp/packages/shared/
RUN cd /tmp && npm ci --omit=dev --ignore-scripts && \
    cp -r /tmp/node_modules /app/node_modules && \
    cp -r /tmp/packages/api/node_modules /app/packages/api/node_modules 2>/dev/null || true && \
    cp -r /tmp/packages/shared/node_modules /app/packages/shared/node_modules 2>/dev/null || true && \
    rm -rf /tmp/node_modules /tmp/packages /tmp/package*.json

# Generate Prisma client in production image
RUN npx prisma generate

USER clearhealth
EXPOSE 3001

# Health check: verify the API responds on /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "packages/api/dist/index.js"]
