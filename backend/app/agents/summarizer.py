"""
Summarizer Agent - Content Extraction & Compression

The Summarizer extracts relevant information from source content
and compresses it with 10:1 ratio while preserving key facts.

Design Pattern: Capsule (isolated class with single responsibility)
"""

import json
import re
from typing import Any

from app.core.ollama_adapter import get_adapter
from app.models.state import SummarizerOutput
from app.agents.prompts import load_prompt


class SummarizerAgent:
    """
    Summarizer Agent - Compresses content while preserving meaning.
    
    This agent:
    1. Takes source content and sub-question
    2. Extracts only relevant information
    3. Produces compressed summary (10:1 ratio target)
    4. Preserves key facts with attribution
    
    Attributes:
        adapter: VLLMAdapter for LLM calls
        system_prompt: Summarization prompt
    
    Example:
        >>> summarizer = SummarizerAgent()
        >>> result = await summarizer.summarize(
        ...     content="Long article text...",
        ...     sub_question="What are quantum computing breakthroughs?"
        ... )
        >>> print(result["summary"][:200])
        'Recent breakthroughs include...'
    """
    
    def __init__(self):
        """Initialize the Summarizer agent."""
        self.adapter = get_adapter()
        self.system_prompt = load_prompt("summarizer.md")
    
    async def summarize(
        self,
        content: str,
        sub_question: str,
        source_title: str = "",
        source_url: str = "",
    ) -> SummarizerOutput:
        """
        Summarize source content relevant to sub-question.
        
        Args:
            content: Raw source content (HTML or text)
            sub_question: The research question to focus on
            source_title: Title of the source document
            source_url: URL of the source
        
        Returns:
            SummarizerOutput: Dict with summary and key facts
        
        Example:
            >>> summarizer = SummarizerAgent()
            >>> result = await summarizer.summarize(
            ...     content="Long article about quantum computing...",
            ...     sub_question="Recent breakthroughs in quantum computing?"
            ... )
            >>> len(result["findings"]["summary"])
            350
        """
        # Clean content (remove excessive whitespace)
        cleaned_content = self._clean_content(content)
        
        # Truncate if too long (save tokens)
        max_content_len = 8000
        if len(cleaned_content) > max_content_len:
            cleaned_content = cleaned_content[:max_content_len] + "..."
        
        # Build user message
        user_message = f"""Sub-question: {sub_question}

Source Title: {source_title}
Source URL: {source_url}

Content to summarize:
---
{cleaned_content}
---

Provide a compressed summary focusing only on information relevant to the sub-question."""
        
        # Call LLM
        response = await self.adapter.chat_completion(
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_message},
            ],
            enable_thinking=False,  # No thinking needed for summarization
            stream=False,
        )
        
        # Extract and parse
        content_raw = response.get("message", {}).get("content", "")
        parsed = self._parse_summary(content_raw)
        
        # Format as SummarizerOutput
        return SummarizerOutput(
            findings={
                "sub_question": sub_question,
                "summary": parsed.get("summary", ""),
                "key_facts": parsed.get("key_facts", []),
                "relevance_score": parsed.get("relevance_score", 0.0),
                "compression_ratio": parsed.get("compression_ratio", 1.0),
                "word_count": parsed.get("word_count", {"original": 0, "summary": 0}),
                "source_title": source_title,
                "source_url": source_url,
            }
        )
    
    def _clean_content(self, content: str) -> str:
        """
        Clean raw content before summarization.
        
        Removes excessive whitespace, common HTML artifacts,
        but preserves meaningful text.
        
        Args:
            content: Raw content string
        
        Returns:
            str: Cleaned content
        """
        # Remove excessive whitespace
        cleaned = re.sub(r'\s+', ' ', content)
        
        # Remove common HTML artifacts (if any remain)
        cleaned = re.sub(r'<[^>]+>', ' ', cleaned)
        
        # Remove URLs (keep domain for context)
        cleaned = re.sub(r'https?://[^\s]+', '[link]', cleaned)
        
        # Strip and return
        return cleaned.strip()
    
    def _parse_summary(self, content: str) -> dict[str, Any]:
        """
        Parse LLM output to extract structured summary.
        
        Args:
            content: Raw LLM response
        
        Returns:
            dict: Parsed summary data
        """
        # Extract JSON from markdown or raw
        json_match = re.search(
            r'```(?:json)?\s*(\{.*?\})\s*```',
            content,
            re.DOTALL | re.IGNORECASE
        )
        
        if json_match:
            json_str = json_match.group(1)
        else:
            start = content.find('{')
            end = content.rfind('}')
            if start == -1 or end == -1 or start >= end:
                # Return default structure if no JSON found
                return {
                    "summary": content[:500] if content else "No summary generated",
                    "key_facts": [],
                    "relevance_score": 0.5,
                    "compression_ratio": 1.0,
                    "word_count": {"original": 0, "summary": 0},
                }
            json_str = content[start:end+1]
        
        # Parse JSON
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            # Return default on parse error
            return {
                "summary": content[:500] if content else "Parse error - raw content",
                "key_facts": [],
                "relevance_score": 0.5,
                "compression_ratio": 1.0,
                "word_count": {"original": 0, "summary": 0},
            }


# Singleton instance
_summarizer_instance: SummarizerAgent | None = None


def get_summarizer() -> SummarizerAgent:
    """
    Get the singleton SummarizerAgent instance.
    
    Returns:
        SummarizerAgent: Singleton summarizer instance
    """
    global _summarizer_instance
    if _summarizer_instance is None:
        _summarizer_instance = SummarizerAgent()
    return _summarizer_instance
