"""
Reviewer Agent - Gap Detection & Iteration Trigger

The Reviewer analyzes research findings and detects gaps,
triggering iteration loops when needed.

Design Pattern: Capsule (isolated class with single responsibility)
"""

import json
import re
from typing import Any

from app.core.ollama_adapter import get_adapter
from app.models.state import ReviewerOutput, GapReport
from app.agents.prompts import load_prompt


class ReviewerAgent:
    """
    Reviewer Agent - Detects gaps and triggers iteration.
    
    This agent:
    1. Analyzes research plan vs accumulated findings
    2. Detects coverage gaps, depth issues, perspective bias
    3. Recommends specific actions to address gaps
    4. Decides whether to continue iterating or finalize
    
    Attributes:
        adapter: VLLMAdapter for LLM calls
        system_prompt: Review criteria and format
    
    Example:
        >>> reviewer = ReviewerAgent()
        >>> result = await reviewer.review(
        ...     plan=sub_questions,
        ...     findings=accumulated_findings,
        ...     iteration=2
        ... )
        >>> result["gap_report"]["has_gaps"]
        True
    """
    
    def __init__(self):
        """Initialize the Reviewer agent."""
        self.adapter = get_adapter()
        self.system_prompt = load_prompt("reviewer.md")
    
    async def review(
        self,
        plan: list[dict],
        findings: list[dict],
        iteration: int = 1,
        max_iterations: int = 10,
    ) -> ReviewerOutput:
        """
        Review research findings and detect gaps.
        
        Args:
            plan: List of sub-questions from Planner
            findings: Accumulated findings from all sources
            iteration: Current iteration count
            max_iterations: Maximum allowed iterations
        
        Returns:
            ReviewerOutput: Gap report with recommendations
        
        Example:
            >>> reviewer = ReviewerAgent()
            >>> result = await reviewer.review(
            ...     plan=[{"id": "sq-001", "question": "..."}],
            ...     findings=[{"sub_question_id": "sq-001", "summary": "..."}],
            ...     iteration=2,
            ...     max_iterations=10
            ... )
            >>> result["gap_report"]["has_gaps"]
            True
        """
        # Build review context
        context = self._build_review_context(plan, findings, iteration, max_iterations)
        
        # Call LLM
        response = await self.adapter.chat_completion(
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": context},
            ],
            enable_thinking=True,  # Enable thinking for complex analysis
            stream=False,
        )
        
        # Parse response
        content = response.get("message", {}).get("content", "")
        parsed = self._parse_review(content)
        
        # Force finalization behavior at max iterations via graph router safeguards.
        
        return ReviewerOutput(
            gap_report=GapReport(
                has_gaps=parsed.get("has_gaps", False),
                gaps=parsed.get("gaps", []),
                recommendations=parsed.get("recommendations", []),
                confidence=parsed.get("confidence", 0.5),
            )
        )
    
    def _build_review_context(
        self,
        plan: list[dict],
        findings: list[dict],
        iteration: int,
        max_iterations: int,
    ) -> str:
        """
        Build context for review.
        
        Args:
            plan: Sub-questions
            findings: Accumulated findings
            iteration: Current iteration
            max_iterations: Max allowed
        
        Returns:
            str: Formatted context
        """
        context_parts = [
            f"Iteration: {iteration}/{max_iterations}",
            "",
            "## Research Plan (Sub-Questions):",
        ]
        
        for sq in plan:
            if not isinstance(sq, dict):
                continue
            context_parts.append(f"- {sq.get('id')}: {sq.get('question')}")
        
        context_parts.extend([
            "",
            "## Accumulated Findings:",
        ])
        
        for finding in findings:
            if not isinstance(finding, dict):
                continue
            sq_id = finding.get("sub_question_id", "unknown")
            summary = finding.get("summary", "")[:200]  # Truncate
            context_parts.append(f"- {sq_id}: {summary}...")
        
        context_parts.extend([
            "",
            "Analyze coverage, depth, and quality. Identify gaps.",
        ])
        
        return "\n".join(context_parts)
    
    def _parse_review(self, content: str) -> dict[str, Any]:
        """
        Parse LLM review output.
        
        Args:
            content: Raw LLM response
        
        Returns:
            dict: Parsed review data
        """
        # Extract JSON
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
                # Return default
                return {
                    "assessment": "Parse error",
                    "has_gaps": False,
                    "gaps": [],
                    "recommendations": [],
                    "confidence": 0.0,
                    "should_continue": False,
                }
            json_str = content[start:end+1]
        
        # Parse
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            return {
                "assessment": "Parse error",
                "has_gaps": False,
                "gaps": [],
                "recommendations": [],
                "confidence": 0.0,
                "should_continue": False,
            }


# Singleton instance
_reviewer_instance: ReviewerAgent | None = None


def get_reviewer() -> ReviewerAgent:
    """
    Get the singleton ReviewerAgent instance.
    
    Returns:
        ReviewerAgent: Singleton reviewer instance
    """
    global _reviewer_instance
    if _reviewer_instance is None:
        _reviewer_instance = ReviewerAgent()
    return _reviewer_instance
