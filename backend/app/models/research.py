"""
Research API Models

Typed contracts for research session lifecycle and runtime options.
"""

from __future__ import annotations

from typing import Literal

from pydantic import AliasChoices, BaseModel, Field


ReportLength = Literal["short", "medium", "long"]


class ResearchOptions(BaseModel):
    """
    Runtime controls for a research session.

    These values are user-facing and passed from frontend to backend, then
    enforced by graph/agents.
    """

    max_iterations: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Maximum reviewer-planner loop iterations.",
        validation_alias=AliasChoices("max_iterations", "maxIterations"),
    )
    max_sources: int = Field(
        default=12,
        ge=3,
        le=40,
        description="Maximum total discovered sources.",
        validation_alias=AliasChoices("max_sources", "maxSources"),
    )
    max_sources_per_question: int = Field(
        default=4,
        ge=1,
        le=12,
        description="Maximum retained sources per sub-question.",
        validation_alias=AliasChoices("max_sources_per_question", "maxSourcesPerQuestion"),
    )
    search_results_per_query: int = Field(
        default=5,
        ge=1,
        le=15,
        description="Raw search hits requested for each generated search query.",
        validation_alias=AliasChoices("search_results_per_query", "searchResultsPerQuery"),
    )
    source_diversity: bool = Field(
        default=True,
        description="When enabled, limit duplicated domains in source selection.",
        validation_alias=AliasChoices("source_diversity", "sourceDiversity"),
    )
    report_length: ReportLength = Field(
        default="medium",
        description="Target report size for writer synthesis.",
        validation_alias=AliasChoices("report_length", "reportLength"),
    )
    include_session_memory: bool = Field(
        default=True,
        description="Use recent completed sessions as memory context for planning.",
        validation_alias=AliasChoices("include_session_memory", "includeSessionMemory"),
    )
    session_memory_limit: int = Field(
        default=3,
        ge=0,
        le=8,
        description="How many prior completed sessions to include as context.",
        validation_alias=AliasChoices("session_memory_limit", "sessionMemoryLimit"),
    )
    summarizer_source_limit: int = Field(
        default=6,
        ge=1,
        le=20,
        description="Maximum sources sent to summarizer for extraction.",
        validation_alias=AliasChoices("summarizer_source_limit", "summarizerSourceLimit"),
    )


class StartResearchRequest(BaseModel):
    """Request body for starting a new research session."""

    query: str = Field(
        min_length=3,
        max_length=2000,
        description="Primary user research query.",
    )
    options: ResearchOptions = Field(
        default_factory=ResearchOptions,
        description="Runtime controls for this research execution.",
    )


class StartResearchResponse(BaseModel):
    """Response after session creation."""

    status: Literal["started"]
    session_id: str
    query: str
    options: ResearchOptions
    stream_url: str
    stop_url: str
    status_url: str


class StopResearchResponse(BaseModel):
    """Stop endpoint response."""

    status: Literal["stopped", "not_found_or_completed"]
    session_id: str
    message: str


class DeleteSessionResponse(BaseModel):
    """Delete endpoint response."""

    status: Literal["deleted", "not_found", "running"]
    session_id: str
    message: str


class SessionSummary(BaseModel):
    """Session list item."""

    session_id: str
    query: str
    status: Literal["running", "completed", "stopped", "error"]
    created_at: str
    updated_at: str
    has_report: bool
    options: ResearchOptions


class SessionsListResponse(BaseModel):
    """Session listing response."""

    status: Literal["success"]
    count: int
    sessions: list[SessionSummary]
