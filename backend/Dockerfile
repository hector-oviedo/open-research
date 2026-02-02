# =============================================================================
# Backend Dockerfile - FastAPI + LangGraph (Ubuntu 24.04 + uv)
# =============================================================================

FROM ubuntu:24.04

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_NO_CACHE=1

# Install Python 3.12 and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for python
RUN ln -sf /usr/bin/python3.12 /usr/bin/python3 \
    && ln -sf /usr/bin/python3 /usr/bin/python

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

# Set work directory
WORKDIR /app

# Create virtual environment
RUN python3 -m venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies using uv into the virtual environment
RUN uv pip install -e .

# Copy project files
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command (overridden in docker-compose for dev mode)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
