"""
API Routes - FastAPI endpoints for the Deep Research System.

This module contains all HTTP endpoints, separated from business logic.
"""

from fastapi import APIRouter
from fastapi.responses import FileResponse
from pathlib import Path

from app.core.config import settings
from app.core.ollama_adapter import get_adapter
from app.core.checkpointer import get_checkpointer
from app.models.state import ResearchState, create_initial_state, get_progress_percent

# Create router for API endpoints
router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    """
    Health check endpoint for Docker and monitoring.
    
    Returns:
        dict: Service health status
    """
    return {
        "status": "healthy",
        "version": "0.1.0",
        "services": {
            "api": "online",
        },
        "config": {
            "ollama_model": settings.OLLAMA_MODEL,
            "max_iterations": settings.MAX_ITERATIONS,
        },
    }


@router.get("/api/status")
async def api_status() -> dict:
    """
    Detailed API status with all connected services.
    
    Returns:
        dict: Feature implementation status
    """
    return {
        "status": "operational",
        "version": "0.1.0",
        "features": {
            "planner": "not_implemented",
            "source_finder": "not_implemented",
            "summarizer": "not_implemented",
            "reviewer": "not_implemented",
            "writer": "not_implemented",
        },
    }


@router.post("/api/test/ollama")
async def test_ollama() -> dict:
    """
    Test endpoint to verify Ollama adapter works.
    
    Returns:
        dict: Test result with model response
    """
    try:
        adapter = get_adapter()
        response = await adapter.generate_simple(
            prompt="Say 'Ollama adapter working' and nothing else.",
            enable_thinking=False,
        )
        return {
            "status": "success",
            "model": response.get("model"),
            "response": response.get("response"),
            "total_duration_ms": response.get("total_duration", 0) / 1_000_000,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


@router.post("/api/test/state")
async def test_state() -> dict:
    """
    Test endpoint to verify ResearchState works.
    
    Returns:
        dict: Sample state structure
    """
    state = create_initial_state(
        query="What are the latest developments in quantum computing?",
        session_id="test-session-001",
    )
    
    return {
        "status": "success",
        "state": {
            "query": state["query"],
            "session_id": state["session_id"],
            "progress_percent": get_progress_percent(state),
            "plan_count": len(state.get("plan", [])),
            "sources_count": len(state.get("sources", [])),
        },
        "message": "ResearchState typed dict working correctly",
    }


@router.get("/api/checkpointer/stats")
async def checkpointer_stats() -> dict:
    """
    Get SQLite checkpointer statistics.
    
    Returns:
        dict: Database statistics
    """
    try:
        checkpointer = get_checkpointer()
        stats = checkpointer.get_stats()
        return {
            "status": "success",
            "stats": stats,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }
