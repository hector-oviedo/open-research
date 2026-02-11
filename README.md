# Deep Research System

Production-oriented local deep-research platform with:
- multi-agent orchestration (`Planner -> Finder -> Summarizer -> Reviewer -> Writer`)
- durable session + document persistence (SQLite on host-mounted path)
- real-time streaming execution telemetry (SSE)
- frontend Mission Control workspace + dedicated result screen
- configurable per-run research controls (iterations, sources, memory, report length)

## What Is Implemented

- Backend: FastAPI + LangGraph orchestration + Ollama adapter
- Frontend: React + Vite + Zustand + Framer Motion
- Persistence:
  - session snapshots
  - event stream history
  - final report documents (JSON + Markdown)
- Session memory:
  - new runs can use recent completed sessions as planning context
- UI:
  - Light/Dark mode toggle
  - bounded workspace panels (sidebar + event log aligned height)
  - separate full result screen
- Testing:
  - backend test suite under `backend/tests/`

## Architecture

### Runtime flow

1. User starts research from frontend.
2. Backend creates a session and starts graph execution.
3. Graph emits events through SSE (`/api/research/{session_id}/events`).
4. Backend persists events + session state in SQLite.
5. Writer produces final report.
6. Backend persists report as:
   - `report_json`
   - `report_markdown`
7. Frontend opens dedicated result screen for final report.

### Agent flow

- `Planner`: decomposes query into sub-questions
- `Finder`: discovers diverse sources
- `Summarizer`: extracts evidence from fetched content
- `Reviewer`: detects gaps and decides iteration
- `Writer`: synthesizes final report with citations

## Repository Layout

```text
backend/
  app/
    agents/
    api/
    core/
    models/
  tests/
frontend/
  src/
    components/
    hooks/
    pages/
    stores/
    types/
ollama/
agent/
```

## Prerequisites

- Docker + Docker Compose
- AMD GPU + ROCm setup (for current Ollama container profile)
- Free ports: `5173`, `8000`, `11434`

## Environment Configuration

1. Copy env template:

```bash
cp .env.example .env
```

2. Set GPU group IDs for your machine:

```bash
getent group video | cut -d: -f3
getent group render | cut -d: -f3
```

3. Configure persistence path (host machine):

```env
# Host path for Ollama model data
OLLAMA_MODELS_DIR=./data/ollama
OLLAMA_MODEL=gpt-oss:20b
OLLAMA_CONTEXT_LENGTH=8192
OLLAMA_KEEP_ALIVE=5m

# Host path for backend persistent data
BACKEND_DATA_DIR=./data/backend

# Path used inside backend container
DATABASE_PATH=/app/data/research.db
```

`docker-compose.yml` maps:

- `${OLLAMA_MODELS_DIR}:/ollama-models`
- `${BACKEND_DATA_DIR}:/app/data`

This keeps both Ollama models and backend sessions/documents on your PC between restarts/redeploys.

## Quick Start

```bash
docker compose up --build -d
```

Open:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Custom API docs: `http://localhost:8000/custom-docs`

Health checks:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/status
```

## Research Runtime Options

Per-session options are sent in `POST /api/research/start`.

| Option | Type | Purpose |
|---|---|---|
| `maxIterations` | int | Max reviewer/planner loops |
| `maxSources` | int | Global source cap |
| `maxSourcesPerQuestion` | int | Cap per sub-question |
| `searchResultsPerQuery` | int | Search hits requested per query |
| `sourceDiversity` | bool | Domain diversity enforcement |
| `reportLength` | `short|medium|long` | Writer target length |
| `includeSessionMemory` | bool | Include prior completed sessions |
| `sessionMemoryLimit` | int | Max prior sessions loaded |
| `summarizerSourceLimit` | int | Max sources deep-summarized |

### Example request

```bash
curl -X POST http://localhost:8000/api/research/start \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Latest practical advances in retrieval-augmented generation",
    "options": {
      "maxIterations": 4,
      "maxSources": 16,
      "maxSourcesPerQuestion": 5,
      "searchResultsPerQuery": 6,
      "sourceDiversity": true,
      "reportLength": "long",
      "includeSessionMemory": true,
      "sessionMemoryLimit": 3,
      "summarizerSourceLimit": 8
    }
  }'
```

## API Surface

### Core endpoints

- `GET /health`
- `GET /api/status`
- `POST /api/research/start`
- `GET /api/research/{session_id}/events` (SSE)
- `POST /api/research/{session_id}/stop`
- `GET /api/research/{session_id}/status`
- `GET /api/research/sessions`
- `GET /api/research/sessions/{session_id}/report`
- `GET /api/research/sessions/{session_id}/documents`
- `GET /api/research/sessions/{session_id}/documents/{document_id}`

### Development diagnostics endpoints

The project currently includes `api/test/*` endpoints for validating individual agents and streaming behavior in local/dev environments.

## Frontend UX Notes

- Workspace preserves:
  - sidebar with agent progress + sessions
  - top progress tracker
- Event log panel height is bounded to align with sidebar height.
- Result report is rendered on a separate screen (`ResultScreen`) instead of inline with running telemetry.
- Theme supports light/dark mode with persistent preference.

## Persistence Model

SQLite tables:

- `sessions`
- `session_events`
- `session_documents`

Saved documents per completed session:

- `<session_id>-json` (`report_json`)
- `<session_id>-markdown` (`report_markdown`)

## Ollama Data Migration (If You Previously Used Named Volume)

If older runs used Docker named volume `open-research_ollama_data`, migrate once:

```bash
mkdir -p ./data/ollama
docker run --rm \
  -v open-research_ollama_data:/from \
  -v "$(pwd)/data/ollama:/to" \
  alpine sh -c "cp -a /from/. /to/"
```

Then set `OLLAMA_MODELS_DIR=./data/ollama` in `.env` and start normally with the bind mount.

## Testing

### Backend tests (recommended inside Docker)

```bash
docker compose run --no-deps --rm backend sh -lc "pip install -e '.[dev]' && PYTHONPATH=/app pytest -q"
```

### Frontend production build

```bash
docker compose build frontend
```

## Operations

### Start / stop

```bash
docker compose up --build -d
docker compose down
```

### Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f ollama
```

### Rebuild one service

```bash
docker compose build backend
docker compose up -d backend
```

## Production Hardening Checklist

If deploying outside local machine scope, add:

- reverse proxy (TLS termination, request limits)
- authn/authz for API + UI
- stricter network boundaries (no public Ollama port)
- backup strategy for `${BACKEND_DATA_DIR}`
- centralized logging/metrics
- CORS policy tailored to your domain topology

## Known Constraints

- System is optimized for local/self-hosted operation.
- Ollama model and ROCm requirements are hardware-dependent.
- Full research latency depends on model speed and web source availability.

## License

Use according to your project license policy.
