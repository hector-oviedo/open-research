"""
Research Manager

Session lifecycle orchestration with SSE streaming and durable persistence.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Awaitable, Callable

from app.core.config import settings
from app.core.graph import ResearchGraph, get_research_graph
from app.core.persistence import get_session_persistence, report_to_markdown
from app.models.research import ResearchOptions
from app.models.state import ResearchState, create_initial_state

logger = logging.getLogger(__name__)


GraphFactory = Callable[..., ResearchGraph]


def _utc_iso_now() -> str:
    """Return UTC timestamp in ISO format without tz suffix for storage compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


@dataclass
class ResearchSession:
    """In-memory runtime representation of one research session."""

    session_id: str
    state: ResearchState
    options: ResearchOptions
    task: asyncio.Task | None = None
    event_queue: asyncio.Queue[dict] = field(default_factory=asyncio.Queue)
    stop_event: asyncio.Event = field(default_factory=asyncio.Event)
    created_at: str = field(default_factory=_utc_iso_now)
    updated_at: str = field(default_factory=_utc_iso_now)

    def is_running(self) -> bool:
        return self.task is not None and not self.task.done()

    def is_stopped(self) -> bool:
        return self.stop_event.is_set() or self.state.get("status") == "stopped"


class ResearchManager:
    """
    Session manager with:
    - async graph execution
    - real-time event streaming
    - durable sqlite snapshots and reports
    """

    def __init__(
        self,
        graph_factory: GraphFactory = get_research_graph,
        persistence=None,
    ):
        self._sessions: dict[str, ResearchSession] = {}
        self._lock = asyncio.Lock()
        self._persistence = persistence or get_session_persistence()
        self._graph_factory = graph_factory
        self._initialized = False
        logger.info("ResearchManager initialized")

    async def _ensure_initialized(self) -> None:
        """Load persisted sessions once on first use."""

        if self._initialized:
            return

        async with self._lock:
            if self._initialized:
                return

            persisted = await self._persistence.list_sessions(limit=200)
            for record in persisted:
                state = ResearchState(record.state)
                state["query"] = record.query
                state["session_id"] = record.session_id
                restored_status = "stopped" if record.status == "running" else record.status
                state["status"] = restored_status
                state["options"] = record.options.model_dump(mode="json")
                if record.final_report and not state.get("final_report"):
                    state["final_report"] = record.final_report
                session = ResearchSession(
                    session_id=record.session_id,
                    state=state,
                    options=record.options,
                    created_at=record.created_at,
                    updated_at=record.updated_at,
                )
                if record.is_stopped or restored_status == "stopped":
                    session.stop_event.set()
                self._sessions[record.session_id] = session

            self._initialized = True
            logger.info("Loaded %s persisted sessions", len(self._sessions))

    async def start_research(self, query: str, session_id: str, options: ResearchOptions) -> str:
        """Create and start a research session."""

        await self._ensure_initialized()
        async with self._lock:
            state = create_initial_state(query, session_id)
            state["status"] = "running"
            state["options"] = options.model_dump(mode="json")

            session = ResearchSession(
                session_id=session_id,
                state=state,
                options=options,
            )
            self._sessions[session_id] = session

            await self._persistence.upsert_session(
                session_id=session_id,
                query=query,
                status="running",
                options=options,
                state=dict(state),
                created_at=session.created_at,
                updated_at=session.updated_at,
                is_stopped=False,
            )

            session.task = asyncio.create_task(
                self._run_graph(session, query),
                name=f"research-{session_id}",
            )
            logger.info("[Manager] Started research session: %s", session_id)
            return session_id

    async def _run_graph(self, session: ResearchSession, query: str) -> None:
        """Execute the graph for one session and emit/commit lifecycle events."""

        try:
            async def emit_from_graph(event: dict) -> None:
                await self._emit_event(session, event)

            # Runtime guardrail is environment-configurable for slower/deeper runs.
            timeout_seconds = max(60.0, float(settings.MAX_RESEARCH_TIME_MINUTES) * 60.0)

            memory_context: list[dict] = []
            if session.options.include_session_memory and session.options.session_memory_limit > 0:
                memory_context = await self._persistence.get_recent_completed_reports(
                    limit=session.options.session_memory_limit,
                    exclude_session_id=session.session_id,
                )

            graph = self._graph_factory(
                max_iterations=session.options.max_iterations,
                event_emitter=emit_from_graph,
            )

            await self._emit_event(
                session,
                {
                    "type": "research_started",
                    "message": f"Starting research on: {query[:120]}{'...' if len(query) > 120 else ''}",
                    "session_id": session.session_id,
                    "query": query,
                    "options": session.options.model_dump(mode="json"),
                    "timestamp": _utc_iso_now(),
                },
            )

            result = await graph.run(
                query=query,
                session_id=session.session_id,
                timeout=timeout_seconds,
                options=session.options,
                session_memory=memory_context,
            )

            session.state = result
            session.updated_at = _utc_iso_now()
            reported_status = str(result.get("status", "completed"))
            final_report_raw = result.get("final_report")
            final_report = final_report_raw if isinstance(final_report_raw, dict) else {}

            if session.is_stopped():
                session.state["status"] = "stopped"
                await self._persist_snapshot(session, status="stopped", is_stopped=True)
                await self._emit_event(
                    session,
                    {
                        "type": "research_stopped",
                        "session_id": session.session_id,
                        "timestamp": _utc_iso_now(),
                    },
                )
                return

            if reported_status == "error" or not final_report:
                error_message = str(
                    result.get("error")
                    or "Research graph finished without a valid final report."
                )
                session.state["status"] = "error"
                session.state["error"] = error_message
                await self._persist_snapshot(session, status="error", error=error_message)
                await self._emit_event(
                    session,
                    {
                        "type": "research_error",
                        "session_id": session.session_id,
                        "error": error_message,
                        "timestamp": _utc_iso_now(),
                    },
                )
                return

            session.state["status"] = "completed"
            await self._persist_snapshot(session, status="completed")

            markdown_report = report_to_markdown(final_report)
            await self._persistence.save_final_report(
                session_id=session.session_id,
                report=final_report,
                markdown_report=markdown_report,
                updated_at=session.updated_at,
            )
            await self._emit_event(
                session,
                {
                    "type": "research_completed",
                    "session_id": session.session_id,
                    "title": final_report.get("title", "Untitled"),
                    "word_count": final_report.get("word_count", 0),
                    "iterations": result.get("iteration", 0),
                    "final_report": final_report,
                    "timestamp": _utc_iso_now(),
                },
            )
        except asyncio.CancelledError:
            logger.info("[Manager] Research cancelled: %s", session.session_id)
            session.state["status"] = "stopped"
            session.updated_at = _utc_iso_now()
            await self._persist_snapshot(session, status="stopped", is_stopped=True)
            await self._emit_event(
                session,
                {
                    "type": "research_stopped",
                    "session_id": session.session_id,
                    "timestamp": _utc_iso_now(),
                },
            )
            raise
        except Exception as exc:
            logger.error("[Manager] Research failed: %s", exc)
            session.state["status"] = "error"
            session.state["error"] = str(exc)
            session.updated_at = _utc_iso_now()
            await self._persist_snapshot(session, status="error", error=str(exc))
            await self._emit_event(
                session,
                {
                    "type": "research_error",
                    "session_id": session.session_id,
                    "error": str(exc),
                    "timestamp": _utc_iso_now(),
                },
            )

    async def _persist_snapshot(
        self,
        session: ResearchSession,
        status: str,
        is_stopped: bool = False,
        error: str | None = None,
    ) -> None:
        session.state["status"] = status
        if error:
            session.state["error"] = error
        await self._persistence.upsert_session(
            session_id=session.session_id,
            query=session.state.get("query", ""),
            status=status,
            options=session.options,
            state=dict(session.state),
            created_at=session.created_at,
            updated_at=session.updated_at,
            is_stopped=is_stopped,
        )

    async def _emit_event(self, session: ResearchSession, event: dict) -> None:
        """Fan-out event to live queue and durable store."""

        payload = dict(event)
        payload.setdefault("session_id", session.session_id)
        payload.setdefault("timestamp", _utc_iso_now())

        try:
            await session.event_queue.put(payload)
            await self._persistence.append_event(session.session_id, payload)
            session.updated_at = payload["timestamp"]
        except Exception as exc:
            logger.error("[Manager] Failed to emit event: %s", exc)

    async def stream_events(self, session_id: str) -> AsyncGenerator[dict, None]:
        """Yield live SSE events for one session."""

        await self._ensure_initialized()
        session = self._sessions.get(session_id)
        if not session:
            yield {"type": "error", "error": f"Session {session_id} not found"}
            return

        terminal_types = {"research_completed", "research_error", "research_stopped"}
        status = "running" if session.is_running() else session.state.get("status", "completed")
        yield {
            "type": "connected",
            "session_id": session_id,
            "status": status,
            "timestamp": _utc_iso_now(),
        }

        persisted_events = await self._persistence.list_events(session_id)
        emitted_count = len(persisted_events)
        terminal_emitted = False
        for event in persisted_events:
            yield event
            event_type = str(event.get("type", ""))
            if event_type in terminal_types:
                terminal_emitted = True

        if not session.is_running():
            if terminal_emitted:
                return

            final_report = session.state.get("final_report", {})
            state_status = str(session.state.get("status", "completed"))
            if isinstance(final_report, dict) and final_report:
                yield {
                    "type": "research_completed",
                    "session_id": session_id,
                    "title": final_report.get("title", "Untitled"),
                    "word_count": final_report.get("word_count", 0),
                    "iterations": session.state.get("iteration", 0),
                    "final_report": final_report,
                    "timestamp": _utc_iso_now(),
                }
            elif state_status == "error":
                yield {
                    "type": "research_error",
                    "session_id": session_id,
                    "error": session.state.get("error", "Unknown error"),
                    "timestamp": _utc_iso_now(),
                }
            elif session.is_stopped() or state_status == "stopped":
                yield {
                    "type": "research_stopped",
                    "session_id": session_id,
                    "timestamp": _utc_iso_now(),
                }
            return

        while True:
            await asyncio.sleep(1.0)
            latest_events = await self._persistence.list_events(session_id)
            if emitted_count < len(latest_events):
                new_events = latest_events[emitted_count:]
                emitted_count = len(latest_events)
                for event in new_events:
                    yield event
                    event_type = str(event.get("type", ""))
                    if event_type in terminal_types:
                        return
                continue

            if not session.is_running():
                state_status = str(session.state.get("status", "completed"))
                if state_status == "error":
                    yield {
                        "type": "research_error",
                        "session_id": session_id,
                        "error": session.state.get("error", "Unknown error"),
                        "timestamp": _utc_iso_now(),
                    }
                elif session.is_stopped() or state_status == "stopped":
                    yield {
                        "type": "research_stopped",
                        "session_id": session_id,
                        "timestamp": _utc_iso_now(),
                    }
                else:
                    final_report = session.state.get("final_report", {})
                    if isinstance(final_report, dict) and final_report:
                        yield {
                            "type": "research_completed",
                            "session_id": session_id,
                            "title": final_report.get("title", "Untitled"),
                            "word_count": final_report.get("word_count", 0),
                            "iterations": session.state.get("iteration", 0),
                            "final_report": final_report,
                            "timestamp": _utc_iso_now(),
                        }
                return

            yield {
                "type": "heartbeat",
                "session_id": session_id,
                "timestamp": _utc_iso_now(),
            }

    async def stop_research(self, session_id: str) -> bool:
        """Stop one running session."""

        await self._ensure_initialized()
        session = self._sessions.get(session_id)
        if not session:
            logger.warning("[Manager] Session not found: %s", session_id)
            return False
        if not session.is_running():
            logger.info("[Manager] Session not running: %s", session_id)
            return False

        session.stop_event.set()
        if session.task:
            session.task.cancel()
            try:
                await session.task
            except asyncio.CancelledError:
                pass

        session.state["status"] = "stopped"
        session.updated_at = _utc_iso_now()
        await self._persist_snapshot(session, status="stopped", is_stopped=True)
        logger.info("[Manager] Stopped research: %s", session_id)
        return True

    async def get_session(self, session_id: str) -> ResearchSession | None:
        """Fetch one session from memory cache (hydrated from persistence)."""

        await self._ensure_initialized()
        return self._sessions.get(session_id)

    async def get_all_sessions(self) -> list[ResearchSession]:
        """Return all hydrated sessions."""

        await self._ensure_initialized()
        sessions = list(self._sessions.values())
        sessions.sort(key=lambda item: item.updated_at, reverse=True)
        return sessions

    async def list_documents(self, session_id: str) -> list[dict]:
        """List persisted documents for one session."""

        await self._ensure_initialized()
        documents = await self._persistence.list_documents(session_id)
        return [
            {
                "document_id": doc.document_id,
                "session_id": doc.session_id,
                "doc_type": doc.doc_type,
                "title": doc.title,
                "metadata": doc.metadata,
                "created_at": doc.created_at,
            }
            for doc in documents
        ]

    async def get_document_content(self, session_id: str, document_id: str) -> dict | None:
        """Fetch one document content payload."""

        documents = await self._persistence.list_documents(session_id)
        for doc in documents:
            if doc.document_id == document_id:
                return {
                    "document_id": doc.document_id,
                    "session_id": doc.session_id,
                    "doc_type": doc.doc_type,
                    "title": doc.title,
                    "metadata": doc.metadata,
                    "created_at": doc.created_at,
                    "content": doc.content,
                }
        return None

    async def delete_session(self, session_id: str) -> str:
        """
        Delete a session from memory and persistence.

        Returns:
            "deleted" | "not_found" | "running"
        """

        await self._ensure_initialized()
        session = self._sessions.get(session_id)
        if session and session.is_running():
            return "running"

        deleted = await self._persistence.delete_session(session_id)
        if not deleted:
            return "not_found"

        if session_id in self._sessions:
            del self._sessions[session_id]
        return "deleted"

    async def cleanup_old_sessions(self, max_age_hours: int = 24) -> int:
        """Drop old completed sessions from memory cache (not sqlite)."""

        await self._ensure_initialized()
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=max_age_hours)
        to_remove: list[str] = []

        for session_id, session in self._sessions.items():
            if session.is_running():
                continue
            session_time = datetime.fromisoformat(session.updated_at)
            if session_time.tzinfo is not None:
                session_time = session_time.astimezone(timezone.utc).replace(tzinfo=None)
            if session_time < cutoff:
                to_remove.append(session_id)

        for session_id in to_remove:
            del self._sessions[session_id]

        if to_remove:
            logger.info("[Manager] Cleaned up %s old sessions from memory cache", len(to_remove))
        return len(to_remove)

    async def reset_for_tests(self) -> None:
        """Helper used only in tests to clear runtime cache."""

        async with self._lock:
            self._sessions.clear()
            self._initialized = False


_manager_instance: ResearchManager | None = None


def get_research_manager() -> ResearchManager:
    """Singleton manager getter for application routes."""

    global _manager_instance
    if _manager_instance is None:
        _manager_instance = ResearchManager()
    return _manager_instance
