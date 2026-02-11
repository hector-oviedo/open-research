import asyncio

import pytest

from app.core.config import settings
from app.core.persistence import SessionPersistence
from app.core.research_manager import ResearchManager
from app.models.research import ResearchOptions
from app.models.state import create_initial_state


class FakeGraph:
    last_session_memory = []
    last_options = None
    last_timeout = None

    def __init__(self, event_emitter=None, **_kwargs):
        self.event_emitter = event_emitter

    async def run(self, query, session_id, timeout, options, session_memory):  # noqa: ARG002
        FakeGraph.last_session_memory = session_memory
        FakeGraph.last_options = options
        FakeGraph.last_timeout = timeout
        if self.event_emitter:
            await self.event_emitter(
                {
                    "type": "planner_complete",
                    "message": "Generated test plan",
                    "session_id": session_id,
                    "timestamp": "2026-02-11T11:00:00",
                }
            )
        state = create_initial_state(query=query, session_id=session_id)
        state["iteration"] = 1
        state["status"] = "completed"
        state["options"] = options.model_dump(mode="json")
        state["final_report"] = {
            "title": "Test Report",
            "executive_summary": "Summary",
            "sections": [{"heading": "Test Section", "content": "Body"}],
            "sources_used": [],
            "confidence_assessment": "Medium confidence",
            "word_count": 222,
        }
        return state


def fake_graph_factory(**kwargs):
    return FakeGraph(**kwargs)


class FakeErrorGraph:
    def __init__(self, event_emitter=None, **_kwargs):
        self.event_emitter = event_emitter

    async def run(self, query, session_id, timeout, options, session_memory):  # noqa: ARG002
        if self.event_emitter:
            await self.event_emitter(
                {
                    "type": "planner_running",
                    "message": "Starting plan",
                    "session_id": session_id,
                    "timestamp": "2026-02-11T11:02:00",
                }
            )
        state = create_initial_state(query=query, session_id=session_id)
        state["status"] = "error"
        state["error"] = "Upstream failure in graph"
        state["final_report"] = None
        return state


def fake_error_graph_factory(**kwargs):
    return FakeErrorGraph(**kwargs)


class FakeSlowGraph:
    def __init__(self, event_emitter=None, **_kwargs):
        self.event_emitter = event_emitter

    async def run(self, query, session_id, timeout, options, session_memory):  # noqa: ARG002
        await asyncio.sleep(1.5)
        state = create_initial_state(query=query, session_id=session_id)
        state["status"] = "stopped"
        return state


def fake_slow_graph_factory(**kwargs):
    return FakeSlowGraph(**kwargs)


@pytest.mark.asyncio
async def test_research_manager_persists_completion(tmp_path):
    persistence = SessionPersistence(str(tmp_path / "manager.db"))
    manager = ResearchManager(graph_factory=fake_graph_factory, persistence=persistence)

    options = ResearchOptions(max_iterations=2, include_session_memory=False)
    session_id = "research-manager-001"
    await manager.start_research("Test manager persistence", session_id, options)

    session = await manager.get_session(session_id)
    assert session is not None
    assert session.task is not None
    await asyncio.wait_for(session.task, timeout=2.0)

    completed_session = await manager.get_session(session_id)
    assert completed_session is not None
    assert completed_session.state.get("status") == "completed"
    assert completed_session.state.get("final_report", {}).get("title") == "Test Report"

    persisted = await persistence.get_session(session_id)
    assert persisted is not None
    assert persisted.status == "completed"
    assert persisted.final_report is not None
    assert persisted.final_report["word_count"] == 222

    events = [event async for event in manager.stream_events(session_id)]
    event_types = [event["type"] for event in events]
    assert event_types[0] == "connected"
    assert "research_completed" in event_types

    await persistence.close()


@pytest.mark.asyncio
async def test_research_manager_injects_session_memory(tmp_path):
    persistence = SessionPersistence(str(tmp_path / "manager-memory.db"))

    prior_state = create_initial_state(query="Prior completed session", session_id="session-prior")
    await persistence.upsert_session(
        session_id="session-prior",
        query=prior_state["query"],
        status="running",
        options=ResearchOptions(),
        state=dict(prior_state),
        created_at="2026-02-11T09:00:00",
        updated_at="2026-02-11T09:00:00",
        is_stopped=False,
    )
    prior_report = {
        "title": "Prior Report",
        "executive_summary": "Prior summary",
        "sections": [{"heading": "Prior", "content": "Prior details"}],
        "sources_used": [{"url": "https://example.com/prior", "title": "Prior Source", "reliability": "high"}],
        "confidence_assessment": "High confidence",
        "word_count": 600,
    }
    await persistence.save_final_report(
        session_id="session-prior",
        report=prior_report,
        markdown_report="# Prior Report",
        updated_at="2026-02-11T09:05:00",
    )

    manager = ResearchManager(graph_factory=fake_graph_factory, persistence=persistence)
    options = ResearchOptions(include_session_memory=True, session_memory_limit=1)
    await manager.start_research("New session requiring memory", "session-new", options)

    new_session = await manager.get_session("session-new")
    assert new_session is not None
    assert new_session.task is not None
    await asyncio.wait_for(new_session.task, timeout=2.0)

    assert FakeGraph.last_options is not None
    assert FakeGraph.last_options.include_session_memory is True
    assert len(FakeGraph.last_session_memory) == 1
    assert FakeGraph.last_session_memory[0]["session_id"] == "session-prior"
    assert FakeGraph.last_session_memory[0]["title"] == "Prior Report"

    await persistence.close()


@pytest.mark.asyncio
async def test_research_manager_handles_error_state_without_none_get_crash(tmp_path):
    persistence = SessionPersistence(str(tmp_path / "manager-error.db"))
    manager = ResearchManager(graph_factory=fake_error_graph_factory, persistence=persistence)

    options = ResearchOptions()
    session_id = "research-manager-error"
    await manager.start_research("Trigger error path", session_id, options)

    session = await manager.get_session(session_id)
    assert session is not None
    assert session.task is not None
    await asyncio.wait_for(session.task, timeout=2.0)

    errored_session = await manager.get_session(session_id)
    assert errored_session is not None
    assert errored_session.state.get("status") == "error"
    assert "Upstream failure in graph" in str(errored_session.state.get("error", ""))

    persisted = await persistence.get_session(session_id)
    assert persisted is not None
    assert persisted.status == "error"
    assert persisted.final_report is None

    events = [event async for event in manager.stream_events(session_id)]
    event_types = [event["type"] for event in events]
    assert event_types[0] == "connected"
    assert "research_error" in event_types

    await persistence.close()


@pytest.mark.asyncio
async def test_research_manager_uses_configured_timeout_minutes(tmp_path):
    persistence = SessionPersistence(str(tmp_path / "manager-timeout.db"))
    manager = ResearchManager(graph_factory=fake_graph_factory, persistence=persistence)

    original_timeout_minutes = settings.MAX_RESEARCH_TIME_MINUTES
    settings.MAX_RESEARCH_TIME_MINUTES = 15
    try:
        await manager.start_research("Timeout wiring validation", "session-timeout", ResearchOptions())
        session = await manager.get_session("session-timeout")
        assert session is not None
        assert session.task is not None
        await asyncio.wait_for(session.task, timeout=2.0)
    finally:
        settings.MAX_RESEARCH_TIME_MINUTES = original_timeout_minutes

    assert FakeGraph.last_timeout == pytest.approx(900.0)
    await persistence.close()


@pytest.mark.asyncio
async def test_research_manager_delete_session_contract(tmp_path):
    persistence = SessionPersistence(str(tmp_path / "manager-delete.db"))
    manager = ResearchManager(graph_factory=fake_graph_factory, persistence=persistence)

    session_id = "session-delete"
    await manager.start_research("Delete contract", session_id, ResearchOptions())
    session = await manager.get_session(session_id)
    assert session is not None and session.task is not None
    await asyncio.wait_for(session.task, timeout=2.0)

    deleted_status = await manager.delete_session(session_id)
    assert deleted_status == "deleted"
    assert await manager.get_session(session_id) is None
    assert await persistence.get_session(session_id) is None

    missing_status = await manager.delete_session("missing-session")
    assert missing_status == "not_found"

    slow_manager = ResearchManager(graph_factory=fake_slow_graph_factory, persistence=persistence)
    await slow_manager.start_research("Running delete guard", "session-running", ResearchOptions())
    running_status = await slow_manager.delete_session("session-running")
    assert running_status == "running"
    await slow_manager.stop_research("session-running")

    await persistence.close()
