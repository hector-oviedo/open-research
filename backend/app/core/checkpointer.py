"""
SQLite Checkpointer - LangGraph State Persistence

This module provides SQLite-based checkpointing for LangGraph,
enabling:
- Research session persistence across interruptions
- Resume capability for long-running research
- State inspection for debugging

Design: Wraps LangGraph's SqliteSaver with application-specific setup.
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from langgraph.checkpoint.sqlite import SqliteSaver
from app.core.config import settings


class Checkpointer:
    """
    SQLite checkpointer for LangGraph state persistence.
    
    This class manages the database connection and provides
    a SqliteSaver instance for LangGraph to use.
    
    Attributes:
        db_path: Path to SQLite database file
        connection: SQLite connection object
        saver: LangGraph SqliteSaver instance
    
    Example:
        >>> checkpointer = Checkpointer()
        >>> saver = checkpointer.get_saver()
        >>> # Use saver in LangGraph
        >>> graph = StateGraph(...).compile(checkpointer=saver)
    """
    
    _instance = None
    
    def __new__(cls):
        """Singleton pattern for connection reuse."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """Initialize checkpointer (runs once due to singleton)."""
        if self._initialized:
            return
        
        self.db_path = Path(settings.DATABASE_PATH)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Create connection
        self.connection = sqlite3.connect(
            str(self.db_path),
            check_same_thread=False,  # Required for LangGraph
        )
        
        # Create SqliteSaver
        self.saver = SqliteSaver(self.connection)
        
        self._initialized = True
    
    def get_saver(self) -> SqliteSaver:
        """
        Get the SqliteSaver instance for LangGraph.
        
        Returns:
            SqliteSaver: Checkpoint saver for graph compilation
        """
        return self.saver
    
    def list_sessions(self) -> list[dict[str, Any]]:
        """
        List all research sessions in the database.
        
        Returns:
            list[dict]: Session information including thread_id and timestamp
        """
        cursor = self.connection.cursor()
        try:
            cursor.execute("""
                SELECT thread_id, MAX(timestamp) as last_update, COUNT(*) as checkpoints
                FROM checkpoints
                GROUP BY thread_id
                ORDER BY last_update DESC
            """)
            
            columns = [description[0] for description in cursor.description]
            rows = cursor.fetchall()
            
            return [dict(zip(columns, row)) for row in rows]
        except sqlite3.OperationalError:
            # Table doesn't exist yet
            return []
    
    def get_session_state(self, session_id: str) -> dict[str, Any] | None:
        """
        Get the latest state for a specific session.
        
        Args:
            session_id: The thread_id/session_id to look up
        
        Returns:
            dict | None: The checkpoint state or None if not found
        """
        cursor = self.connection.cursor()
        cursor.execute("""
            SELECT state
            FROM checkpoints
            WHERE thread_id = ?
            ORDER BY timestamp DESC
            LIMIT 1
        """, (session_id,))
        
        row = cursor.fetchone()
        if row:
            import json
            return json.loads(row[0])
        return None
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete a research session and all its checkpoints.
        
        Args:
            session_id: The thread_id/session_id to delete
        
        Returns:
            bool: True if deleted, False if not found
        """
        cursor = self.connection.cursor()
        cursor.execute(
            "DELETE FROM checkpoints WHERE thread_id = ?",
            (session_id,)
        )
        self.connection.commit()
        return cursor.rowcount > 0
    
    def get_stats(self) -> dict[str, Any]:
        """
        Get database statistics.
        
        Returns:
            dict: Statistics including session count, size, etc.
        """
        cursor = self.connection.cursor()
        
        try:
            # Total sessions
            cursor.execute("SELECT COUNT(DISTINCT thread_id) FROM checkpoints")
            session_count = cursor.fetchone()[0]
            
            # Total checkpoints
            cursor.execute("SELECT COUNT(*) FROM checkpoints")
            checkpoint_count = cursor.fetchone()[0]
        except sqlite3.OperationalError:
            # Table doesn't exist yet
            session_count = 0
            checkpoint_count = 0
        
        # Database file size
        db_size = self.db_path.stat().st_size if self.db_path.exists() else 0
        
        return {
            "sessions": session_count,
            "checkpoints": checkpoint_count,
            "db_size_bytes": db_size,
            "db_size_mb": round(db_size / (1024 * 1024), 2),
        }
    
    def close(self):
        """Close the database connection."""
        if self.connection:
            self.connection.close()
    
    def __del__(self):
        """Cleanup on deletion."""
        self.close()


def get_checkpointer() -> Checkpointer:
    """
    Get the singleton Checkpointer instance.
    
    Returns:
        Checkpointer: Singleton checkpointer instance
    
    Example:
        >>> checkpointer = get_checkpointer()
        >>> saver = checkpointer.get_saver()
        >>> stats = checkpointer.get_stats()
    """
    return Checkpointer()
