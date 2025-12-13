# Stage 1: Build Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client

# Install dependencies
COPY client/package*.json ./
RUN npm install

# Copy source and build
COPY client/ ./
RUN npm run build

# Stage 2: Setup Server
FROM node:20-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./
RUN npm install --production && npm cache clean --force

# Copy server source code
COPY server/ ./

# Copy client build artifacts to server's public directory
# The server is configured to serve static files from 'public'
COPY --from=client-builder /app/client/dist ./public

# Install Docker CLI (required for server to interact with Docker)
RUN apk add --no-cache docker-cli docker-cli-compose

# Expose ports
# 9000: Web UI / API
# 9002: Agent
EXPOSE 9000 9002

# Environment variables
ENV PORT=9000
ENV NODE_ENV=production

# Start command
CMD ["node", "index.js"]
