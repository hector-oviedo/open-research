#!/bin/bash
set -e

# Configuration
MODEL_NAME="${OLLAMA_MODEL:-gpt-oss:20b}"

echo "========================================"
echo "  Ollama Auto-Model Loader"
echo "  Model: $MODEL_NAME"
echo "========================================"

# Start Ollama server in background (suppress logs)
echo "[1/4] Starting Ollama server..."
/bin/ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!

# Wait for server to be ready (check port 11434)
echo "[2/4] Waiting for server to be ready..."
for i in {1..60}; do
    if timeout 2 bash -c 'cat < /dev/null > /dev/tcp/localhost/11434' 2>/dev/null; then
        echo "       ✓ Server is ready!"
        break
    fi
    sleep 1
    if [ $i -eq 60 ]; then
        echo "       ✗ Timeout waiting for server"
        tail -20 /tmp/ollama.log
        exit 1
    fi
done

# Wait a bit more for full initialization
sleep 2

# Check if model exists using ollama CLI
echo "[3/4] Checking if model exists: $MODEL_NAME..."
if /bin/ollama list 2>/dev/null | grep -q "$MODEL_NAME"; then
    echo "       ✓ Model already exists!"
else
    echo "       ⊘ Model not found. Downloading..."
    echo "       This may take several minutes (~13.8GB)..."
    echo ""
    
    # Pull model
    /bin/ollama pull "$MODEL_NAME" 2>&1 | tee /tmp/pull.log
    
    echo ""
    echo "       ✓ Download complete!"
fi

# Verify model is available
echo "[4/4] Verifying model..."
if /bin/ollama list 2>/dev/null | grep -q "$MODEL_NAME"; then
    echo "       ✓ Model is ready to use!"
else
    echo "       ✗ Model not found after download attempt"
fi

echo "========================================"
echo "  Ollama is running with GPU support"
echo "  Model: $MODEL_NAME"
echo "========================================"
echo ""
echo "To monitor logs: docker logs -f deepresearch-ollama"
echo ""

# Keep showing server logs
tail -f /tmp/ollama.log &
TAIL_PID=$!

# Keep container running
wait $OLLAMA_PID
kill $TAIL_PID 2>/dev/null || true
