# Deep Research System

A production-grade local deep research application using multi-agent orchestration with LangGraph and Ollama.

## Architecture

**Inference Engine:** Ollama (gpt-oss:20b) with ROCm support for AMD GPUs  
**Pattern:** Orchestrator-Workers (Star Topology)  
**Stack:**
- **Backend:** Python 3.12+ / FastAPI / LangGraph / SQLite (Ubuntu-based)
- **Frontend:** React / Vite / TypeScript / TailwindCSS / Framer Motion
- **Infrastructure:** Docker Compose

## Agent Grid

1. **Planner** - Decomposes queries into structured research plans
2. **Source Finder** - Discovers diverse sources with domain diversity
3. **Summarizer** - Compresses content (10:1 ratio)
4. **Reviewer** - Detects gaps and triggers iteration loops
5. **Writer** - Synthesizes final reports with citations

---

## 🚀 Development Stages

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | ✅ Complete | Project infrastructure, Docker setup, GPU support |
| **Phase 1** | ✅ Complete | Backend core: structure, config, adapter, state, checkpointer, docs |
| **Phase 2** | ✅ Complete | First Agent (Planner) - Query decomposition + LangGraph setup |
| **Phase 3** | 🔄 In Progress | Remaining Agents (Source Finder ✅, Summarizer, Reviewer, Writer) |
| **Phase 4** | ⏳ Pending | Streaming & Interruption (SSE, stop/resume) |
| **Phase 5** | ⏳ Pending | Frontend Dashboard (Mission Control) |
| **Phase 6** | ⏳ Pending | Integration & Polish |

---

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

# Start all services (Ollama auto-downloads model on first start)
docker compose up --build -d

# Monitor Ollama model download
docker logs -f deepresearch-ollama

# Check status
curl http://localhost:8000/health
```

### Access

| Service | URL | Description |
|---------|-----|-------------|
| **API Docs (Custom)** | http://localhost:8000/custom-docs | Bootstrap-styled documentation |
| **API Docs (Swagger)** | http://localhost:8000/docs | Auto-generated OpenAPI docs |
| **Backend API** | http://localhost:8000 | FastAPI endpoints |
| **Ollama** | http://localhost:11434 | Inference API |
| **Frontend** | http://localhost:5173 | React Dashboard (Phase 5) |

### Stop Everything

```bash
docker compose down

# To also remove data volumes:
docker compose down -v
```

---

## 🧪 Testing What We Have

### Current Working Features (Phase 1 Complete)

```bash
# 1. Health Check
curl http://localhost:8000/health
# Response: {"status":"healthy","version":"0.1.0","config":{"ollama_model":"gpt-oss:20b",...}}

# 2. API Status
curl http://localhost:8000/api/status
# Response: {"status":"operational","features":{"planner":"not_implemented",...}}

# 3. Checkpointer Stats
curl http://localhost:8000/api/checkpointer/stats
# Response: {"status":"success","stats":{"sessions":0,"checkpoints":0,...}}

# 4. Test Ollama Adapter (GPU Inference)
curl -X POST http://localhost:8000/api/test/ollama
# Response: {"status":"success","model":"gpt-oss:20b","response":"Ollama adapter working",...}

# 5. Test Research State
curl -X POST http://localhost:8000/api/test/state
# Response: {"status":"success","state":{"query":"...","progress_percent":0,...}}

# 6. Test LangGraph (end-to-end)
curl -X POST http://localhost:8000/api/test/graph
# Response: {"status":"success","sub_questions_count":6,...}

# 7. Test Source Finder Agent
curl -X POST http://localhost:8000/api/test/finder
# Response: {"status":"success","sources_count":10,...}

# 8. Test Summarizer Agent
curl -X POST http://localhost:8000/api/test/summarizer
# Response: {"status":"success","key_facts_count":5,...}
```

### Verify GPU is Working

```bash
# Check Ollama logs for GPU detection
docker logs deepresearch-ollama | grep "inference compute"
# Should show: library=ROCm compute=gfx1151

# Test GPU inference directly
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "gpt-oss:20b", "prompt": "Say hello GPU", "stream": false}'
```

### View Documentation

1. **Bootstrap Custom Docs:** http://localhost:8000/custom-docs
   - Beautiful styled documentation
   - Agent grid overview
   - API endpoint reference

2. **Swagger OpenAPI:** http://localhost:8000/docs
   - Interactive API explorer
   - Try endpoints directly
   - Schema definitions

---

## 📁 Project Structure

```
open-research/
├── docker-compose.yml          # Service orchestration
├── .env                        # Environment configuration
├── .env.example                # Configuration template
├── start.sh                    # Automation script
├── ollama/                     # Ollama service (auto-download)
│   ├── Dockerfile
│   └── entrypoint.sh
├── backend/                    # FastAPI backend (Phase 1 ✅)
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py       # HTTP endpoints
│   │   ├── core/
│   │   │   ├── config.py       # Pydantic Settings
│   │   │   ├── ollama_adapter.py   # VLLM singleton
│   │   │   ├── checkpointer.py     # LangGraph persistence
│   │   │   └── graph.py            # LangGraph workflow definition
│   │   ├── agents/             # LangGraph nodes (Phase 2 🔄)
│   │   │   ├── prompts/        # Agent prompts as .md files
│   │   │   │   └── planner.md  # Planner agent prompt
│   │   │   └── planner.py      # Agent logic
│   │   └── models/
│   │       └── state.py        # ResearchState TypedDict
│   ├── docs/
│   │   └── index.html          # Bootstrap documentation
│   ├── main.py                 # Application entry
│   └── pyproject.toml          # Dependencies
├── frontend/                   # React dashboard (Phase 5 ⏳)
└── agent/
    ├── PLAN.md                 # Execution roadmap
    └── MEMORY.md               # Technical decisions
```

---

## Alternative: Using the Launch Script

```bash
# Make executable and run
chmod +x start.sh
./start.sh up        # Start everything
./start.sh status    # Check status
./start.sh logs      # View logs
./start.sh down      # Stop everything
```

---

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

### Model Auto-Download

The Ollama container now **auto-downloads** the model on first start. To monitor:
```bash
docker logs -f deepresearch-ollama
# Wait for: "✓ Model is ready to use!"
```

Or check if model is ready:
```bash
curl http://localhost:11434/api/tags | grep gpt-oss
```

---

## Development Status

**Current Phase:** Phase 2 - The First Agent (Planner) 🔄

**Latest Updates:**
- ✅ Phase 2 Complete: Planner Agent + LangGraph setup working
- ✅ Phase 3 Progress: Source Finder ✅, Summarizer ✅ complete
- ✅ Source Finder: Discovers 10 diverse sources via DuckDuckGo
- ✅ Summarizer: 10:1 compression with key facts extraction
- ✅ All Libraries Up-to-Date (verified Feb 2026)
- 🔄 Phase 3 Next: Reviewer Agent

See `/agent/PLAN.md` for detailed execution roadmap.

## License

MIT
