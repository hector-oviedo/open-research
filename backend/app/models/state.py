"""
Research State - LangGraph State Definitions

This module defines the TypedDict structures for the research graph state.
These types define what data flows through the graph and is persisted.

State Flow:
1. User Query -> Planner -> ResearchPlan
2. ResearchPlan -> SourceFinder -> RawSources
3. RawSources -> Summarizer -> Findings
4. Findings -> Reviewer -> GapReport or Approved
5. Approved Findings -> Writer -> FinalReport
"""

from typing import TypedDict, Annotated, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone


def merge_lists(left: list, right: list) -> list:
    """Merge two lists, removing duplicates by ID."""
    result = {item.get("id", str(i)): item for i, item in enumerate(left)}
    for item in right:
        item_id = item.get("id")
        if item_id:
            result[item_id] = item
        else:
            result[str(len(result))] = item
    return list(result.values())


# ============================================================================
# Core State Types
# ============================================================================

class Source(TypedDict, total=False):
    """
    A discovered source with metadata.
    
    Attributes:
        id: Unique identifier
        url: Source URL
        title: Document title
        content: Raw or summarized content
        domain: Website domain (for diversity tracking)
        confidence: Relevance score (0-1)
        timestamp: When discovered
    """
    id: str
    url: str
    title: str
    content: str
    domain: str
    confidence: float
    reliability: str
    timestamp: str


class SubQuestion(TypedDict, total=False):
    """
    A decomposed sub-question from the research plan.
    
    Attributes:
        id: Unique identifier
        question: The sub-question text
        status: pending, researching, completed, failed
        sources: List of sources found for this question
        findings: Summarized findings
    """
    id: str
    question: str
    status: str  # "pending", "researching", "completed", "failed"
    sources: list[Source]
    findings: str


class GapReport(TypedDict, total=False):
    """
    Reviewer's assessment of research coverage.
    
    Attributes:
        has_gaps: Whether gaps were found
        gaps: List of identified gaps
        recommendations: Suggested new sub-questions
        confidence: Overall confidence in current findings (0-1)
    """
    has_gaps: bool
    gaps: list[str]
    recommendations: list[str]
    confidence: float


class TraceEvent(TypedDict, total=False):
    """
    A single event in the research trace log.
    
    Used for real-time monitoring and debugging.
    
    Attributes:
        timestamp: ISO timestamp
        node: Which agent/node (planner, finder, etc.)
        event: Event type (start, complete, error)
        details: Additional context
    """
    timestamp: str
    node: str
    event: str
    details: dict


# ============================================================================
# Main Graph State
# ============================================================================

class ResearchState(TypedDict, total=False):
    """
    The complete state of a research session.
    
    This is the primary state that flows through the LangGraph.
    All nodes read from and write to this state.
    
    Attributes:
        # Query
        query: Original user query
        
        # Planning
        plan: List of sub-questions to research
        
        # Accumulated Findings
        sources: All discovered sources
        findings: Summarized findings by sub-question
        
        # Review
        gaps: Reviewer's gap assessment
        iteration: Number of planning iterations
        
        # Output
        final_report: The synthesized final report
        
        # Metadata
        session_id: Unique research session ID
        started_at: ISO timestamp when research started
        trace: Event log for monitoring/debugging
        error: Any error that occurred
    """
    # Query
    query: str
    
    # Planning
    plan: Annotated[list[SubQuestion], merge_lists]
    
    # Accumulated Findings
    sources: Annotated[list[Source], merge_lists]
    findings: Annotated[list[dict], merge_lists]
    
    # Review
    gaps: GapReport | None
    iteration: int
    
    # Output
    final_report: dict | None
    
    # Metadata
    session_id: str
    started_at: str
    status: str
    options: dict
    session_memory: list[dict]
    needs_finder_retry: bool
    finder_retry_count: int
    trace: Annotated[list[TraceEvent], lambda x, y: x + y]
    error: str | None


# ============================================================================
# Node-Specific Output Types (for type safety in agents)
# ============================================================================

class PlannerOutput(TypedDict):
    """Output from the Planner agent."""
    plan: list[SubQuestion]


class SourceFinderOutput(TypedDict):
    """Output from the Source Finder agent."""
    sources: list[Source]


class SummarizerOutput(TypedDict):
    """Output from the Summarizer agent."""
    findings: dict  # sub_question_id -> summarized content


class ReviewerOutput(TypedDict):
    """Output from the Reviewer agent."""
    gap_report: GapReport


class WriterOutput(TypedDict):
    """Output from the Writer agent."""
    final_report: dict


# ============================================================================
# State Helpers
# ============================================================================

def create_initial_state(query: str, session_id: str) -> ResearchState:
    """
    Create a fresh ResearchState for a new research session.
    
    Args:
        query: Original user query
        session_id: Unique session identifier
    
    Returns:
        ResearchState: Initialized state
    """
    return ResearchState(
        query=query,
        plan=[],
        sources=[],
        findings=[],
        gaps=None,
        iteration=0,
        final_report=None,
        session_id=session_id,
        started_at=datetime.now(timezone.utc).isoformat(),
        status="idle",
        options={},
        session_memory=[],
        needs_finder_retry=False,
        finder_retry_count=0,
        trace=[],
        error=None,
    )


def add_trace_event(
    state: ResearchState,
    node: str,
    event: str,
    details: dict | None = None,
) -> ResearchState:
    """
    Add a trace event to the state.
    
    Args:
        state: Current research state
        node: Which agent/node
        event: Event type
        details: Additional context
    
    Returns:
        ResearchState: Updated state with new trace event
    """
    event_data = TraceEvent(
        timestamp=datetime.now(timezone.utc).isoformat(),
        node=node,
        event=event,
        details=details or {},
    )
    if "trace" not in state or state["trace"] is None:
        state["trace"] = []
    state["trace"].append(event_data)
    return state


def get_progress_percent(state: ResearchState) -> int:
    """
    Calculate research progress as percentage.
    
    Args:
        state: Current research state
    
    Returns:
        int: Progress percentage (0-100)
    """
    if not state.get("plan"):
        return 0
    
    completed = sum(
        1 for sq in state["plan"]
        if sq.get("status") == "completed"
    )
    total = len(state["plan"])
    
    # If we have a final report, we're 100% done
    if state.get("final_report"):
        return 100
    
    # Otherwise calculate based on sub-questions
    return int((completed / total) * 100) if total > 0 else 0
