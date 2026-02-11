"""
Deep Research System - Backend API
FastAPI + LangGraph backend for multi-agent research orchestration.

Architecture:
- main.py: Application entry point, mounts routers
- app/api/: HTTP endpoints (routers)
- app/core/: Business logic (adapters, config)
- app/agents/: LangGraph agent implementations
- app/models/: Data models and state definitions
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Import API routers
from app.api.routes import router as api_router
from app.core.ollama_adapter import get_adapter
from app.core.persistence import get_session_persistence


@asynccontextmanager
async def lifespan(_: FastAPI):
    """
    Application lifespan hooks for graceful cleanup of shared clients.
    """
    yield
    try:
        await get_adapter().close()
    except Exception:
        pass
    try:
        await get_session_persistence().close()
    except Exception:
        pass

# Initialize FastAPI app
app = FastAPI(
    title="Deep Research API",
    description="Multi-Agent Deep Research System with LangGraph & Ollama",
    version="0.1.0",
    lifespan=lifespan,
)

# Mount API routes
app.include_router(api_router)

# Mount docs directory for static files
docs_path = Path(__file__).parent / "docs"
if docs_path.exists():
    app.mount("/docs-static", StaticFiles(directory=str(docs_path)), name="docs-static")


@app.get("/", response_class=HTMLResponse)
async def root() -> str:
    """Root endpoint redirects to custom docs."""
    return """
    <!DOCTYPE html>
    <html>
        <head>
            <title>Deep Research API</title>
            <meta http-equiv="refresh" content="0; url=/custom-docs" />
        </head>
        <body>
            <p>Redirecting to <a href="/custom-docs">API Documentation</a>...</p>
        </body>
    </html>
    """


@app.get("/custom-docs", response_class=FileResponse)
async def custom_docs() -> FileResponse:
    """Serve custom Bootstrap API documentation."""
    docs_file = Path(__file__).parent / "docs" / "index.html"
    return FileResponse(str(docs_file))


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )
