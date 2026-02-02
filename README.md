# Deep Research System

A production-grade local deep research application using multi-agent orchestration with LangGraph and Ollama.

## Architecture

**Inference Engine:** Ollama (gpt-oss:20b) with ROCm support for AMD GPUs  
**Pattern:** Orchestrator-Workers (Star Topology)  
**Stack:**
- **Backend:** Python 3.12+ / FastAPI / LangGraph / SQLite (Ubuntu-based)
- **Frontend:** React / Vite / TypeScript / TailwindCSS / Framer Motion (Ubuntu-based)
- **Infrastructure:** Docker Compose

## Agent Grid

1. **Planner** - Decomposes queries into research plans
2. **Source Finder** - Discovers diverse sources
3. **Summarizer** - Compresses content (10:1 ratio)
4. **Reviewer** - Detects gaps and triggers iteration
5. **Writer** - Synthesizes final reports with citations

## Quick Start

### Prerequisites

- Docker & Docker Compose
- AMD GPU with ROCm drivers (for GPU acceleration)
- **For Strix Halo (Ryzen AI Max):** Ubuntu 25.04+ with kernel 6.12+
- Port 11434, 8000, 5173 available

### 🔧 GPU Configuration (Strix Halo / RDNA 3.5)

If you have an AMD Ryzen AI Max (Strix Halo) with RDNA 3.5 graphics, configure GPU access:

```bash
# Find your GPU group IDs
getent group video | cut -d: -f3   # e.g., 44
getent group render | cut -d: -f3  # e.g., 991

# Copy and edit environment
cp .env.example .env
# Edit VIDEO_GID and RENDER_GID to match your system
```

The `.env` file should contain:
```env
VIDEO_GID=44
RENDER_GID=991
HSA_OVERRIDE_GFX_VERSION=11.5.1
```

**Reference:** Configuration based on [ComfyUI Strix Halo Docker](https://github.com/hector-oviedo/comfyui-strix-docker)

### ⚠️ Important: Stop Local Ollama First!

If you have Ollama installed locally, stop it before running Docker:

```bash
# Stop local Ollama service
sudo systemctl stop ollama

# Or if running manually
pkill ollama

# Verify port is free
sudo lsof -i :11434  # Should return nothing
```

### Start the System

```bash
# Clone and setup
git clone <repo>
cd open-research

# Copy environment template
cp .env.example .env

# Start all services
docker compose up --build -d

# Pull the model (first time only, ~13.8GB)
docker exec -it deepresearch-ollama ollama pull gpt-oss:20b

# Check status
curl http://localhost:8000/health
```

### Access

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React Dashboard |
| Backend API | http://localhost:8000 | FastAPI |
| API Docs | http://localhost:8000/docs | Bootstrap Documentation |
| Ollama | http://localhost:11434 | Inference API |

### Stop Everything

```bash
docker compose down

# To also remove data volumes:
docker compose down -v
```

## Alternative: Using the Launch Script

```bash
# Make executable and run
chmod +x start.sh
./start.sh up        # Start everything
./start.sh status    # Check status
./start.sh logs      # View logs
./start.sh down      # Stop everything
```

## Troubleshooting

### Port 11434 Already in Use

**Error:** `failed to bind host port 0.0.0.0:11434/tcp: address already in use`

**Solution:** Stop local Ollama:
```bash
sudo systemctl stop ollama
# or
pkill ollama
```

### ROCm GPU Not Detected

**Error:** Ollama runs on CPU instead of GPU (`library=cpu`)

**Solution for Standard AMD GPUs:**
```bash
# Verify GPU is visible
rocm-smi

# Check render group ID
cat /etc/group | grep render

# Edit .env with your group IDs
VIDEO_GID=44
RENDER_GID=991
```

**Solution for Strix Halo (RDNA 3.5 / gfx1151):**
The docker-compose.yml already includes required settings:
- `privileged: true` - Required for GPU access
- `HSA_OVERRIDE_GFX_VERSION=11.5.1` - Strix Halo architecture
- `ipc: host` and `seccomp:unconfined` - Shared memory

Verify GPU detection:
```bash
docker logs deepresearch-ollama | grep "inference compute"
# Should show: library=ROCm compute=gfx1151
```

### Model Not Found

```bash
# Pull manually
docker exec -it deepresearch-ollama ollama pull gpt-oss:20b

# List available models
docker exec -it deepresearch-ollama ollama list
```

## Development Status

See `/agent/PLAN.md` for the execution roadmap.

## License

MIT
