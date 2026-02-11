from dataclasses import dataclass

import pytest

from app.models.research import ResearchOptions


@dataclass
class FakeSession:
    session_id: str
    state: dict
    options: ResearchOptions
    created_at: str = "2026-02-11T12:00:00"
    updated_at: str = "2026-02-11T12:05:00"
    running: bool = False
    stopped: bool = False

    def is_running(self) -> bool:
        return self.running

    def is_stopped(self) -> bool:
        return self.stopped


class FakeManager:
    def __init__(self):
        self.last_start = None
        self.delete_result = "deleted"
        self.options = ResearchOptions()
        self.report = {
            "title": "Persisted Session Report",
            "executive_summary": "Executive summary",
            "sections": [{"heading": "Findings", "content": "Details"}],
            "sources_used": [],
            "confidence_assessment": "High confidence",
            "word_count": 700,
        }
        self.session = FakeSession(
            session_id="research-test-abc",
            state={
                "query": "AI governance updates",
                "status": "completed",
                "plan": [],
                "sources": [],
                "findings": [],
                "iteration": 1,
                "final_report": self.report,
            },
            options=self.options,
        )

    async def start_research(self, query: str, session_id: str, options: ResearchOptions):
        self.last_start = {"query": query, "session_id": session_id, "options": options}

    async def stream_events(self, session_id: str):
        yield {"type": "connected", "session_id": session_id, "timestamp": "2026-02-11T12:00:00"}
        yield {
            "type": "research_completed",
            "session_id": session_id,
            "final_report": self.report,
            "title": self.report["title"],
            "word_count": self.report["word_count"],
            "timestamp": "2026-02-11T12:00:01",
        }

    async def stop_research(self, session_id: str) -> bool:  # noqa: ARG002
        return True

    async def get_session(self, session_id: str):
        if session_id == self.session.session_id:
            return self.session
        return None

    async def get_all_sessions(self):
        return [self.session]

    async def list_documents(self, session_id: str):  # noqa: ARG002
        return [
            {
                "document_id": "doc-1",
                "doc_type": "report_markdown",
                "title": "Persisted Session Report",
                "metadata": {"word_count": 700},
                "created_at": "2026-02-11T12:05:00",
            }
        ]

    async def get_document_content(self, session_id: str, document_id: str):  # noqa: ARG002
        if document_id == "doc-1":
            return {
                "document_id": "doc-1",
                "session_id": self.session.session_id,
                "doc_type": "report_markdown",
                "title": "Persisted Session Report",
                "metadata": {"word_count": 700},
                "created_at": "2026-02-11T12:05:00",
                "content": "# Report",
            }
        return None

    async def delete_session(self, session_id: str):  # noqa: ARG002
        return self.delete_result


@pytest.mark.asyncio
async def test_start_research_contract(async_client, monkeypatch):
    from app.api import routes

    fake_manager = FakeManager()
    monkeypatch.setattr(routes, "get_research_manager", lambda: fake_manager)

    payload = {
        "query": "Latest changes in AI regulation",
        "options": {
            "maxIterations": 4,
            "maxSources": 14,
            "maxSourcesPerQuestion": 5,
            "searchResultsPerQuery": 6,
            "sourceDiversity": True,
            "reportLength": "long",
            "includeSessionMemory": True,
            "sessionMemoryLimit": 3,
            "summarizerSourceLimit": 7,
        },
    }
    response = await async_client.post("/api/research/start", json=payload)
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "started"
    assert body["session_id"].startswith("research-")
    assert body["options"]["max_iterations"] == 4
    assert body["stream_url"].endswith("/events")
    assert fake_manager.last_start is not None
    assert fake_manager.last_start["query"] == payload["query"]
    assert fake_manager.last_start["options"].max_iterations == 4


@pytest.mark.asyncio
async def test_sessions_report_and_documents_endpoints(async_client, monkeypatch):
    from app.api import routes

    fake_manager = FakeManager()
    monkeypatch.setattr(routes, "get_research_manager", lambda: fake_manager)

    sessions_response = await async_client.get("/api/research/sessions")
    sessions_body = sessions_response.json()
    assert sessions_response.status_code == 200
    assert sessions_body["status"] == "success"
    assert sessions_body["count"] == 1
    assert sessions_body["sessions"][0]["has_report"] is True

    report_response = await async_client.get(f"/api/research/sessions/{fake_manager.session.session_id}/report")
    report_body = report_response.json()
    assert report_response.status_code == 200
    assert report_body["report"]["title"] == "Persisted Session Report"

    docs_response = await async_client.get(f"/api/research/sessions/{fake_manager.session.session_id}/documents")
    docs_body = docs_response.json()
    assert docs_response.status_code == 200
    assert docs_body["documents"][0]["doc_type"] == "report_markdown"

    document_response = await async_client.get(
        f"/api/research/sessions/{fake_manager.session.session_id}/documents/doc-1"
    )
    document_body = document_response.json()
    assert document_response.status_code == 200
    assert document_body["document"]["content"] == "# Report"


@pytest.mark.asyncio
async def test_status_and_missing_document_contract(async_client, monkeypatch):
    from app.api import routes

    fake_manager = FakeManager()
    monkeypatch.setattr(routes, "get_research_manager", lambda: fake_manager)

    status_response = await async_client.get(f"/api/research/{fake_manager.session.session_id}/status")
    status_body = status_response.json()
    assert status_response.status_code == 200
    assert status_body["status"] == "completed"
    assert status_body["options"]["max_iterations"] == fake_manager.options.max_iterations
    assert status_body["result"]["title"] == "Persisted Session Report"

    missing_doc = await async_client.get(
        f"/api/research/sessions/{fake_manager.session.session_id}/documents/does-not-exist"
    )
    assert missing_doc.status_code == 404


@pytest.mark.asyncio
async def test_start_research_validation(async_client):
    response = await async_client.post("/api/research/start", json={"query": "x"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_delete_session_contract(async_client, monkeypatch):
    from app.api import routes

    fake_manager = FakeManager()
    monkeypatch.setattr(routes, "get_research_manager", lambda: fake_manager)

    deleted_response = await async_client.delete(f"/api/research/sessions/{fake_manager.session.session_id}")
    deleted_body = deleted_response.json()
    assert deleted_response.status_code == 200
    assert deleted_body["status"] == "deleted"

    fake_manager.delete_result = "running"
    running_response = await async_client.delete(f"/api/research/sessions/{fake_manager.session.session_id}")
    running_body = running_response.json()
    assert running_response.status_code == 200
    assert running_body["status"] == "running"

    fake_manager.delete_result = "not_found"
    missing_response = await async_client.delete("/api/research/sessions/research-missing")
    missing_body = missing_response.json()
    assert missing_response.status_code == 200
    assert missing_body["status"] == "not_found"
