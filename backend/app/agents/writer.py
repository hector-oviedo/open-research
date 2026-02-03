"""
Writer Agent - Synthesizes research findings into formatted reports with citations.
"""
import logging
from typing import Any, List, Optional

from app.core.ollama_adapter import get_adapter
from app.agents.prompts import load_prompt
from app.models.state import ResearchState

logger = logging.getLogger(__name__)


class WriterAgent:
    """
    Final synthesis agent that creates professional research reports.
    Compiles findings, adds citations, and structures output.
    """

    def __init__(self):
        self.adapter = get_adapter()
        self.system_prompt = load_prompt("writer.md")
        logger.info("WriterAgent initialized")

    async def write_report(
        self,
        state: ResearchState,
        report_format: str = "markdown",
        max_length: int = 2000,
    ) -> dict[str, Any]:
        """
        Synthesize findings into a formatted research report.

        Args:
            state: Current research state with query, plan, findings, gaps
            report_format: Output format (markdown, json)
            max_length: Approximate maximum report length in words

        Returns:
            Report structure with sections, citations, and metadata
        """
        # Extract state data
        query = state.get("query", "")
        plan = state.get("plan", [])
        findings = state.get("findings", [])
        gaps = state.get("gaps", {})

        logger.info(f"Writing report for query: {query[:50]}...")
        logger.info(f"Synthesizing {len(findings)} findings into report")

        if not findings:
            logger.warning("No findings available for report")
            return self._create_error_report("No research findings available to synthesize.")

        # Build context for LLM
        context = self._build_context(query, plan, findings, gaps)

        try:
            # Generate report using LLM
            messages = [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": context},
            ]

            response = await self.adapter.chat_completion(
                messages=messages,
                enable_thinking=False,  # No need for thinking in report generation
                stream=False,
            )

            content = response.get("message", {}).get("content", "")
            report = self._parse_report_response(content, findings)
            logger.info(f"Report generated: {report.get('title', 'Untitled')}")
            logger.info(f"Word count: {report.get('word_count', 0)}")

            return report

        except Exception as e:
            logger.error(f"Error generating report: {e}")
            return self._create_error_report(str(e))

    def _build_context(
        self,
        query: str,
        plan: List[str],
        findings: List[dict],
        gaps: dict,
    ) -> str:
        """Build structured context for the writer LLM."""
        context_parts = []
        
        logger.info(f"[Writer] Building context with {len(findings)} findings, query: '{query[:50]}...'")

        # Original query
        context_parts.append(f"# Original Research Query\n{query}\n")

        # Research plan
        context_parts.append("## Research Plan (Sub-Questions)")
        for i, sq in enumerate(plan, 1):
            # Handle both dict and string formats
            if isinstance(sq, dict):
                question_text = sq.get("question", str(sq))
            else:
                question_text = str(sq)
            context_parts.append(f"{i}. {question_text}")
        context_parts.append("")

        # All findings with EXPLICIT source numbering for citations
        context_parts.append(f"## Research Findings ({len(findings)} sources)\n")
        context_parts.append("**SOURCE NUMBERING FOR CITATIONS (CRITICAL - USE THESE EXACT NUMBERS):**")
        for i, finding in enumerate(findings, 1):
            source_info = finding.get("source_info", {})
            url = source_info.get('url', 'Unknown')
            title = source_info.get('title', 'Unknown')
            context_parts.append(f"  [{i}] {title} - {url}")
        context_parts.append("")
        context_parts.append("---")
        context_parts.append("")
        
        for i, finding in enumerate(findings, 1):
            context_parts.append(f"### Finding {i} (Source [{i}])")

            # Source info
            source_info = finding.get("source_info", {})
            context_parts.append(f"**Source URL**: {source_info.get('url', 'Unknown')}")
            context_parts.append(f"**Source Title**: {source_info.get('title', 'Unknown')}")
            context_parts.append(f"**Citation Number**: [{i}] (USE THIS EXACT NUMBER)")
            context_parts.append(f"**Reliability**: {source_info.get('reliability', 'unknown')}")

            # Summary
            summary = finding.get("summary", "")
            context_parts.append(f"\n**Summary**: {summary}")

            # Key facts
            key_facts = finding.get("key_facts", [])
            if key_facts:
                context_parts.append("\n**Key Facts**:")
                for fact in key_facts:
                    context_parts.append(f"- {fact}")

            # Metadata
            metadata = finding.get("metadata", {})
            relevance = metadata.get("relevance_score", 0)
            confidence = metadata.get("confidence", 0)
            context_parts.append(f"\n*Relevance: {relevance:.2f}, Confidence: {confidence:.2f}*")
            context_parts.append("")

        # Gap analysis (if available)
        if gaps:
            context_parts.append("## Gap Analysis")
            severity = gaps.get("overall_severity", "unknown")
            confidence = gaps.get("confidence", 0)
            context_parts.append(f"**Overall Severity**: {severity}")
            context_parts.append(f"**Confidence**: {confidence:.2f}")

            gap_list = gaps.get("gaps", [])
            if gap_list:
                context_parts.append(f"\n**Identified Gaps ({len(gap_list)})**:")
                for gap in gap_list:
                    context_parts.append(f"\n- **{gap.get('type', 'Unknown')}** ({gap.get('severity', 'unknown')})")
                    context_parts.append(f"  Description: {gap.get('description', '')}")

            recommendations = gaps.get("recommendations", [])
            if recommendations:
                context_parts.append(f"\n**Recommendations**:")
                for rec in recommendations:
                    context_parts.append(f"- {rec}")

        return "\n".join(context_parts)

    def _parse_report_response(
        self,
        content: str,
        findings: List[dict],
    ) -> dict[str, Any]:
        """Parse and validate the LLM report response."""
        import json

        content = content.strip()
        logger.info(f"[Writer] Raw response length: {len(content)} chars")
        
        if not content:
            logger.error("[Writer] Empty response from LLM")
            return self._create_error_report("LLM returned empty response")

        # Handle potential markdown code blocks
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        try:
            report = json.loads(content)
            logger.info(f"[Writer] Parsed JSON report with keys: {list(report.keys())}")
        except json.JSONDecodeError as e:
            # Fallback: treat as raw markdown report
            logger.warning(f"[Writer] Failed to parse JSON report: {e}")
            logger.info(f"[Writer] Using fallback with raw content ({len(content)} chars)")
            report = {
                "title": "Research Report",
                "executive_summary": content[:500] if len(content) > 500 else content,
                "sections": [{"heading": "Findings", "content": content}],
                "sources_used": [],
                "confidence_assessment": "Unable to assess confidence due to parsing error",
                "word_count": len(content.split()),
            }

        # Ensure required fields exist
        if not report.get("title"):
            report["title"] = "Research Report"
        if not report.get("executive_summary"):
            report["executive_summary"] = "No executive summary generated."
        if not report.get("sections"):
            report["sections"] = []
        if not report.get("confidence_assessment"):
            report["confidence_assessment"] = "Confidence not assessed."

        # Ensure sources_used is populated if empty
        if not report.get("sources_used"):
            logger.info("[Writer] Populating sources_used from findings")
            report["sources_used"] = self._extract_sources_from_findings(findings)

        # Validate and fix citations
        report = self._validate_citations(report, findings)

        # Ensure word_count is set
        if not report.get("word_count"):
            total_text = report.get("executive_summary", "")
            for section in report.get("sections", []):
                total_text += section.get("content", "")
            report["word_count"] = len(total_text.split())
            logger.info(f"[Writer] Calculated word count: {report['word_count']}")

        return report

    def _extract_sources_from_findings(
        self,
        findings: List[dict],
    ) -> List[dict]:
        """Extract unique sources from findings with complete metadata."""
        sources = []
        seen_urls = set()

        for i, finding in enumerate(findings, 1):
            source_info = finding.get("source_info", {})
            url = source_info.get("url", "")

            if url and url not in seen_urls:
                seen_urls.add(url)
                
                # Extract domain from URL
                domain = self._extract_domain(url)
                
                # Get confidence from metadata
                metadata = finding.get("metadata", {})
                confidence = metadata.get("confidence", 0.8)
                
                sources.append({
                    "id": f"source-{i:03d}",
                    "url": url,
                    "title": source_info.get("title", "Unknown"),
                    "domain": domain,
                    "reliability": source_info.get("reliability", "medium"),
                    "confidence": confidence,
                })

        return sources
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL."""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.netloc
            # Remove www. prefix if present
            if domain.startswith("www."):
                domain = domain[4:]
            return domain
        except Exception:
            return "unknown"

    def _validate_citations(
        self,
        report: dict[str, Any],
        findings: List[dict],
    ) -> dict[str, Any]:
        """
        Validate citations in report content match available sources.
        
        Removes or fixes citations that don't correspond to actual sources.
        """
        import re
        
        max_valid_citation = len(findings)
        if max_valid_citation == 0:
            logger.warning("No findings available for citation validation")
            return report
        
        # Pattern to match citations like [1], [2], [1][2], etc.
        citation_pattern = r'\[(\d+)\]'
        
        def fix_citations_in_text(text: str) -> str:
            """Remove invalid citations from text."""
            def replace_invalid_citation(match):
                citation_num = int(match.group(1))
                if 1 <= citation_num <= max_valid_citation:
                    return match.group(0)  # Keep valid citation
                else:
                    logger.warning(f"Removing invalid citation [{citation_num}], max valid is [{max_valid_citation}]")
                    return ""  # Remove invalid citation
            
            return re.sub(citation_pattern, replace_invalid_citation, text)
        
        # Fix citations in executive_summary
        if report.get("executive_summary"):
            report["executive_summary"] = fix_citations_in_text(report["executive_summary"])
        
        # Fix citations in sections
        for section in report.get("sections", []):
            if section.get("content"):
                section["content"] = fix_citations_in_text(section["content"])
        
        # Ensure sources_used matches findings
        report["sources_used"] = self._extract_sources_from_findings(findings)
        
        # Log validation result
        logger.info(f"Citation validation complete. Valid range: [1]-[{max_valid_citation}]")
        
        return report

    def _create_error_report(self, error_message: str) -> dict[str, Any]:
        """Create a minimal report structure for error cases."""
        return {
            "title": "Research Report (Error)",
            "executive_summary": f"Unable to generate complete report: {error_message}",
            "sections": [],
            "sources_used": [],  # Empty but with consistent structure
            "confidence_assessment": "Failed - insufficient data",
            "word_count": 0,
            "error": error_message,
        }


# Singleton instance
_writer_instance: Optional[WriterAgent] = None


def get_writer() -> WriterAgent:
    """Get singleton WriterAgent instance."""
    global _writer_instance
    if _writer_instance is None:
        _writer_instance = WriterAgent()
    return _writer_instance
