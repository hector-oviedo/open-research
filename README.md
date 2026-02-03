# Deep Research System

A production-grade local deep research application using multi-agent orchestration with LangGraph and Ollama. Features a real-time Mission Control dashboard for monitoring AI agents as they research any topic.

![Architecture](https://img.shields.io/badge/Architecture-Orchestrator_Workers-blue)
![LLM](https://img.shields.io/badge/LLM-gpt--oss:20b-green)
![GPU](https://img.shields.io/badge/GPU-AMD_ROCm-orange)
![Stack](https://img.shields.io/badge/Stack-FastAPI_React_LangGraph-purple)

---

## 🚀 Quick Start (How to Use)

### 1. Start the System

```bash
# Clone the repository
git clone <repo>
cd open-research

# Copy environment template
cp .env.example .env

# Start all services
docker compose up --build -d

# Monitor Ollama model download (first start only)
docker logs -f deepresearch-ollama
# Wait for: "✓ Model is ready to use!"
```

### 2. Access the Dashboard

| Service | URL | Description |
|---------|-----|-------------|
| **🎛️ Mission Control** | http://localhost:5173 | **Main Dashboard** - Start researching here! |
| **API Docs** | http://localhost:8000/custom-docs | Bootstrap-styled documentation |
| **Backend API** | http://localhost:8000 | FastAPI endpoints |

### 3. Run Your First Research

1. Open http://localhost:5173
2. Enter a research query (e.g., "Latest AI developments in healthcare 2024")
3. Press **Ctrl+Enter** or click the ▶️ button
4. Watch the 5 agents work in real-time!

### 4. Understanding the Dashboard

**Agent Pipeline** (left sidebar): Watch which agent is currently working
- 🔵 **Planner** - Breaks query into sub-questions
- 🟢 **Finder** - Discovers sources via DuckDuckGo
- 🟡 **Summarizer** - Compresses content 10:1
- 🟣 **Reviewer** - Checks for gaps and iterates
- 🩷 **Writer** - Synthesizes final report

**Event Log** (right): Real-time SSE stream showing agent activity

**When Complete:**
- Report appears with Executive Summary, Sections, and Sources
- Reports render with beautiful **Markdown styling** (headers, lists, code blocks, tables)
- Download as **Markdown** or **PDF**
- Click any completed session in the sidebar to view past reports

**Real-time Features:**
- **Finder sources stream as discovered** - watch sources appear one-by-one
- **Processing animation** on active agents
- **Automatic retry** if summarizer finds no key facts (resilience)

---

## ⚠️ The Ollama Drama (Important!)

### Stop Local Ollama First!

The Docker container needs exclusive access to port 11434. Stop your local Ollama:

```bash
# Stop local Ollama service
sudo systemctl stop ollama
# or
pkill ollama

# Verify port is free
sudo lsof -i :11434  # Should return nothing
```

**Why?** The container uses ROCm GPU drivers and the local Ollama doesn't have access to the same GPU libraries inside Docker.

### Port Already in Use?

```bash
# Find and kill the process
sudo lsof -i :11434
sudo kill -9 <PID>
```

---

## 🐳 Docker Management

### Start Everything
```bash
docker compose up --build -d
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker logs -f deepresearch-ollama
docker logs -f deepresearch-backend
docker logs -f deepresearch-frontend
```

### Stop Everything
```bash
docker compose down

# Also remove data volumes:
docker compose down -v
```

### Rebuild After Code Changes
```bash
# Frontend only
docker compose build frontend
docker compose up -d frontend

# Backend only
docker compose build backend
docker compose up -d backend
```

### Check Health
```bash
curl http://localhost:8000/health
curl http://localhost:5173
```

---

## 🏗️ Architecture

### System Overview

![Architecture Diagram](docs/diagrams/architecture_diagram.png)

*The system has 3 layers: Dashboard (React), Backend API (FastAPI + LangGraph), and Storage/Inference (SQLite + Ollama)*

### The 5 Agents

| Agent | Color | Role | Description |
|-------|-------|------|-------------|
| 🔵 **Planner** | Blue | Query Decomposition | Breaks complex queries into 6-8 sub-questions |
| 🟢 **Finder** | Green | Source Discovery | Discovers diverse sources via DuckDuckGo (streams in real-time) |
| 🟡 **Summarizer** | Amber | Content Compression | 10:1 compression with key facts extraction (auto-retry on failure) |
| 🟣 **Reviewer** | Violet | Quality Control | Detects gaps, triggers iteration loops |
| 🩷 **Writer** | Pink | Report Synthesis | Professional report with validated citations |

**Resilience Features:**
- **Finder Streaming**: Sources appear one-by-one as discovered with clickable link icons
- **Summarizer Retry**: If 0 key facts extracted, automatically extends search and retries
- **Citation Validation**: All citations are validated against actual sources (no hallucination)
- **Complete Source Metadata**: Each source includes id, url, title, domain, reliability, and confidence

### Data Flow

```
User Query → Planner → Finder → Summarizer → [0 facts?] → Finder (retry)
                                              ↓
                                         Reviewer → [Gaps?] → Planner (iterate)
                                              ↓
                                           Writer → Report
```

**Resilience Loops:**
- **Summarizer Retry:** If 0 key facts extracted, loops back to Finder for extended search (max 2 retries)
- **Reviewer Iteration:** If gaps detected and max iterations not reached, loops back to Planner for deeper investigation

---

## 🎛️ Dashboard Features

### Real-time Monitoring
- **Agent Pipeline Visualization** - See which agent is active with processing animation
- **Progress Bar** - Overall completion percentage with shimmer effect
- **Event Log** - Live SSE events with color-coding per agent
- **Finder Streaming** - Watch sources appear one-by-one as discovered
- **Session List** - Auto-refreshing list of all research sessions

### Report Viewer
- Executive Summary with **Markdown rendering**
- Multiple detailed sections with **formatted headers, lists, code blocks**
- **Sources displayed as bullet list** with complete metadata
- Source citations with reliability ratings (High/Medium/Low)
- **Clickable link icons** next to each source for quick access
- **Validated citations** - all citation numbers match actual sources
- Confidence assessment
- Download as Markdown or PDF

### Source Link Component
Throughout the dashboard, sources are displayed with:
- **Favicon** from the source domain
- **Clickable title** that opens the source in a new tab
- **Domain name** extracted from URL
- **Reliability badge** (High/Medium/Low)
- **External link icon** on hover

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl + Enter` | Start research |

---

## 🧪 API Testing

### Health Checks
```bash
# System health
curl http://localhost:8000/health

# API status
curl http://localhost:8000/api/status
```

### Test Individual Agents
```bash
# Test Planner Agent
curl -X POST http://localhost:8000/api/test/planner

# Test Source Finder
curl -X POST http://localhost:8000/api/test/finder

# Test Full Graph (takes 5-10 min)
curl -X POST http://localhost:8000/api/test/graph
```

### Research API
```bash
# Start research
curl -X POST http://localhost:8000/api/research/start \
  -H "Content-Type: application/json" \
  -d '{"query": "AI in healthcare 2024"}'

# Stream events (SSE)
curl http://localhost:8000/api/research/{session_id}/events

# Stop research
curl -X POST http://localhost:8000/api/research/{session_id}/stop

# Get report
curl http://localhost:8000/api/research/sessions/{session_id}/report
```

---

## 🔧 GPU Configuration (Strix Halo / RDNA 3.5)

For AMD Ryzen AI Max+ 395 (gfx1151):

```bash
# Find your GPU group IDs
getent group video | cut -d: -f3   # e.g., 44
getent group render | cut -d: -f3  # e.g., 991

# Copy and edit environment
cp .env.example .env
# Edit VIDEO_GID and RENDER_GID to match your system
```

Your `.env` should contain:
```env
VIDEO_GID=44
RENDER_GID=991
HSA_OVERRIDE_GFX_VERSION=11.5.1
```

Verify GPU detection:
```bash
docker logs deepresearch-ollama | grep "inference compute"
# Should show: library=ROCm compute=gfx1151
```

---

## 📁 Project Structure

```
open-research/
├── docker-compose.yml          # Service orchestration
├── .env.example                # Configuration template
├── start.sh                    # Automation script
│
├── ollama/                     # Ollama service with auto-download
│   ├── Dockerfile
│   └── entrypoint.sh
│
├── backend/                    # FastAPI + LangGraph
│   ├── app/
│   │   ├── api/routes.py       # HTTP endpoints + SSE
│   │   ├── core/
│   │   │   ├── config.py       # Pydantic Settings
│   │   │   ├── graph.py        # LangGraph workflow
│   │   │   └── research_manager.py
│   │   └── agents/             # 5 AI agents
│   │       ├── planner.py
│   │       ├── finder.py
│   │       ├── summarizer.py
│   │       ├── reviewer.py
│   │       └── writer.py
│   └── main.py
│
├── frontend/                   # React + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── AgentStatus.tsx
│       │   ├── ReportViewer.tsx
│       │   ├── SessionList.tsx
│       │   ├── SourceLink.tsx      # Reusable source link component
│       │   ├── SourceViewer.tsx    # Source grid display
│       │   ├── TraceLog.tsx
│       │   └── ui/                 # Atomic UI components
│       │       ├── Button.tsx
│       │       ├── Card.tsx
│       │       └── Badge.tsx
│       ├── hooks/
│       │   ├── useAgentStream.ts   # SSE streaming
│       │   └── useResearch.ts      # Research API calls
│       ├── stores/
│       │   └── researchStore.ts    # Zustand state
│       ├── types/
│       │   └── index.ts            # TypeScript types
│       └── pages/
│           └── MissionControl.tsx  # Main dashboard
│
└── agent/                      # Project tracking
    ├── PLAN.md
    ├── PLAN2.md
    ├── PLAN3.md
    ├── PLAN4.md
    └── MEMORY.md
```

---

## 🔧 Troubleshooting

### ROCm GPU Not Detected
```bash
# Check GPU visibility
rocm-smi

# Verify Ollama logs
docker logs deepresearch-ollama | grep -i "rocm\|gpu"
```

### Model Download Stuck
```bash
# Monitor download progress
docker logs -f deepresearch-ollama

# Restart Ollama container
docker compose restart ollama
```

### Frontend Not Loading
```bash
# Check logs
docker logs deepresearch-frontend

# Rebuild
docker compose build frontend
docker compose up -d frontend
```

### Backend Errors
```bash
# Check logs
docker logs deepresearch-backend

# Test API directly
curl http://localhost:8000/health
```

---

## 📊 Development Status

**🎉 PROJECT COMPLETE - All 6 Phases Delivered!**

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | ✅ Complete | Infrastructure: Docker, GPU support, auto-download |
| **Phase 1** | ✅ Complete | Backend Core: FastAPI, config, Ollama adapter |
| **Phase 2** | ✅ Complete | Planner Agent + LangGraph setup |
| **Phase 3** | ✅ Complete | All 5 Agents + Full Graph Assembly |
| **Phase 4** | ✅ Complete | Streaming & Interruption (SSE) |
| **Phase 5** | ✅ Complete | Frontend Dashboard |
| **Phase 6** | ✅ Complete | Polish: Report viewer, sessions, PDF export |

---

## 📜 License

MIT
