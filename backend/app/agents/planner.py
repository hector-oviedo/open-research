"""
Planner Agent - Research Query Decomposition

The Planner is the orchestrator that decomposes user queries into
structured research plans (lists of sub-questions).

Design Pattern: Capsule (isolated class with single responsibility)
"""

import json
import re
from typing import Any

from app.core.ollama_adapter import get_adapter
from app.models.state import PlannerOutput, SubQuestion
from app.models.research import ResearchOptions
from app.agents.prompts import PLANNER_PROMPT


class PlannerAgent:
    """
    Planner Agent - Decomposes queries into structured research plans.
    
    This agent takes a user query and uses the LLM to analyze and break it down
    into 3-7 independent sub-questions that can be researched in parallel.
    
    Attributes:
        adapter: VLLMAdapter instance for LLM calls
        system_prompt: The planning prompt (loaded from prompts/planner.md)
    
    Example:
        >>> planner = PlannerAgent()
        >>> result = await planner.plan("Impact of AI on healthcare")
        >>> print(result["plan"][0]["question"])
        'What are recent AI applications in medical diagnostics?'
    """
    
    def __init__(self):
        """Initialize the Planner agent."""
        self.adapter = get_adapter()
        self.system_prompt = PLANNER_PROMPT
    
    async def plan(
        self,
        query: str,
        session_memory: list[dict] | None = None,
        options: ResearchOptions | None = None,
    ) -> PlannerOutput:
        """
        Decompose a user query into a structured research plan.
        
        Args:
            query: The user's research query (e.g., "Impact of AI on healthcare")
        
        Returns:
            PlannerOutput: Dict containing the list of sub-questions
        
        Raises:
            ValueError: If the LLM response cannot be parsed
            RuntimeError: If the LLM call fails
        
        Example:
            >>> planner = PlannerAgent()
            >>> result = await planner.plan("Quantum computing developments")
            >>> len(result["plan"])
            5
        """
        memory_context = self._build_memory_context(session_memory or [])
        active_options = options or ResearchOptions()

        # Build the user message with runtime controls and optional memory context
        user_message = (
            f"Research Query: {query}\n\n"
            "Runtime constraints:\n"
            f"- max_iterations: {active_options.max_iterations}\n"
            f"- max_sources_total: {active_options.max_sources}\n"
            f"- source_diversity: {active_options.source_diversity}\n"
            f"- report_length_target: {active_options.report_length}\n"
            "\n"
            f"{memory_context}\n"
            "Generate a research plan with sub-questions."
        )
        
        # Call LLM with thinking enabled for better reasoning
        response = await self.adapter.chat_completion(
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_message},
            ],
            enable_thinking=True,  # Enable <think> tags for reasoning
            stream=False,
        )
        
        # Extract the response content
        content = response.get("message", {}).get("content", "")
        if not content:
            raise RuntimeError("Empty response from LLM")
        
        # Parse the structured output
        plan_data = self._parse_plan_output(content)
        
        # Convert to SubQuestion objects
        sub_questions: list[SubQuestion] = []
        for sq_data in plan_data.get("sub_questions", []):
            if not isinstance(sq_data, dict):
                continue
            sub_questions.append(
                SubQuestion(
                    id=str(sq_data.get("id", f"sq-{len(sub_questions)+1:03d}")),
                    question=str(sq_data.get("question", "")),
                    status="pending",
                    sources=[],
                    findings="",
                )
            )
        
        return PlannerOutput(plan=sub_questions)

    def _build_memory_context(self, session_memory: list[dict]) -> str:
        """Build compact prior-session memory context for planning quality."""
        if not session_memory:
            return "Prior session memory: none"

        lines = ["Prior session memory (reuse useful lines of inquiry, avoid duplicates):"]
        for index, item in enumerate(session_memory, start=1):
            query = str(item.get("query", "")).strip()
            title = str(item.get("title", "")).strip()
            summary = str(item.get("executive_summary", "")).strip().replace("\n", " ")
            trimmed_summary = summary[:350] + ("..." if len(summary) > 350 else "")
            sources_count = item.get("sources_count", 0)
            lines.append(
                f"{index}. Query: {query}\n"
                f"   Report: {title}\n"
                f"   Sources: {sources_count}\n"
                f"   Summary: {trimmed_summary}"
            )
        return "\n".join(lines)
    
    def _parse_plan_output(self, content: str) -> dict[str, Any]:
        """
        Parse the LLM output to extract structured plan data.
        
        The LLM may output JSON wrapped in markdown code blocks or
        include thinking tags. This method handles both cases.
        
        Args:
            content: Raw LLM response string
        
        Returns:
            dict: Parsed plan data
        
        Raises:
            ValueError: If JSON parsing fails
        """
        # First, try to extract JSON from markdown code blocks
        json_match = re.search(
            r'```(?:json)?\s*(\{.*?\})\s*```',
            content,
            re.DOTALL | re.IGNORECASE
        )
        
        if json_match:
            json_str = json_match.group(1)
        else:
            # Try to find JSON object directly
            # Look for the first { and last } to extract the JSON object
            start = content.find('{')
            end = content.rfind('}')
            if start == -1 or end == -1 or start >= end:
                raise ValueError(f"No JSON object found in response: {content[:200]}...")
            json_str = content[start:end+1]
        
        # Parse the JSON
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse planner output as JSON: {e}\nContent: {json_str[:500]}...")


# Singleton instance for reuse
_planner_instance: PlannerAgent | None = None


def get_planner() -> PlannerAgent:
    """
    Get the singleton PlannerAgent instance.
    
    Returns:
        PlannerAgent: Singleton planner instance
    
    Example:
        >>> planner = get_planner()
        >>> result = await planner.plan("AI in healthcare")
    """
    global _planner_instance
    if _planner_instance is None:
        _planner_instance = PlannerAgent()
    return _planner_instance
