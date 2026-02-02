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
from app.core.graph import get_research_graph
from app.agents.planner import get_planner
from app.agents.finder import get_finder
from app.agents.summarizer import get_summarizer
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
            "planner": "implemented",
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
        stats = await checkpointer.get_stats()
        return {
            "status": "success",
            "stats": stats,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


@router.post("/api/test/planner")
async def test_planner() -> dict:
    """
    Test endpoint to verify Planner Agent works.
    
    Returns:
        dict: Test result with generated research plan
    """
    try:
        planner = get_planner()
        result = await planner.plan(
            "What are the latest developments in quantum computing?"
        )
        
        plan = result.get("plan", [])
        return {
            "status": "success",
            "query": "What are the latest developments in quantum computing?",
            "sub_questions_count": len(plan),
            "sub_questions": [
                {
                    "id": sq.get("id"),
                    "question": sq.get("question"),
                    "status": sq.get("status"),
                }
                for sq in plan
            ],
            "message": f"Planner generated {len(plan)} sub-questions",
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


@router.post("/api/test/graph")
async def test_graph() -> dict:
    """
    Test endpoint to verify LangGraph works end-to-end.
    
    Runs a complete research session through the graph.
    
    Returns:
        dict: Test result with final state
    """
    try:
        import uuid
        
        graph = get_research_graph()
        session_id = f"test-{uuid.uuid4().hex[:8]}"
        
        result = await graph.run(
            query="Recent AI developments in healthcare",
            session_id=session_id,
        )
        
        plan = result.get("plan", [])
        
        return {
            "status": "success",
            "session_id": session_id,
            "query": result.get("query"),
            "sub_questions_count": len(plan),
            "sub_questions": [
                {
                    "id": sq.get("id"),
                    "question": sq.get("question"),
                }
                for sq in plan[:3]  # Show first 3
            ],
            "message": f"Graph executed successfully with {len(plan)} sub-questions",
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


@router.post("/api/test/finder")
async def test_finder() -> dict:
    """
    Test endpoint to verify Source Finder Agent works.
    
    Returns:
        dict: Test result with discovered sources
    """
    try:
        finder = get_finder()
        result = await finder.find_sources(
            sub_question="What are the latest breakthroughs in fusion energy 2024-2025?",
            sub_question_id="sq-test",
        )
        
        sources = result.get("sources", [])
        return {
            "status": "success",
            "sub_question": "What are the latest breakthroughs in fusion energy 2024-2025?",
            "sources_count": len(sources),
            "sources": [
                {
                    "id": s.get("id"),
                    "title": s.get("title", "Untitled")[:80] + "...",
                    "domain": s.get("domain"),
                    "confidence": s.get("confidence"),
                }
                for s in sources[:5]  # Show first 5
            ],
            "message": f"Finder discovered {len(sources)} sources",
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


@router.post("/api/test/summarizer")
async def test_summarizer() -> dict:
    """
    Test endpoint to verify Summarizer Agent works.
    
    Returns:
        dict: Test result with compressed summary
    """
    try:
        summarizer = get_summarizer()
        
        # Sample long content about quantum computing
        sample_content = """
        Quantum computing has seen remarkable breakthroughs in 2024. In February, researchers at MIT 
        demonstrated a 1000-qubit processor with 99.9% fidelity, marking a significant milestone in 
        the race toward fault-tolerant quantum computers. This breakthrough, published in Nature, 
        shows that superconducting qubits can maintain coherence for up to 500 microseconds, 
        a 10x improvement over previous records.
        
        Meanwhile, IBM announced their new Quantum System Two, featuring 133 qubits and improved 
        error correction capabilities. The system, unveiled at their annual Quantum Summit, 
        represents a $100 million investment in quantum infrastructure. IBM claims this system 
        can solve certain optimization problems 1000x faster than classical supercomputers.
        
        Google Quantum AI team also reported progress in quantum error correction. Their latest 
        research, appearing in Science, demonstrates logical qubit lifetimes exceeding 1 second 
        using surface code error correction. This is crucial for practical quantum computing.
        
        Commercial applications are emerging too. Volkswagen announced partnerships with quantum 
        startups to optimize traffic flow in major cities. Early trials in Lisbon showed 15% 
        reduction in traffic congestion using quantum algorithms.
        """
        
        result = await summarizer.summarize(
            content=sample_content,
            sub_question="What were the major quantum computing breakthroughs in 2024?",
            source_title="Quantum Computing 2024 Review",
            source_url="https://example.com/quantum-2024",
        )
        
        findings = result.get("findings", {})
        
        return {
            "status": "success",
            "sub_question": "What were the major quantum computing breakthroughs in 2024?",
            "summary": findings.get("summary", "")[:300] + "...",
            "key_facts_count": len(findings.get("key_facts", [])),
            "compression_ratio": findings.get("compression_ratio", 0),
            "relevance_score": findings.get("relevance_score", 0),
            "word_count": findings.get("word_count", {}),
            "message": "Summarizer completed successfully",
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }
