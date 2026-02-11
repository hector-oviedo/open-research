import pytest

from app.core.persistence import SessionPersistence, report_to_markdown
from app.models.research import ResearchOptions
from app.models.state import create_initial_state


@pytest.mark.asyncio
async def test_session_persistence_roundtrip(tmp_path):
    db_path = tmp_path / "research.db"
    persistence = SessionPersistence(str(db_path))

    session_id = "research-test-001"
    options = ResearchOptions(max_iterations=4, max_sources=15)
    state = create_initial_state(query="Quantum networking landscape", session_id=session_id)
    state["status"] = "running"
    state["options"] = options.model_dump(mode="json")

    await persistence.upsert_session(
        session_id=session_id,
        query=state["query"],
        status="running",
        options=options,
        state=dict(state),
        created_at=state["started_at"],
        updated_at=state["started_at"],
        is_stopped=False,
    )
    await persistence.append_event(
        session_id,
        {"type": "planner_complete", "message": "plan ready", "timestamp": "2026-02-11T10:00:00"},
    )

    report = {
        "title": "Quantum Networking 2026",
        "executive_summary": "Summary content",
        "sections": [{"heading": "Findings", "content": "Details"}],
        "sources_used": [{"url": "https://example.com", "title": "Example", "reliability": "high"}],
        "confidence_assessment": "High confidence",
        "word_count": 1200,
    }
    await persistence.save_final_report(session_id, report, "# Markdown Report")

    sessions = await persistence.list_sessions(limit=10)
    assert len(sessions) == 1
    saved = sessions[0]
    assert saved.session_id == session_id
    assert saved.status == "completed"
    assert saved.options.max_iterations == 4
    assert saved.events_count == 1
    assert saved.final_report is not None
    assert saved.final_report["title"] == "Quantum Networking 2026"

    documents = await persistence.list_documents(session_id)
    assert len(documents) == 2
    assert {doc.doc_type for doc in documents} == {"report_json", "report_markdown"}

    await persistence.close()


@pytest.mark.asyncio
async def test_recent_reports_and_markdown_rendering(tmp_path):
    persistence = SessionPersistence(str(tmp_path / "research-memory.db"))

    first_session = create_initial_state(query="State of quantum networking", session_id="session-a")
    second_session = create_initial_state(query="AI model safety benchmarks", session_id="session-b")
    options = ResearchOptions()

    for state in [first_session, second_session]:
        await persistence.upsert_session(
            session_id=state["session_id"],
            query=state["query"],
            status="running",
            options=options,
            state=dict(state),
            created_at=state["started_at"],
            updated_at=state["started_at"],
            is_stopped=False,
        )

    report_a = {
        "title": "Quantum Networking Report",
        "executive_summary": "Summary A",
        "sections": [{"heading": "Findings", "content": "Details A"}],
        "sources_used": [{"url": "https://example.com/a", "title": "A", "reliability": "high"}],
        "confidence_assessment": "High",
        "word_count": 900,
    }
    report_b = {
        "title": "AI Safety Report",
        "executive_summary": "Summary B",
        "sections": [{"heading": "Findings", "content": "Details B"}],
        "sources_used": [{"url": "https://example.com/b", "title": "B", "reliability": "medium"}],
        "confidence_assessment": "Medium",
        "word_count": 1100,
    }
    await persistence.save_final_report("session-a", report_a, report_to_markdown(report_a), updated_at="2026-02-11T10:00:00")
    await persistence.save_final_report("session-b", report_b, report_to_markdown(report_b), updated_at="2026-02-11T10:05:00")

    recent = await persistence.get_recent_completed_reports(limit=2, exclude_session_id="session-b")
    assert len(recent) == 1
    assert recent[0]["session_id"] == "session-a"
    assert recent[0]["title"] == "Quantum Networking Report"

    markdown = report_to_markdown(report_b)
    assert "# AI Safety Report" in markdown
    assert "## Sources" in markdown
    assert "Word count: 1100" in markdown

    await persistence.close()


def test_report_to_markdown_tolerates_malformed_sections_and_sources():
    malformed_report = {
        "title": "Malformed Report",
        "executive_summary": "Summary",
        "sections": [None, {"heading": "Valid Section", "content": "Valid content"}, "oops"],
        "sources_used": [None, {"title": "Source A", "url": "https://example.com/a", "reliability": "high"}, 42],
        "confidence_assessment": "Moderate",
        "word_count": 123,
    }

    markdown = report_to_markdown(malformed_report)
    assert "# Malformed Report" in markdown
    assert "### Valid Section" in markdown
    assert "https://example.com/a" in markdown


@pytest.mark.asyncio
async def test_delete_session_removes_events_documents_and_snapshot(tmp_path):
    persistence = SessionPersistence(str(tmp_path / "research-delete.db"))
    options = ResearchOptions()
    state = create_initial_state(query="Delete me", session_id="session-delete")

    await persistence.upsert_session(
        session_id=state["session_id"],
        query=state["query"],
        status="running",
        options=options,
        state=dict(state),
        created_at=state["started_at"],
        updated_at=state["started_at"],
        is_stopped=False,
    )
    await persistence.append_event(
        state["session_id"],
        {"type": "planner_complete", "message": "ok", "timestamp": "2026-02-11T10:00:00"},
    )
    report = {
        "title": "Delete Report",
        "executive_summary": "to remove",
        "sections": [{"heading": "One", "content": "two"}],
        "sources_used": [],
        "confidence_assessment": "low",
        "word_count": 12,
    }
    await persistence.save_final_report(state["session_id"], report, "# Delete Report")

    deleted = await persistence.delete_session(state["session_id"])
    assert deleted is True
    assert await persistence.get_session(state["session_id"]) is None
    assert await persistence.list_documents(state["session_id"]) == []

    await persistence.close()
