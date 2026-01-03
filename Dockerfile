# Build stage for the app
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
RUN pnpm build

# Final stage - use Qdrant as base and add Node
FROM qdrant/qdrant:v1.13.2

# Install Node.js and supervisor
RUN apt-get update && apt-get install -y \
    curl \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Setup app
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Supervisor config
RUN mkdir -p /etc/supervisor/conf.d
RUN echo '[supervisord]\n\
nodaemon=true\n\
user=root\n\
\n\
[program:qdrant]\n\
command=/qdrant/qdrant\n\
directory=/qdrant\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
\n\
[program:app]\n\
command=/usr/bin/node /app/dist/index.js\n\
directory=/app\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
startretries=10\n\
startsecs=3\n\
' > /etc/supervisor/conf.d/services.conf

# Expose ports
EXPOSE 3000 6333

ENV NODE_ENV=production
ENV QDRANT_URL=http://localhost:6333

CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
