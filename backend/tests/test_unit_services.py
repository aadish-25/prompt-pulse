"""
Comprehensive Unit Test Suite for PromptPulse Services & Intelligence Engines.
Covers deterministic citation extraction, brand mention extraction with fuzzy matching,
sentiment categorization, GEO intent classification, and gap analysis algorithms.
"""
from unittest.mock import MagicMock
import pytest
from app.services.citations import extract_cited
from app.services.extraction import find_target_mentions, ExtractedBrandMention
from app.services.intent import classify_prompt_intent, IntentClassification
from app.services.gap_analysis import (
    GapAnalysisReport,
    ActionableRecommendation,
    CompetitorDisplacement,
    generate_gap_analysis,
    HIGH_AUTHORITY_GEO_DOMAINS,
)
from app import models


class TestCitationExtraction:
    """Tests deterministic bracket citation parsing."""

    def test_single_bracket_citation(self):
        text = "According to comprehensive audio benchmarks, this model leads [1]."
        assert extract_cited(text) == {1}

    def test_multiple_individual_citations(self):
        text = "Key evidence from lab trials [1], user surveys [3], and warranty claims [12]."
        assert extract_cited(text) == {1, 3, 12}

    def test_comma_separated_citations_in_single_bracket(self):
        text = "Consensus from multiple independent reviewers [1, 2, 5]."
        assert extract_cited(text) == {1, 2, 5}

    def test_space_separated_citations_in_bracket(self):
        text = "Cited in recent studies [2 4 8]."
        assert extract_cited(text) == {2, 4, 8}

    def test_consecutive_brackets(self):
        text = "Recommended for enterprise deployments [1][2][7]."
        assert extract_cited(text) == {1, 2, 7}

    def test_non_numeric_brackets_ignored(self):
        text = "This claim requires verification [citation needed]. See also [table 1] and [appendix a]."
        assert extract_cited(text) == set()

    def test_mixed_valid_and_non_numeric_brackets(self):
        text = "The product is highly rated [1] despite earlier delays [source pending] and exceeds goals [4]."
        assert extract_cited(text) == {1, 4}

    def test_empty_string_and_plain_text(self):
        assert extract_cited("") == set()
        assert extract_cited("Pure text with no brackets whatsoever.") == set()


class TestBrandMentionExtraction:
    """Tests brand mention extraction, alias resolution, and fuzzy match boundaries."""

    def test_exact_brand_name_match(self):
        answer = "Sony and Bose are leading the wireless noise-cancelling market."
        mentions = find_target_mentions(answer, "Sony", aliases=[])
        assert len(mentions) == 1
        assert mentions[0].matched_as == "Sony"
        assert "Sony" in mentions[0].sentence

    def test_case_insensitive_brand_match(self):
        answer = "Customers frequently choose amul over other butter brands."
        mentions = find_target_mentions(answer, "Amul", aliases=[])
        assert len(mentions) == 1
        assert mentions[0].matched_as == "Amul"

    def test_alias_match(self):
        answer = "Manufactured by GCMMF, the cooperative has expanded its dairy line."
        mentions = find_target_mentions(answer, "Amul", aliases=["GCMMF", "Amul Dairy"])
        assert len(mentions) == 1
        assert mentions[0].matched_as == "GCMMF"

    def test_word_boundary_prevents_false_positives(self):
        """Ensure 'Sony' does not match 'persony' or 'sonya'."""
        answer = "Sonya presented a personalized audio demo for the team."
        mentions = find_target_mentions(answer, "Sony", aliases=[])
        # 'Sonya' should not match brand 'Sony'
        matched_tokens = [m.matched_as for m in mentions]
        assert "Sony" not in matched_tokens

    def test_fuzzy_match_for_minor_typos(self):
        """Ensure high-similarity typos (>= 82% match) are captured for brands >= 4 chars."""
        answer = "Many developers recommend Anthroopic for complex code reasoning."
        mentions = find_target_mentions(answer, "Anthropic", aliases=[])
        assert len(mentions) >= 1

    def test_no_mentions_in_unrelated_text(self):
        answer = "Dell and Lenovo offer durable business laptops for remote workers."
        mentions = find_target_mentions(answer, "Apple", aliases=["MacBook", "Mac"])
        assert len(mentions) == 0


class TestGeoIntentClassification:
    """Tests classification of search prompts into 5 core GEO intent categories."""

    def test_competitor_comparison_intent(self):
        res = classify_prompt_intent("How does Slack compare vs Microsoft Teams for startups?")
        assert res.intent == "competitor"
        assert res.confidence >= 0.70

    def test_transactional_pricing_intent(self):
        res = classify_prompt_intent("What is the enterprise subscription pricing and discount for Datadog?")
        assert res.intent == "transaction"
        assert "pricing" in res.signals_detected or "discount" in res.signals_detected

    def test_persona_vertical_intent(self):
        res = classify_prompt_intent("Best CRM software for early-stage healthcare startups")
        assert res.intent in {"persona", "criteria"}

    def test_criteria_feature_intent(self):
        res = classify_prompt_intent("Fastest open source vector database with SOC-2 compliance")
        assert res.intent == "criteria"

    def test_core_need_educational_intent(self):
        res = classify_prompt_intent("How to optimize website load speed for mobile devices")
        assert res.intent == "core_need"


class TestGapAnalysisEngine:
    """Tests the 'Fix My Ranking' gap analysis computations and Pydantic validation."""

    def test_gap_analysis_schema_validates_cleanly(self):
        report = GapAnalysisReport(
            project_id=42,
            brand_name="AeroAudio",
            total_audited_runs=20,
            win_rate_pct=65.0,
            displacement_count=7,
            top_displacing_competitors=[
                {"brand": "Bose", "count": 4},
                {"brand": "Sony", "count": 3},
            ],
            missing_high_authority_domains=["reddit.com", "g2.com"],
            displacements=[
                CompetitorDisplacement(
                    prompt_id=1,
                    prompt_text="Top travel headphones",
                    brand_mentioned=False,
                    competitors_present=["Sony", "Bose"],
                    citations_observed=["rtings.com"],
                    lost_to_competitor="Sony"
                )
            ],
            recommendations=[
                ActionableRecommendation(
                    category="Off-Site Citations",
                    priority="HIGH",
                    title="Engage on Reddit /r/headphones",
                    rationale="Competitors appear in 60% of cited Reddit threads",
                    implementation_steps=["Create verified brand account", "Publish AMA"]
                )
            ]
        )
        assert report.brand_name == "AeroAudio"
        assert len(report.top_displacing_competitors) == 2
        assert report.top_displacing_competitors[0]["brand"] == "Bose"
        assert report.top_displacing_competitors[0]["count"] == 4

    def test_generate_gap_analysis_empty_executions(self):
        mock_db = MagicMock()
        mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = []

        mock_project = models.Project(id=1, brand_name="TargetBrand", domain=["target.com"])
        report = generate_gap_analysis(mock_db, mock_project)

        assert report.total_audited_runs == 0
        assert report.win_rate_pct == 0.0
        assert report.displacement_count == 0
        assert report.top_displacing_competitors == []
        assert len(report.recommendations) > 0  # Should provide baseline getting started recommendation
