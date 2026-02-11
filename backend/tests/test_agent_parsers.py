from app.agents.finder import SourceFinderAgent
from app.agents.planner import PlannerAgent
from app.agents.reviewer import ReviewerAgent
from app.agents.summarizer import SummarizerAgent
from app.agents.writer import WriterAgent


def test_planner_parser_extracts_json_from_fence():
    planner = PlannerAgent.__new__(PlannerAgent)
    parsed = planner._parse_plan_output(
        """```json
        {"sub_questions":[{"id":"sq-001","question":"Q"}]}
        ```"""
    )
    assert parsed["sub_questions"][0]["id"] == "sq-001"


def test_finder_parser_fallback_on_invalid_json():
    finder = SourceFinderAgent.__new__(SourceFinderAgent)
    parsed = finder._parse_search_plan("not json content at all")
    assert "search_queries" in parsed
    assert len(parsed["search_queries"]) >= 1


def test_summarizer_parser_returns_safe_default():
    summarizer = SummarizerAgent.__new__(SummarizerAgent)
    parsed = summarizer._parse_summary("freeform answer without json")
    assert "summary" in parsed
    assert "key_facts" in parsed
    assert isinstance(parsed["key_facts"], list)


def test_reviewer_parser_returns_safe_default():
    reviewer = ReviewerAgent.__new__(ReviewerAgent)
    parsed = reviewer._parse_review("malformed output")
    assert parsed["has_gaps"] is False
    assert isinstance(parsed["gaps"], list)


def test_writer_parser_extracts_json_from_mixed_output():
    writer = WriterAgent.__new__(WriterAgent)
    findings = [
        {
            "source_info": {
                "url": "https://example.com/source",
                "title": "Example Source",
                "reliability": "high",
            }
        }
    ]
    parsed = writer._parse_report_response(
        "Here is your report:\n```json\n"
        '{"title":"T","executive_summary":"S","sections":[{"heading":"H","content":"C"}],'
        '"sources_used":[],"confidence_assessment":"ok","word_count":12}\n```',
        findings,
    )
    assert parsed is not None
    assert parsed["title"] == "T"
    assert len(parsed["sources_used"]) == 1


def test_writer_parser_returns_none_for_non_json_text():
    writer = WriterAgent.__new__(WriterAgent)
    parsed = writer._parse_report_response("plain markdown report without json", [])
    assert parsed is None
