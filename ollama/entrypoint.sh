#!/bin/bash
set -e

# =============================================================================
# Ollama Auto-Model Loader Entrypoint
# =============================================================================
# Responsibilities:
# 1. Start Ollama server
# 2. Wait for server readiness
# 3. Auto-download configured model if not present
# 4. Keep container running

MODEL_NAME="${OLLAMA_MODEL:-gpt-oss:20b}"
OLLAMA_PID=""

log() {
    echo "[ollama] $1"
}

# Cleanup function
cleanup() {
    log "Shutting down..."
    if [ -n "$OLLAMA_PID" ]; then
        kill "$OLLAMA_PID" 2>/dev/null || true
        wait "$OLLAMA_PID" 2>/dev/null || true
    fi
}
trap cleanup SIGTERM SIGINT

log "========================================"
log "Model: $MODEL_NAME"
log "========================================"

# Start Ollama server in background
log "Starting Ollama server..."
/bin/ollama serve &
OLLAMA_PID=$!

# Wait for server to be ready
log "Waiting for server to be ready..."
for i in {1..60}; do
    if timeout 2 bash -c 'cat < /dev/null > /dev/tcp/localhost/11434' 2>/dev/null; then
        log "✓ Server is ready"
        break
    fi
    sleep 1
    if [ $i -eq 60 ]; then
        log "✗ Timeout waiting for server"
        exit 1
    fi
done

sleep 2

# Check and download model if needed
log "Checking model: $MODEL_NAME..."
if /bin/ollama list 2>/dev/null | grep -q "$MODEL_NAME"; then
    log "✓ Model already exists"
else
    log "⊘ Model not found. Downloading (~13.8GB)..."
    /bin/ollama pull "$MODEL_NAME"
    log "✓ Download complete"
fi

# Verify
if /bin/ollama list 2>/dev/null | grep -q "$MODEL_NAME"; then
    log "✓ Model ready"
else
    log "✗ Model verification failed"
    exit 1
fi

log "========================================"
log "Ollama running with GPU support"
log "Model: $MODEL_NAME"
log "========================================"

# Wait for server process
wait $OLLAMA_PID
