# =============================================================================
# Backend Dockerfile - FastAPI + LangGraph (Ubuntu-based)
# =============================================================================

FROM ubuntu:22.04

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install Python and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3-pip \
    python3.12-venv \
    curl \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for python
RUN ln -sf /usr/bin/python3.12 /usr/bin/python3 \
    && ln -sf /usr/bin/python3 /usr/bin/python

# Upgrade pip
RUN python -m pip install --upgrade pip

# Install uv for fast Python package management
RUN pip install uv

# Set work directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies using uv
RUN uv pip install --system -e .

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
