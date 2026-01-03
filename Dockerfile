# Build stage for the app
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
RUN pnpm build

# Final stage - combine Qdrant + App
FROM qdrant/qdrant:latest AS qdrant

FROM node:22-alpine AS runner

# Install curl for healthchecks and supervisor for process management
RUN apk add --no-cache curl supervisor

# Copy Qdrant binary and config from official image
COPY --from=qdrant /qdrant/qdrant /usr/local/bin/qdrant
COPY --from=qdrant /qdrant/config /qdrant/config

# Setup app
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Supervisor config to run both processes
RUN mkdir -p /etc/supervisor.d
COPY <<EOF /etc/supervisor.d/services.ini
[supervisord]
nodaemon=true
user=root

[program:qdrant]
command=/usr/local/bin/qdrant
directory=/qdrant
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:app]
command=node /app/dist/index.js
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
startsecs=5
EOF

# Qdrant data volume
VOLUME /qdrant/storage

# Expose ports: 3000 for API, 6333 for Qdrant (optional direct access)
EXPOSE 3000 6333

ENV NODE_ENV=production
ENV QDRANT_URL=http://localhost:6333

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
