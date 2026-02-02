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

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Import API routers
from app.api.routes import router as api_router

# Initialize FastAPI app
app = FastAPI(
    title="Deep Research API",
    description="Multi-Agent Deep Research System with LangGraph & Ollama",
    version="0.1.0",
)

# Mount API routes
app.include_router(api_router)

# Mount docs directory for static files
docs_path = Path(__file__).parent / "docs"
if docs_path.exists():
    app.mount("/docs-static", StaticFiles(directory=str(docs_path)), name="docs-static")


@app.get("/", response_class=HTMLResponse)
async def root() -> str:
    """Root endpoint redirects to API docs."""
    return """
    <!DOCTYPE html>
    <html>
        <head>
            <title>Deep Research API</title>
            <meta http-equiv="refresh" content="0; url=/docs" />
        </head>
        <body>
            <p>Redirecting to <a href="/docs">API Documentation</a>...</p>
        </body>
    </html>
    """


@app.get("/docs", response_class=FileResponse)
async def custom_docs() -> FileResponse:
    """Serve custom API documentation."""
    docs_file = Path(__file__).parent / "docs" / "index.html"
    return FileResponse(str(docs_file))


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
