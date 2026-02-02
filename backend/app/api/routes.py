"""
API Routes - FastAPI endpoints for the Deep Research System.

This module contains all HTTP endpoints, separated from business logic.
"""

from fastapi import APIRouter
from fastapi.responses import FileResponse
from pathlib import Path

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
