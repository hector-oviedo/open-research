# =============================================================================
# Ollama Service - ROCm with Auto-Model Download
# =============================================================================
# Base: Ollama ROCm image
# Features: Automatic model download on first start

FROM ollama/ollama:rocm

# Install dependencies for health checks and process management
RUN apt-get update && apt-get install -y --no-install-recommends \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Default model to auto-download (can be overridden)
ENV OLLAMA_MODEL=gpt-oss:20b \
    OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_NUM_PARALLEL=1 \
    OLLAMA_MAX_LOADED_MODELS=1 \
    HSA_OVERRIDE_GFX_VERSION=11.5.1 \
    HIP_VISIBLE_DEVICES=0 \
    AMD_SERIALIZE_KERNEL=1

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose Ollama port
EXPOSE 11434

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD ollama list > /dev/null 2>&1 || exit 1

# Use custom entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
