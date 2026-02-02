# =============================================================================
# Frontend Dockerfile - Vite + React + TypeScript (Ubuntu-based)
# =============================================================================

FROM ubuntu:22.04

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js 20 and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Verify node installation
RUN node --version && npm --version

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files (except node_modules which is in .dockerignore)
COPY . .

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5173 || exit 1

# Default command (overridden in docker-compose for dev mode)
CMD ["npm", "run", "dev"]
