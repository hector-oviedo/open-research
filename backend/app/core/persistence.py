"""
Persistent Session Store

SQLite-backed storage for research sessions, event traces, and report documents.
"""

from __future__ import annotations

import asyncio
import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models.research import ResearchOptions


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class SessionRecord:
    """Serialized session snapshot from storage."""

    session_id: str
    query: str
    status: str
    created_at: str
    updated_at: str
    is_stopped: bool
    options: ResearchOptions
    state: dict[str, Any]
    final_report: dict[str, Any] | None
    events_count: int


@dataclass(slots=True)
class SessionDocument:
    """Stored session document representation."""

    document_id: str
    session_id: str
    doc_type: str
    title: str
    content: str
    metadata: dict[str, Any]
    created_at: str


class SessionPersistence:
    """SQLite persistence service for sessions and generated documents."""

    def __init__(self, database_path: str):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()
        self._conn = sqlite3.connect(self.database_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._initialize_schema()

    def _initialize_schema(self) -> None:
        cursor = self._conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                is_stopped INTEGER NOT NULL DEFAULT 0,
                options_json TEXT NOT NULL,
                state_json TEXT NOT NULL,
                final_report_json TEXT,
                events_count INTEGER NOT NULL DEFAULT 0
            );
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS session_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                event_index INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(session_id) REFERENCES sessions(session_id)
            );
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS session_documents (
                document_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                doc_type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(session_id) REFERENCES sessions(session_id)
            );
            """
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id, event_index);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_session_docs_session ON session_documents(session_id, created_at DESC);"
        )
        self._conn.commit()

    async def close(self) -> None:
        """Close underlying sqlite connection."""
        async with self._lock:
            await asyncio.to_thread(self._conn.close)

    async def upsert_session(
        self,
        session_id: str,
        query: str,
        status: str,
        options: ResearchOptions,
        state: dict[str, Any],
        created_at: str,
        updated_at: str,
        is_stopped: bool = False,
    ) -> None:
        """Insert or update a session snapshot."""

        options_json = _json_dumps(options.model_dump(mode="json"))
        state_json = _json_dumps(state)

        async with self._lock:
            await asyncio.to_thread(
                self._upsert_session_sync,
                session_id,
                query,
                status,
                created_at,
                updated_at,
                int(is_stopped),
                options_json,
                state_json,
            )

    def _upsert_session_sync(
        self,
        session_id: str,
        query: str,
        status: str,
        created_at: str,
        updated_at: str,
        is_stopped: int,
        options_json: str,
        state_json: str,
    ) -> None:
        cursor = self._conn.cursor()
        cursor.execute(
            """
            INSERT INTO sessions (
                session_id, query, status, created_at, updated_at,
                is_stopped, options_json, state_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                query=excluded.query,
                status=excluded.status,
                updated_at=excluded.updated_at,
                is_stopped=excluded.is_stopped,
                options_json=excluded.options_json,
                state_json=excluded.state_json;
            """,
            (
                session_id,
                query,
                status,
                created_at,
                updated_at,
                is_stopped,
                options_json,
                state_json,
            ),
        )
        self._conn.commit()

    async def append_event(self, session_id: str, event: dict[str, Any]) -> None:
        """Persist one streamed event for a session."""

        event_type = str(event.get("type", "unknown"))
        payload_json = _json_dumps(event)
        created_at = str(event.get("timestamp") or _utc_now_iso())

        async with self._lock:
            await asyncio.to_thread(
                self._append_event_sync,
                session_id,
                event_type,
                payload_json,
                created_at,
            )

    def _append_event_sync(
        self,
        session_id: str,
        event_type: str,
        payload_json: str,
        created_at: str,
    ) -> None:
        cursor = self._conn.cursor()
        cursor.execute(
            "SELECT COALESCE(MAX(event_index), -1) + 1 FROM session_events WHERE session_id = ?;",
            (session_id,),
        )
        next_index = int(cursor.fetchone()[0])
        cursor.execute(
            """
            INSERT INTO session_events (session_id, event_index, event_type, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?);
            """,
            (session_id, next_index, event_type, payload_json, created_at),
        )
        cursor.execute(
            """
            UPDATE sessions
            SET events_count = events_count + 1, updated_at = ?
            WHERE session_id = ?;
            """,
            (created_at, session_id),
        )
        self._conn.commit()

    async def save_final_report(
        self,
        session_id: str,
        report: dict[str, Any],
        markdown_report: str,
        updated_at: str | None = None,
    ) -> None:
        """Persist final report JSON + markdown documents and session status."""

        updated = updated_at or _utc_now_iso()
        report_json = _json_dumps(report)

        async with self._lock:
            await asyncio.to_thread(
                self._save_final_report_sync,
                session_id,
                report_json,
                markdown_report,
                updated,
            )

    def _save_final_report_sync(
        self,
        session_id: str,
        report_json: str,
        markdown_report: str,
        updated: str,
    ) -> None:
        cursor = self._conn.cursor()
        cursor.execute(
            """
            UPDATE sessions
            SET status = 'completed',
                final_report_json = ?,
                updated_at = ?,
                is_stopped = 0
            WHERE session_id = ?;
            """,
            (report_json, updated, session_id),
        )

        report = json.loads(report_json)
        title = str(report.get("title") or f"Report {session_id}")
        sources_used = report.get("sources_used")
        if not isinstance(sources_used, list):
            sources_used = []
        metadata = {
            "word_count": report.get("word_count", 0),
            "sources_count": len(sources_used),
            "generated_by": "writer_agent",
        }

        json_document_id = f"{session_id}-json"
        markdown_document_id = f"{session_id}-markdown"

        cursor.execute(
            """
            INSERT INTO session_documents (
                document_id, session_id, doc_type, title, content, metadata_json, created_at
            )
            VALUES (?, ?, 'report_json', ?, ?, ?, ?)
            ON CONFLICT(document_id) DO UPDATE SET
                title=excluded.title,
                content=excluded.content,
                metadata_json=excluded.metadata_json,
                created_at=excluded.created_at;
            """,
            (
                json_document_id,
                session_id,
                title,
                report_json,
                _json_dumps(metadata),
                updated,
            ),
        )
        cursor.execute(
            """
            INSERT INTO session_documents (
                document_id, session_id, doc_type, title, content, metadata_json, created_at
            )
            VALUES (?, ?, 'report_markdown', ?, ?, ?, ?)
            ON CONFLICT(document_id) DO UPDATE SET
                title=excluded.title,
                content=excluded.content,
                metadata_json=excluded.metadata_json,
                created_at=excluded.created_at;
            """,
            (
                markdown_document_id,
                session_id,
                title,
                markdown_report,
                _json_dumps(metadata),
                updated,
            ),
        )
        self._conn.commit()

    async def list_sessions(self, limit: int = 50) -> list[SessionRecord]:
        """List persisted sessions ordered by most recently updated."""

        async with self._lock:
            return await asyncio.to_thread(self._list_sessions_sync, limit)

    def _list_sessions_sync(self, limit: int) -> list[SessionRecord]:
        cursor = self._conn.cursor()
        cursor.execute(
            """
            SELECT session_id, query, status, created_at, updated_at, is_stopped,
                   options_json, state_json, final_report_json, events_count
            FROM sessions
            ORDER BY updated_at DESC
            LIMIT ?;
            """,
            (limit,),
        )
        return [self._row_to_session_record(row) for row in cursor.fetchall()]

    async def get_session(self, session_id: str) -> SessionRecord | None:
        """Fetch one persisted session."""

        async with self._lock:
            return await asyncio.to_thread(self._get_session_sync, session_id)

    def _get_session_sync(self, session_id: str) -> SessionRecord | None:
        cursor = self._conn.cursor()
        cursor.execute(
            """
            SELECT session_id, query, status, created_at, updated_at, is_stopped,
                   options_json, state_json, final_report_json, events_count
            FROM sessions
            WHERE session_id = ?;
            """,
            (session_id,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return self._row_to_session_record(row)

    async def delete_session(self, session_id: str) -> bool:
        """Delete one session and all associated events/documents."""

        async with self._lock:
            return await asyncio.to_thread(self._delete_session_sync, session_id)

    def _delete_session_sync(self, session_id: str) -> bool:
        cursor = self._conn.cursor()
        cursor.execute("DELETE FROM session_documents WHERE session_id = ?;", (session_id,))
        cursor.execute("DELETE FROM session_events WHERE session_id = ?;", (session_id,))
        cursor.execute("DELETE FROM sessions WHERE session_id = ?;", (session_id,))
        deleted = cursor.rowcount > 0
        self._conn.commit()
        return deleted

    async def list_documents(self, session_id: str) -> list[SessionDocument]:
        """List documents for a session."""

        async with self._lock:
            return await asyncio.to_thread(self._list_documents_sync, session_id)

    def _list_documents_sync(self, session_id: str) -> list[SessionDocument]:
        cursor = self._conn.cursor()
        cursor.execute(
            """
            SELECT document_id, session_id, doc_type, title, content, metadata_json, created_at
            FROM session_documents
            WHERE session_id = ?
            ORDER BY created_at DESC;
            """,
            (session_id,),
        )
        documents: list[SessionDocument] = []
        for row in cursor.fetchall():
            documents.append(
                SessionDocument(
                    document_id=str(row["document_id"]),
                    session_id=str(row["session_id"]),
                    doc_type=str(row["doc_type"]),
                    title=str(row["title"]),
                    content=str(row["content"]),
                    metadata=json.loads(row["metadata_json"] or "{}"),
                    created_at=str(row["created_at"]),
                )
            )
        return documents

    async def list_events(self, session_id: str, limit: int | None = None) -> list[dict[str, Any]]:
        """List persisted events for a session in chronological order."""

        async with self._lock:
            return await asyncio.to_thread(self._list_events_sync, session_id, limit)

    def _list_events_sync(self, session_id: str, limit: int | None) -> list[dict[str, Any]]:
        cursor = self._conn.cursor()
        if limit is None:
            cursor.execute(
                """
                SELECT payload_json
                FROM session_events
                WHERE session_id = ?
                ORDER BY event_index ASC;
                """,
                (session_id,),
            )
        else:
            cursor.execute(
                """
                SELECT payload_json
                FROM (
                    SELECT payload_json, event_index
                    FROM session_events
                    WHERE session_id = ?
                    ORDER BY event_index DESC
                    LIMIT ?
                ) recent
                ORDER BY event_index ASC;
                """,
                (session_id, limit),
            )

        events: list[dict[str, Any]] = []
        for row in cursor.fetchall():
            payload = json.loads(row["payload_json"] or "{}")
            if isinstance(payload, dict):
                events.append(payload)
        return events

    async def get_recent_completed_reports(
        self,
        limit: int,
        exclude_session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Load recent completed report summaries for session memory context."""

        async with self._lock:
            return await asyncio.to_thread(
                self._get_recent_completed_reports_sync,
                limit,
                exclude_session_id,
            )

    def _get_recent_completed_reports_sync(
        self,
        limit: int,
        exclude_session_id: str | None,
    ) -> list[dict[str, Any]]:
        cursor = self._conn.cursor()
        if exclude_session_id:
            cursor.execute(
                """
                SELECT session_id, query, final_report_json, updated_at
                FROM sessions
                WHERE status = 'completed'
                  AND final_report_json IS NOT NULL
                  AND session_id != ?
                ORDER BY updated_at DESC
                LIMIT ?;
                """,
                (exclude_session_id, limit),
            )
        else:
            cursor.execute(
                """
                SELECT session_id, query, final_report_json, updated_at
                FROM sessions
                WHERE status = 'completed'
                  AND final_report_json IS NOT NULL
                ORDER BY updated_at DESC
                LIMIT ?;
                """,
                (limit,),
            )

        records: list[dict[str, Any]] = []
        for row in cursor.fetchall():
            report = json.loads(row["final_report_json"] or "{}")
            sources_used = report.get("sources_used")
            if not isinstance(sources_used, list):
                sources_used = []
            records.append(
                {
                    "session_id": row["session_id"],
                    "query": row["query"],
                    "title": report.get("title", ""),
                    "executive_summary": report.get("executive_summary", ""),
                    "sources_count": len(sources_used),
                    "updated_at": row["updated_at"],
                }
            )
        return records

    def _row_to_session_record(self, row: sqlite3.Row) -> SessionRecord:
        options_raw = json.loads(row["options_json"] or "{}")
        state = json.loads(row["state_json"] or "{}")
        final_report_raw = row["final_report_json"]
        final_report = json.loads(final_report_raw) if final_report_raw else None
        return SessionRecord(
            session_id=str(row["session_id"]),
            query=str(row["query"]),
            status=str(row["status"]),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
            is_stopped=bool(int(row["is_stopped"])),
            options=ResearchOptions.model_validate(options_raw),
            state=state,
            final_report=final_report,
            events_count=int(row["events_count"]),
        )


def report_to_markdown(report: dict[str, Any]) -> str:
    """Render stored report JSON into markdown for persisted documents."""

    title = str(report.get("title", "Research Report"))
    executive_summary = str(report.get("executive_summary", ""))
    confidence = str(report.get("confidence_assessment", ""))
    word_count = int(report.get("word_count", 0) or 0)
    sections = report.get("sections")
    if not isinstance(sections, list):
        sections = []
    sources = report.get("sources_used")
    if not isinstance(sources, list):
        sources = []

    lines: list[str] = [f"# {title}", ""]
    lines.append("## Executive Summary")
    lines.append(executive_summary or "No executive summary generated.")
    lines.append("")
    lines.append("## Sections")
    if sections:
        for section in sections:
            if not isinstance(section, dict):
                continue
            heading = str(section.get("heading", "Untitled Section"))
            content = str(section.get("content", ""))
            lines.append(f"### {heading}")
            lines.append(content)
            lines.append("")
    else:
        lines.append("No sections generated.")
        lines.append("")

    lines.append("## Confidence Assessment")
    lines.append(confidence or "No confidence assessment provided.")
    lines.append("")
    lines.append("## Sources")
    if sources:
        for index, source in enumerate(sources, start=1):
            if not isinstance(source, dict):
                continue
            title_text = str(source.get("title", "Untitled Source"))
            url = str(source.get("url", ""))
            reliability = str(source.get("reliability", "unknown"))
            if url:
                lines.append(f"{index}. [{title_text}]({url}) ({reliability})")
            else:
                lines.append(f"{index}. {title_text} ({reliability})")
    else:
        lines.append("No sources captured.")
    lines.append("")
    lines.append(f"_Word count: {word_count}_")
    return "\n".join(lines)


_session_persistence_instance: SessionPersistence | None = None


def get_session_persistence() -> SessionPersistence:
    """Get singleton SQLite persistence service."""

    global _session_persistence_instance
    if _session_persistence_instance is None:
        _session_persistence_instance = SessionPersistence(settings.DATABASE_PATH)
    return _session_persistence_instance


def generate_document_id(session_id: str, prefix: str = "doc") -> str:
    """Generate deterministic-ish document IDs."""

    return f"{prefix}-{session_id}-{uuid.uuid4().hex[:10]}"
