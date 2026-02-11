"""
Writer Agent - Synthesizes research findings into formatted reports with citations.
"""
import json
import logging
import re
from typing import Any

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
        report_length: str = "medium",
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
        context = self._build_context(
            query=query,
            plan=plan,
            findings=findings,
            gaps=gaps,
            report_length=report_length,
            max_length=max_length,
        )

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
                response_format="json",
            )

            content = str(response.get("message", {}).get("content", "")).strip()
            report = self._parse_report_response(content, findings)

            if report is None:
                logger.info("[Writer] Initial output was not valid JSON, requesting repair pass")
                repaired_content = await self._repair_report_output(content)
                report = self._parse_report_response(repaired_content, findings)

            if report is None:
                logger.warning("[Writer] JSON repair failed, falling back to markdown structure")
                report = self._fallback_report_from_raw(content, findings)

            logger.info(f"Report generated: {report.get('title', 'Untitled')}")
            logger.info(f"Word count: {report.get('word_count', 0)}")

            return report

        except Exception as e:
            logger.error(f"Error generating report: {e}")
            return self._create_error_report(str(e))

    def _build_context(
        self,
        query: str,
        plan: list[dict | str],
        findings: list[dict],
        gaps: dict,
        report_length: str,
        max_length: int,
    ) -> str:
        """Build structured context for the writer LLM."""
        context_parts = []
        target_words = self._target_word_count(report_length, max_length)
        
        logger.info(
            "[Writer] Building context with %s findings, target_words=%s",
            len(findings),
            target_words,
        )

        # Original query
        context_parts.append(f"# Original Research Query\n{query}\n")
        context_parts.append("## Runtime Constraints")
        context_parts.append(f"- Target report length: {report_length}")
        context_parts.append(f"- Approximate max words: {target_words}")
        context_parts.append("")

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

        # All findings with citation information
        context_parts.append(f"## Research Findings ({len(findings)} sources)\n")
        context_parts.append("**CITATION FORMAT (CRITICAL - USE MARKDOWN LINKS):**")
        context_parts.append('Format: [🔗 Source Title](Source URL)')
        context_parts.append("")
        context_parts.append("**Available Sources:**")
        for i, finding in enumerate(findings, 1):
            if not isinstance(finding, dict):
                continue
            source_info = finding.get("source_info", {})
            if not isinstance(source_info, dict):
                source_info = {}
            url = source_info.get('url', 'Unknown')
            title = source_info.get('title', 'Unknown')
            context_parts.append(f"  Source {i}: [{title}]({url})")
        context_parts.append("")
        context_parts.append("---")
        context_parts.append("")
        
        for i, finding in enumerate(findings, 1):
            if not isinstance(finding, dict):
                continue
            source_info = finding.get("source_info", {})
            if not isinstance(source_info, dict):
                source_info = {}
            url = source_info.get('url', 'Unknown')
            title = source_info.get('title', 'Unknown')
            
            context_parts.append(f"### Finding {i}")

            # Source info
            context_parts.append(f"**Source URL**: {url}")
            context_parts.append(f"**Source Title**: {title}")
            context_parts.append(f"**Citation to use**: [🔗 {title}]({url})")
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
            if not isinstance(metadata, dict):
                metadata = {}
            relevance = metadata.get("relevance_score", 0)
            confidence = metadata.get("confidence", 0)
            context_parts.append(f"\n*Relevance: {relevance:.2f}, Confidence: {confidence:.2f}*")
            context_parts.append("")

        # Gap analysis (if available)
        if isinstance(gaps, dict) and gaps:
            context_parts.append("## Gap Analysis")
            severity = gaps.get("overall_severity", "unknown")
            confidence = gaps.get("confidence", 0)
            context_parts.append(f"**Overall Severity**: {severity}")
            context_parts.append(f"**Confidence**: {confidence:.2f}")

            gap_list = gaps.get("gaps", [])
            if isinstance(gap_list, list) and gap_list:
                context_parts.append(f"\n**Identified Gaps ({len(gap_list)})**:")
                for gap in gap_list:
                    if not isinstance(gap, dict):
                        continue
                    context_parts.append(f"\n- **{gap.get('type', 'Unknown')}** ({gap.get('severity', 'unknown')})")
                    context_parts.append(f"  Description: {gap.get('description', '')}")

            recommendations = gaps.get("recommendations", [])
            if isinstance(recommendations, list) and recommendations:
                context_parts.append(f"\n**Recommendations**:")
                for rec in recommendations:
                    context_parts.append(f"- {rec}")

        return "\n".join(context_parts)

    def _parse_report_response(
        self,
        content: str,
        findings: list[dict],
    ) -> dict[str, Any] | None:
        """Parse and validate a JSON report response."""
        content = content.strip()
        logger.info(f"[Writer] Raw response length: {len(content)} chars")

        if not content:
            return None

        report = self._parse_json_payload(content)
        if report is None:
            return None

        # Ensure required fields exist
        if not report.get("title"):
            report["title"] = "Research Report"
        if not report.get("executive_summary"):
            report["executive_summary"] = "No executive summary generated."
        report["sections"] = self._normalize_sections(report.get("sections"))
        if not report.get("confidence_assessment"):
            report["confidence_assessment"] = "Confidence not assessed."
        report["sources_used"] = self._normalize_sources(report.get("sources_used"))

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
                if not isinstance(section, dict):
                    continue
                total_text += section.get("content", "")
            report["word_count"] = len(total_text.split())
            logger.info(f"[Writer] Calculated word count: {report['word_count']}")

        return report

    async def _repair_report_output(self, content: str) -> str:
        """
        Request a strict JSON rewrite when model output is malformed.
        """
        if not content:
            return ""

        repair_system = (
            "Return valid JSON only. No markdown fences, no commentary. "
            "Match the target schema exactly."
        )
        repair_user = (
            "Rewrite the following report text into strict JSON with fields: "
            "title, executive_summary, sections[{heading,content}], "
            "sources_used[{url,title,reliability}], confidence_assessment, word_count.\n\n"
            "INPUT:\n"
            f"{content[:12000]}"
        )
        try:
            response = await self.adapter.chat_completion(
                messages=[
                    {"role": "system", "content": repair_system},
                    {"role": "user", "content": repair_user},
                ],
                enable_thinking=False,
                stream=False,
                response_format="json",
            )
            return str(response.get("message", {}).get("content", "")).strip()
        except Exception as exc:
            logger.warning("[Writer] Repair pass failed: %s", exc)
            return ""

    def _parse_json_payload(self, content: str) -> dict[str, Any] | None:
        """
        Parse JSON object from model output with robust extraction.
        """
        candidate = self._extract_json_candidate(content)
        if not candidate:
            return None

        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            repaired = re.sub(r",(\s*[}\]])", r"\1", candidate)
            try:
                parsed = json.loads(repaired)
            except json.JSONDecodeError:
                return None

        if not isinstance(parsed, dict):
            return None
        logger.info("[Writer] Parsed JSON report with keys: %s", list(parsed.keys()))
        return parsed

    def _extract_json_candidate(self, content: str) -> str:
        """Extract most likely JSON object from mixed model output."""
        fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", content, re.DOTALL | re.IGNORECASE)
        if fence_match:
            return fence_match.group(1).strip()

        stripped = content.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            return stripped

        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end == -1 or start >= end:
            return ""
        return stripped[start:end + 1].strip()

    def _fallback_report_from_raw(
        self,
        content: str,
        findings: list[dict],
    ) -> dict[str, Any]:
        """Create a usable report structure from raw freeform text."""
        report = {
            "title": "Research Report",
            "executive_summary": content[:500] if len(content) > 500 else content,
            "sections": [{"heading": "Findings", "content": content}],
            "sources_used": [],
            "confidence_assessment": "Confidence reduced because model returned malformed structured output.",
            "word_count": len(content.split()),
        }
        report["sources_used"] = self._extract_sources_from_findings(findings)
        return report

    def _extract_sources_from_findings(
        self,
        findings: list[dict],
    ) -> list[dict]:
        """Extract unique sources from findings with complete metadata."""
        sources = []
        seen_urls = set()

        for i, finding in enumerate(findings, 1):
            if not isinstance(finding, dict):
                continue
            source_info = finding.get("source_info", {})
            if not isinstance(source_info, dict):
                source_info = {}
            url = source_info.get("url", "")

            if url and url not in seen_urls:
                seen_urls.add(url)
                
                # Extract domain from URL
                domain = self._extract_domain(url)
                
                # Get confidence from metadata
                metadata = finding.get("metadata", {})
                if not isinstance(metadata, dict):
                    metadata = {}
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
        findings: list[dict],
    ) -> dict[str, Any]:
        """
        Validate citations in report content and ensure sources_used is populated.
        
        With markdown link citations [🔗 Title](URL), we verify URLs match sources.
        """
        import re
        
        if not findings:
            logger.warning("No findings available for citation validation")
            return report
        
        # Extract valid URLs from findings
        valid_urls = set()
        for finding in findings:
            if not isinstance(finding, dict):
                continue
            source_info = finding.get("source_info", {})
            if not isinstance(source_info, dict):
                source_info = {}
            url = source_info.get("url", "")
            if url:
                valid_urls.add(url)
        
        # Pattern to match markdown link citations [🔗 Title](URL)
        link_pattern = r'\[🔗[^\]]*\]\(([^)]+)\)'
        
        def validate_link_citations(text: str) -> str:
            """Validate and fix link citations in text."""
            def replace_invalid_link(match):
                url = match.group(1)
                if url in valid_urls:
                    return match.group(0)  # Keep valid citation
                else:
                    logger.warning(f"Citation URL not in sources: {url[:60]}...")
                    return ""  # Remove invalid citation
            
            return re.sub(link_pattern, replace_invalid_link, text)
        
        # Also check for old-style [N] citations and convert/warn
        old_citation_pattern = r'\[(\d+)\]'
        
        def convert_old_citations(text: str) -> str:
            """Convert old [N] citations to link format if possible."""
            def replace_old_citation(match):
                citation_num = int(match.group(1))
                if 1 <= citation_num <= len(findings):
                    # Try to get URL and title from findings
                    finding = findings[citation_num - 1]
                    if not isinstance(finding, dict):
                        return ""
                    source_info = finding.get("source_info", {})
                    if not isinstance(source_info, dict):
                        source_info = {}
                    url = source_info.get("url", "")
                    title = source_info.get("title", f"Source {citation_num}")
                    if url:
                        return f"[🔗 {title}]({url})"
                logger.warning(f"Removing invalid citation [{citation_num}]")
                return ""
            
            return re.sub(old_citation_pattern, replace_old_citation, text)
        
        # Fix citations in executive_summary
        if report.get("executive_summary"):
            text = report["executive_summary"]
            # First try to convert old-style citations
            text = convert_old_citations(text)
            # Then validate link citations
            text = validate_link_citations(text)
            report["executive_summary"] = text
        
        # Fix citations in sections
        for section in report.get("sections", []):
            if not isinstance(section, dict):
                continue
            if section.get("content"):
                text = section["content"]
                text = convert_old_citations(text)
                text = validate_link_citations(text)
                section["content"] = text
        
        # Ensure sources_used matches findings
        report["sources_used"] = self._extract_sources_from_findings(findings)
        
        # Log validation result
        logger.info(f"Citation validation complete. {len(valid_urls)} valid source URLs.")
        
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

    def _target_word_count(self, report_length: str, max_length: int) -> int:
        """Translate report length preset to target words with hard upper bound."""
        presets = {
            "short": 900,
            "medium": 1500,
            "long": 2300,
        }
        return min(presets.get(report_length, 1500), max_length)

    def _normalize_sections(self, sections: Any) -> list[dict[str, str]]:
        """Normalize report sections into a safe list of heading/content dictionaries."""
        if not isinstance(sections, list):
            return []
        normalized: list[dict[str, str]] = []
        for section in sections:
            if not isinstance(section, dict):
                continue
            normalized.append(
                {
                    "heading": str(section.get("heading", "Untitled Section")),
                    "content": str(section.get("content", "")),
                }
            )
        return normalized

    def _normalize_sources(self, sources: Any) -> list[dict[str, Any]]:
        """Normalize sources list and drop malformed entries."""
        if not isinstance(sources, list):
            return []
        normalized: list[dict[str, Any]] = []
        for source in sources:
            if not isinstance(source, dict):
                continue
            normalized.append(
                {
                    "url": str(source.get("url", "")),
                    "title": str(source.get("title", "Untitled Source")),
                    "reliability": str(source.get("reliability", "unknown")),
                    "domain": str(source.get("domain", "")),
                    "confidence": source.get("confidence", 0.0),
                }
            )
        return normalized


# Singleton instance
_writer_instance: WriterAgent | None = None


def get_writer() -> WriterAgent:
    """Get singleton WriterAgent instance."""
    global _writer_instance
    if _writer_instance is None:
        _writer_instance = WriterAgent()
    return _writer_instance
