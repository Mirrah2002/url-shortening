# Multi-stage production Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma7.config.ts ./

RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Production Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma artifacts and application code
COPY --from=builder /app/src/generated ./src/generated
COPY prisma ./prisma/
COPY prisma7.config.ts ./
COPY src ./src/

# Run as non-privileged user for security
USER node

EXPOSE 3000

CMD ["node", "src/server.js"]

