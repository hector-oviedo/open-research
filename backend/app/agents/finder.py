"""
Source Finder Agent - Discovers Diverse Sources

The Source Finder queries search engines and discovers sources
with diversity prioritization (domain, perspective, time).

Design Pattern: Capsule (isolated class with single responsibility)
"""

import json
import re
from typing import Any

from ddgs import DDGS

from app.core.config import settings
from app.models.state import SourceFinderOutput, Source
from app.agents.prompts import load_prompt
from app.core.ollama_adapter import get_adapter


class SourceFinderAgent:
    """
    Source Finder Agent - Discovers diverse sources for research.
    
    This agent:
    1. Generates optimized search queries using LLM
    2. Executes searches via DuckDuckGo
    3. Filters and ranks sources by relevance
    4. Ensures domain diversity
    
    Attributes:
        adapter: VLLMAdapter for LLM calls
        search_provider: Search engine to use (duckduckgo)
        max_results_per_query: Maximum results to fetch
    
    Example:
        >>> finder = SourceFinderAgent()
        >>> result = await finder.find_sources(
        ...     "What are recent AI breakthroughs?",
        ...     sub_question_id="sq-001"
        ... )
        >>> print(len(result["sources"]))
        8
    """
    
    def __init__(
        self,
        max_results_per_query: int = 5,
        max_sources_total: int = 10,
    ):
        """
        Initialize the Source Finder agent.
        
        Args:
            max_results_per_query: Max search results per query
            max_sources_total: Max sources to return (for diversity)
        """
        self.adapter = get_adapter()
        self.system_prompt = load_prompt("finder.md")
        self.max_results_per_query = max_results_per_query
        self.max_sources_total = max_sources_total
    
    async def find_sources(
        self,
        sub_question: str,
        sub_question_id: str,
    ) -> SourceFinderOutput:
        """
        Find diverse sources for a sub-question.
        
        Args:
            sub_question: The sub-question to research
            sub_question_id: ID of the sub-question (for tracking)
        
        Returns:
            SourceFinderOutput: Dict containing list of sources
        
        Example:
            >>> finder = SourceFinderAgent()
            >>> result = await finder.find_sources(
            ...     "Recent AI breakthroughs in 2024",
            ...     "sq-001"
            ... )
        """
        # Step 1: Generate search queries using LLM
        search_plan = await self._generate_search_queries(sub_question)
        queries = search_plan.get("search_queries", [])
        
        # Step 2: Execute searches
        all_sources: list[Source] = []
        domain_counts: dict[str, int] = {}
        
        for query_data in queries:
            query = query_data.get("query", "")
            if not query:
                continue
            
            # Search
            search_results = self._execute_search(query)
            
            # Filter by diversity
            for result in search_results:
                source = self._create_source(result, sub_question_id)
                domain = source.get("domain", "")
                
                # Check domain diversity (max 2 per domain)
                if domain_counts.get(domain, 0) >= 2:
                    continue
                
                # Add source
                all_sources.append(source)
                domain_counts[domain] = domain_counts.get(domain, 0) + 1
                
                # Stop if we have enough sources
                if len(all_sources) >= self.max_sources_total:
                    break
            
            if len(all_sources) >= self.max_sources_total:
                break
        
        return SourceFinderOutput(sources=all_sources)
    
    async def _generate_search_queries(self, sub_question: str) -> dict[str, Any]:
        """
        Use LLM to generate optimized search queries.
        
        Args:
            sub_question: The sub-question to generate queries for
        
        Returns:
            dict: Search plan with queries
        """
        user_message = f"""Sub-question: {sub_question}

Generate search queries to find diverse, authoritative sources for this research question."""
        
        response = await self.adapter.chat_completion(
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_message},
            ],
            enable_thinking=True,
            stream=False,
        )
        
        content = response.get("message", {}).get("content", "")
        return self._parse_search_plan(content)
    
    def _execute_search(self, query: str) -> list[dict[str, Any]]:
        """
        Execute search using DuckDuckGo.
        
        Args:
            query: Search query string
        
        Returns:
            list: Search results
        """
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(
                    query,
                    max_results=self.max_results_per_query,
                ))
                return results
        except Exception as e:
            # Log error and return empty list
            print(f"Search error for query '{query}': {e}")
            return []
    
    def _create_source(self, result: dict, sub_question_id: str) -> Source:
        """
        Convert search result to Source object.
        
        Args:
            result: Raw search result from DuckDuckGo
            sub_question_id: ID of the parent sub-question
        
        Returns:
            Source: Normalized source object
        """
        from urllib.parse import urlparse
        from datetime import datetime
        
        url = result.get("href", "")
        domain = urlparse(url).netloc
        
        return Source(
            id=f"src-{sub_question_id}-{hash(url) % 10000:04d}",
            url=url,
            title=result.get("title", "Untitled"),
            content=result.get("body", ""),
            domain=domain,
            confidence=0.7,  # Base confidence, can be refined
            timestamp=datetime.utcnow().isoformat(),
        )
    
    def _parse_search_plan(self, content: str) -> dict[str, Any]:
        """
        Parse LLM output to extract search plan.
        
        Args:
            content: Raw LLM response
        
        Returns:
            dict: Parsed search plan
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
                # Return default plan if parsing fails
                return {
                    "search_queries": [
                        {"query": content[:100], "priority": 1}
                    ]
                }
            json_str = content[start:end+1]
        
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            # Return default plan
            return {
                "search_queries": [
                    {"query": content[:100], "priority": 1}
                ]
            }


# Singleton instance
_finder_instance: SourceFinderAgent | None = None


def get_finder() -> SourceFinderAgent:
    """
    Get the singleton SourceFinderAgent instance.
    
    Returns:
        SourceFinderAgent: Singleton finder instance
    """
    global _finder_instance
    if _finder_instance is None:
        _finder_instance = SourceFinderAgent()
    return _finder_instance
