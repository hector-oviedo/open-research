"""
Research Graph - LangGraph StateGraph Definition

This module defines the LangGraph workflow for the Deep Research System.
It wires together all agents into an orchestrated workflow with checkpointing.

Design Pattern: Factory (creates compiled graph instances)

Graph Topology:
    planner → finder → summarizer → reviewer → [conditional] → writer → END
                              ↓ (if gaps & iter < max)
                            planner (iteration loop)

Safeguards:
- Max iterations enforced at reviewer
- Timeout handled at run level
- Checkpoint persistence for resume
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Literal

from langgraph.graph import StateGraph, END

from app.models.state import ResearchState, create_initial_state
from app.models.research import ResearchOptions
from app.agents.planner import get_planner
from app.agents.finder import get_finder
from app.agents.summarizer import get_summarizer
from app.agents.reviewer import get_reviewer
from app.agents.writer import get_writer
from app.core.checkpointer import get_checkpointer
from app.core.content_fetcher import get_content_fetcher

logger = logging.getLogger(__name__)


class ResearchGraph:
    """
    Research Graph - Orchestrates the multi-agent research workflow.
    
    This class encapsulates the LangGraph StateGraph definition,
    including all nodes, edges, and conditional routing.
    
    Complete Workflow:
    1. Planner: Decomposes query into sub-questions
    2. Finder: Discovers sources for each sub-question
    3. Summarizer: Compresses source content
    4. Reviewer: Detects gaps, decides to iterate or finish
    5. Writer: Synthesizes final report with citations
    
    Conditional Logic:
    - Reviewer routes to Writer if satisfied or max iterations reached
    - Reviewer routes back to Planner if gaps found and iterations allow
    
    Attributes:
        builder: StateGraph builder instance
        checkpointer: SQLite checkpointer for persistence
        max_iterations: Maximum research iterations (safeguard)
        event_emitter: Optional callback to emit events during execution
    
    Example:
        >>> graph = ResearchGraph()
        >>> result = await graph.run("What is quantum computing?", "session-001")
        >>> print(result.get("final_report", {}).get("title"))
    """
    
    def __init__(self, max_iterations: int = 3, event_emitter=None):
        """
        Initialize the research graph builder.
        
        Args:
            max_iterations: Maximum number of research iterations (default: 3)
            event_emitter: Optional async callback to emit events during execution
        """
        self.builder = StateGraph(ResearchState)
        self.checkpointer = get_checkpointer()
        self.max_iterations = max_iterations
        self.event_emitter = event_emitter
        
        # Build the graph structure
        self._build_graph()

    @staticmethod
    def _resolve_options(state: ResearchState) -> ResearchOptions:
        """Load runtime options from state with robust defaults."""
        raw = state.get("options", {})
        if isinstance(raw, dict):
            return ResearchOptions.model_validate(raw)
        return ResearchOptions()

    @staticmethod
    def _list_of_dicts(value) -> list[dict]:
        """Return only dictionary entries from a potentially malformed list payload."""
        if not isinstance(value, list):
            return []
        return [item for item in value if isinstance(item, dict)]
    
    def _build_graph(self) -> None:
        """
        Build the complete graph structure with all agents.
        
        This method defines the workflow topology:
        1. Add all agent nodes
        2. Define entry point
        3. Add edges between nodes
        4. Add conditional edge for reviewer routing
        """
        # Add all agent nodes
        self.builder.add_node("planner", self._planner_node)
        self.builder.add_node("finder", self._finder_node)
        self.builder.add_node("summarizer", self._summarizer_node)
        self.builder.add_node("reviewer", self._reviewer_node)
        self.builder.add_node("writer", self._writer_node)
        
        # Define entry point
        self.builder.set_entry_point("planner")
        
        # Linear flow: planner → finder → summarizer → reviewer
        self.builder.add_edge("planner", "finder")
        self.builder.add_edge("finder", "summarizer")
        
        # Conditional edge: summarizer may request finder retry if 0 key facts
        self.builder.add_conditional_edges(
            "summarizer",
            self._summarizer_router,
            {
                "retry_finder": "finder",  # Loop back to finder for more sources
                "continue": "reviewer",     # Proceed to reviewer
            }
        )
        
        # Conditional edge: reviewer decides next step
        self.builder.add_conditional_edges(
            "reviewer",
            self._reviewer_router,
            {
                "continue": "planner",  # Loop back for more research
                "finish": "writer",      # Proceed to final report
            }
        )
        
        # Writer always ends
        self.builder.add_edge("writer", END)
    
    async def _emit_event(self, event_type: str, message: str, session_id: str, **extra):
        """Emit an event if event_emitter is configured."""
        if self.event_emitter:
            await self.event_emitter({
                "type": event_type,
                "message": message,
                "session_id": session_id,
                "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                **extra
            })
    
    async def _planner_node(self, state: ResearchState) -> ResearchState:
        """
        Planner node - Decomposes query into sub-questions.
        
        On first run: Creates plan from original query
        On iteration: May refine plan based on gap report
        
        Args:
            state: Current ResearchState with query and gaps
        
        Returns:
            ResearchState: Updated state with research plan
        """
        session_id = state.get("session_id", "unknown")
        logger.info("[Graph] Running Planner node")
        
        # Emit running event
        await self._emit_event(
            "planner_running",
            f"Analyzing query and generating research plan...",
            session_id
        )
        
        planner = get_planner()
        
        # Check if this is an iteration (has gap recommendations)
        gaps_raw = state.get("gaps", {})
        gaps = gaps_raw if isinstance(gaps_raw, dict) else {}
        iteration = state.get("iteration", 0) + 1
        state["iteration"] = iteration
        
        if iteration > 1 and gaps.get("recommendations"):
            # Refine query based on gaps for iteration
            recommendations = " ".join(gaps["recommendations"][:3])
            query = f"{state['query']} (Additional focus: {recommendations})"
            logger.info(f"[Graph] Iteration {iteration}: Refining query with gap recommendations")
            await self._emit_event(
                "planner_running",
                f"Iteration {iteration}: Refining research based on gaps...",
                session_id
            )
        else:
            query = state["query"]
        
        options = self._resolve_options(state)
        session_memory = state.get("session_memory", [])
        if not isinstance(session_memory, list):
            session_memory = []

        result = await planner.plan(
            query=query,
            session_memory=session_memory,
            options=options,
        )
        plan = self._list_of_dicts(result.get("plan", []))
        state["plan"] = plan
        
        sub_questions = [sq.get("question", "") for sq in plan]
        await self._emit_event(
            "planner_complete",
            f"Generated {len(plan)} sub-questions to research",
            session_id,
            sub_questions_count=len(plan),
            questions=sub_questions
        )
        
        logger.info(f"[Graph] Planner generated {len(plan)} sub-questions")
        return state
    
    async def _finder_node(self, state: ResearchState) -> ResearchState:
        """
        Finder node - Discovers sources for all sub-questions.
        
        Args:
            state: Current ResearchState with plan
        
        Returns:
            ResearchState: Updated state with discovered sources
        """
        session_id = state.get("session_id", "unknown")
        logger.info("[Graph] Running Finder node")
        
        await self._emit_event(
            "finder_running",
            "Searching DuckDuckGo for diverse sources across domains...",
            session_id
        )
        
        finder = get_finder()
        options = self._resolve_options(state)
        plan = self._list_of_dicts(state.get("plan", []))
        
        # Find sources for each sub-question
        seen_urls = set()
        unique_sources = []
        domains = set()
        
        for sq in plan:
            sq_id = sq.get("id", "unknown")
            question = sq.get("question", "")
            
            logger.info(f"[Graph] Finding sources for: {question[:50]}...")
            result = await finder.find_sources(
                question,
                sq_id,
                max_results_per_query=options.search_results_per_query,
                max_sources_total=options.max_sources_per_question,
                enforce_diversity=options.source_diversity,
            )
            
            sources = self._list_of_dicts(result.get("sources", []))
            
            # Stream each new source as it's found (with deduplication)
            for source in sources:
                url = source.get("url", "")
                domain = source.get("domain", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    unique_sources.append(source)
                    if domain:
                        domains.add(domain)
                    
                    # Emit event for this source
                    await self._emit_event(
                        "finder_source",
                        f"Found source: {source.get('title', 'Untitled')[:50]}...",
                        session_id,
                        source_title=source.get('title', 'Untitled'),
                        source_url=url,
                        source_domain=domain,
                        sources_so_far=len(unique_sources)
                    )
            
            logger.info(f"[Graph] Found {len(sources)} sources for {sq_id}")
            if len(unique_sources) >= options.max_sources:
                break

        if len(unique_sources) > options.max_sources:
            unique_sources = unique_sources[: options.max_sources]
        
        state["sources"] = unique_sources
        
        # Get sample URLs for display (first 5)
        sample_urls = [s.get("url", "") for s in unique_sources[:5] if isinstance(s, dict) and s.get("url")]
        
        await self._emit_event(
            "finder_complete",
            f"Discovered {len(unique_sources)} unique sources from {len(domains)} different domains",
            session_id,
            sources_count=len(unique_sources),
            domains_count=len(domains),
            urls=sample_urls
        )
        
        logger.info(f"[Graph] Finder complete: {len(unique_sources)} unique sources")
        return state
    
    async def _summarizer_node(self, state: ResearchState) -> ResearchState:
        """
        Summarizer node - Fetches and compresses real source content.
        
        Fetches actual web content from discovered sources and summarizes it.
        
        Args:
            state: Current ResearchState with sources
        
        Returns:
            ResearchState: Updated state with findings
        """
        session_id = state.get("session_id", "unknown")
        logger.info("[Graph] Running Summarizer node (with real content fetching)")
        
        await self._emit_event(
            "summarizer_running",
            "Fetching and analyzing source content...",
            session_id
        )
        
        summarizer = get_summarizer()
        fetcher = get_content_fetcher()
        sources = self._list_of_dicts(state.get("sources", []))
        options = self._resolve_options(state)
        plan = self._list_of_dicts(state.get("plan", []))
        findings = []
        total_key_facts = 0
        fetched_count = 0
        failed_count = 0
        
        # Create a map of sub-question IDs to questions
        sq_map = {sq.get("id"): sq.get("question", "") for sq in plan}
        
        # Process each source - fetch real content
        for source in sources[: options.summarizer_source_limit]:
            sq_id = source.get("sub_question_id", "unknown")
            question = sq_map.get(sq_id, "")
            url = source.get("url", "")
            title = source.get("title", "Unknown")
            
            try:
                # Fetch real content from URL
                content = await fetcher.fetch_content(url)
                
                if content:
                    fetched_count += 1
                    await self._emit_event(
                        "summarizer_fetch",
                        f"Fetched {len(content)} chars from {title[:50]}...",
                        session_id,
                        source_url=url,
                        content_length=len(content)
                    )
                else:
                    failed_count += 1
                    # Fallback: use title and description as minimal content
                    content = f"Source: {title}\nURL: {url}\n\n[Content could not be fetched - using title and metadata only]"
                    logger.warning(f"[Graph] Could not fetch content from {url}, using fallback")
                
                # Summarize the fetched content
                result = await summarizer.summarize(
                    content=content,
                    sub_question=question,
                    source_title=title,
                    source_url=url,
                )
                
                finding = result.get("findings", {})
                finding["source_info"] = {
                    "url": url,
                    "title": title,
                    "reliability": source.get("reliability", "unknown"),
                }
                finding["sub_question_id"] = sq_id
                findings.append(finding)
                
                # Count key facts
                key_facts = finding.get("key_facts", [])
                total_key_facts += len(key_facts)
                
            except Exception as e:
                failed_count += 1
                logger.warning(f"[Graph] Failed to process {url}: {e}")
                continue
        
        # Merge with existing findings (from previous iterations)
        existing_findings = self._list_of_dicts(state.get("findings", []))
        state["findings"] = existing_findings + findings
        
        # Check if we got 0 key facts - need to retry finder with extended search
        if total_key_facts == 0 and len(sources) > 0:
            await self._emit_event(
                "summarizer_retry",
                f"No key facts extracted ({fetched_count} fetched, {failed_count} failed). Extending search...",
                session_id,
                retry_reason="zero_key_facts",
                fetched_count=fetched_count,
                failed_count=failed_count
            )
            state["needs_finder_retry"] = True
        else:
            state["needs_finder_retry"] = False
            await self._emit_event(
                "summarizer_complete",
                f"Extracted {total_key_facts} key facts from {len(findings)} sources ({fetched_count} fetched, {failed_count} failed)",
                session_id,
                findings_count=len(findings),
                key_facts_count=total_key_facts,
                fetched_count=fetched_count,
                failed_count=failed_count
            )
        
        logger.info(f"[Graph] Summarizer complete: {len(findings)} findings, {total_key_facts} facts, {fetched_count} fetched, {failed_count} failed")
        return state
    
    async def _reviewer_node(self, state: ResearchState) -> ResearchState:
        """
        Reviewer node - Detects gaps and decides next step.
        
        Args:
            state: Current ResearchState with plan and findings
        
        Returns:
            ResearchState: Updated state with gap report
        """
        session_id = state.get("session_id", "unknown")
        logger.info("[Graph] Running Reviewer node")
        
        await self._emit_event(
            "reviewer_running",
            "Analyzing findings for coverage gaps and depth issues...",
            session_id
        )
        
        reviewer = get_reviewer()
        options = self._resolve_options(state)
        plan = self._list_of_dicts(state.get("plan", []))
        findings = self._list_of_dicts(state.get("findings", []))
        iteration = state.get("iteration", 1)
        
        result = await reviewer.review(
            plan=plan,
            findings=findings,
            iteration=iteration,
            max_iterations=options.max_iterations,
        )
        
        gap_report = result.get("gap_report", {})
        state["gaps"] = gap_report
        
        gaps_count = len(gap_report.get("gaps", []))
        has_gaps = gap_report.get("has_gaps", False)
        confidence = gap_report.get("confidence", 0)
        
        if has_gaps and iteration < options.max_iterations:
            await self._emit_event(
                "reviewer_complete",
                f"Found {gaps_count} gaps (confidence: {confidence:.0%}). Starting iteration {iteration + 1}...",
                session_id,
                gaps_found=gaps_count,
                next_action="iterate"
            )
        else:
            await self._emit_event(
                "reviewer_complete",
                f"Review complete. {gaps_count} gaps found, confidence: {confidence:.0%}. Proceeding to write report...",
                session_id,
                gaps_found=gaps_count,
                next_action="finish"
            )
        
        logger.info(
            f"[Graph] Reviewer complete: has_gaps={gap_report.get('has_gaps')}, "
            f"confidence={gap_report.get('confidence', 0):.2f}"
        )
        return state
    
    async def _writer_node(self, state: ResearchState) -> ResearchState:
        """
        Writer node - Synthesizes final report.
        
        Args:
            state: Complete ResearchState with all research data
        
        Returns:
            ResearchState: Updated state with final report
        """
        session_id = state.get("session_id", "unknown")
        findings = state.get("findings", [])
        sources = state.get("sources", [])
        
        logger.info(f"[Graph] Running Writer node with {len(findings)} findings, {len(sources)} sources")
        
        await self._emit_event(
            "writer_running",
            f"Synthesizing {len(findings)} findings into professional report with citations...",
            session_id
        )
        
        writer = get_writer()
        options = self._resolve_options(state)
        report = await writer.write_report(state, report_length=options.report_length)
        
        # Log report details
        word_count = report.get("word_count", 0)
        sections_count = len(report.get("sections", []))
        exec_summary_len = len(report.get("executive_summary", ""))
        logger.info(f"[Graph] Report generated: {word_count} words, {sections_count} sections, summary: {exec_summary_len} chars")
        
        state["final_report"] = report
        state["status"] = "completed"
        
        word_count = report.get("word_count", 0)
        sources_count = len(report.get("sources_used", []))
        
        await self._emit_event(
            "writer_complete",
            f"Report complete: {word_count} words, {sources_count} sources cited",
            session_id,
            word_count=word_count,
            sources_cited=sources_count
        )
        
        logger.info(f"[Graph] Writer complete: {report.get('title', 'Untitled')}")
        return state
    
    def _reviewer_router(self, state: ResearchState) -> Literal["continue", "finish"]:
        """
        Router function - Decides next step after reviewer.
        
        Logic:
        - If max iterations reached → finish
        - If no gaps detected → finish  
        - If gaps detected and iterations allow → continue
        
        Args:
            state: Current ResearchState with gap report
        
        Returns:
            str: "continue" to iterate or "finish" to write report
        """
        options = self._resolve_options(state)
        iteration = state.get("iteration", 1)
        gaps_raw = state.get("gaps", {})
        gaps = gaps_raw if isinstance(gaps_raw, dict) else {}
        has_gaps = gaps.get("has_gaps", False)
        
        # Safeguard: max iterations
        if iteration >= options.max_iterations:
            logger.info(f"[Graph] Router: max iterations ({options.max_iterations}) reached, finishing")
            return "finish"
        
        # No gaps, research is satisfactory
        if not has_gaps:
            logger.info("[Graph] Router: no gaps detected, finishing")
            return "finish"
        
        # Gaps found, continue iterating
        logger.info(f"[Graph] Router: gaps detected, continuing iteration {iteration + 1}")
        return "continue"
    
    def _summarizer_router(self, state: ResearchState) -> Literal["retry_finder", "continue"]:
        """
        Router function - Decides next step after summarizer.
        
        Logic:
        - If 0 key facts extracted → retry_finder (get more sources)
        - Otherwise → continue to reviewer
        
        Args:
            state: Current ResearchState with findings
        
        Returns:
            str: "retry_finder" to get more sources or "continue" to reviewer
        """
        needs_retry = state.get("needs_finder_retry", False)
        retry_count = state.get("finder_retry_count", 0)
        
        if needs_retry and retry_count < 2:  # Max 2 retries
            state["finder_retry_count"] = retry_count + 1
            logger.info(f"[Graph] Summarizer router: retrying finder (attempt {retry_count + 1})")
            return "retry_finder"
        
        logger.info("[Graph] Summarizer router: continuing to reviewer")
        return "continue"
    
    async def run(
        self,
        query: str,
        session_id: str,
        timeout: float = 300.0,
        options: ResearchOptions | None = None,
        session_memory: list[dict] | None = None,
    ) -> ResearchState:
        """
        Run a complete research session through the full graph.
        
        Args:
            query: The user's research query
            session_id: Unique session identifier
            timeout: Maximum execution time in seconds (default: 300s)
        
        Returns:
            ResearchState: Final state after graph execution
        
        Example:
            >>> graph = ResearchGraph()
            >>> result = await graph.run(
            ...     "Quantum computing developments",
            ...     "session-001"
            ... )
            >>> print(result["final_report"]["title"])
        """
        initial_state = create_initial_state(query, session_id)
        effective_options = options or ResearchOptions(max_iterations=self.max_iterations)
        initial_state["options"] = effective_options.model_dump(mode="json")
        initial_state["session_memory"] = session_memory or []
        
        # Compile with checkpointer for persistence
        compiled = self.builder.compile(checkpointer=self.checkpointer.saver)
        
        logger.info(f"[Graph] Starting research session: {session_id}")
        logger.info(f"[Graph] Query: {query[:50]}...")
        logger.info(f"[Graph] Max iterations: {effective_options.max_iterations}")
        
        try:
            result = await asyncio.wait_for(
                compiled.ainvoke(
                    initial_state,
                    config={"configurable": {"thread_id": session_id}},
                ),
                timeout=timeout,
            )
            
            final_report = result.get("final_report", {})
            iterations = result.get("iteration", 0)
            
            logger.info(f"[Graph] Research complete: {final_report.get('title', 'Untitled')}")
            logger.info(f"[Graph] Total iterations: {iterations}")
            
            return result
            
        except asyncio.TimeoutError:
            logger.error("[Graph] Research timed out after %.1f seconds", timeout)
            initial_state["status"] = "error"
            initial_state["error"] = f"Research timed out after {timeout:.1f}s"
            return initial_state
        except Exception as e:
            logger.error(f"[Graph] Research failed: {e}")
            initial_state["status"] = "error"
            initial_state["error"] = str(e)
            return initial_state


def get_research_graph(max_iterations: int = 3, event_emitter=None) -> ResearchGraph:
    """
    Create a graph instance for one runtime execution context.
    
    Args:
        max_iterations: Maximum research iterations (default: 3)
        event_emitter: Optional async callback to emit events during execution
    
    Returns:
        ResearchGraph: Configured graph instance
    
    Example:
        >>> graph = get_research_graph(max_iterations=4)
        >>> result = await graph.run("AI in healthcare", "session-001")
    """
    return ResearchGraph(max_iterations=max_iterations, event_emitter=event_emitter)
