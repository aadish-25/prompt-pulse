import pytest
from pydantic import ValidationError
from app.services.citations import extract_cited
from app.services.extraction import find_target_mentions
from app.schemas import TrackingBatchCreate
from app.config import MAX_VARIANT_COUNT


# ── 1. Brand Mention Word-Boundary Tests ───────────────────────────────────────

def test_mention_detection_exact_and_boundary():
    """Verify that whole-word brand matching works and substring false positives are ignored."""
    answer = (
        "1. boAt Airdopes 800 is a popular budget choice.\n"
        "2. We saw a sailboat drifting in the ocean.\n"
        "3. The debate over audio quality continues.\n"
        "4. Bata makes comfortable formal shoes."
    )

    # Search for boAt
    mentions = find_target_mentions(answer, brand_name="boAt", aliases=[])
    assert len(mentions) == 1
    assert mentions[0].matched_as == "boAt"
    assert "Airdopes 800" in mentions[0].sentence
    # Crucial: "sailboat" must NOT match "boAt"
    assert not any("sailboat" in m.sentence for m in mentions)

    # Search for Bata
    mentions_bata = find_target_mentions(answer, brand_name="Bata", aliases=[])
    assert len(mentions_bata) == 1
    assert "comfortable formal shoes" in mentions_bata[0].sentence
    # Crucial: "debate" must NOT match "Bata"
    assert not any("debate" in m.sentence for m in mentions_bata)


def test_mention_detection_with_aliases():
    """Verify that brand aliases are also matched accurately."""
    answer = "The product is marketed by GCMMF across northern states."
    mentions = find_target_mentions(
        answer, brand_name="Amul", aliases=["GCMMF", "Amul Dairy"]
    )
    assert len(mentions) == 1
    assert mentions[0].matched_as == "GCMMF"


def test_mention_detection_case_insensitive():
    """Verify case-insensitivity in mentions."""
    answer = "Many users prefer boat lifestyle products for running."
    mentions = find_target_mentions(answer, brand_name="boAt", aliases=[])
    assert len(mentions) == 1
    assert mentions[0].matched_as == "boAt"


# ── 2. Citation Extraction Tests ──────────────────────────────────────────────

def test_extract_inline_citations():
    """Verify inline square bracket citations are captured."""
    answer = "Nike Pegasus is great [2]. Puma Velocity is lightweight [5][8]."
    cited = extract_cited(answer)
    assert cited == {2, 5, 8}


def test_extract_cited_footer():
    """Verify CITED: footer citations are captured."""
    answer = (
        "Here are top headphones:\n"
        "1. Sony XM5\n"
        "2. Bose QC45\n\n"
        "CITED: 1, 3, 7"
    )
    cited = extract_cited(answer)
    assert cited == {1, 3, 7}


def test_extract_legacy_sources_used_footer():
    """Verify backward compatibility with 'Sources used:' footer."""
    answer = "Amul butter is popular.\n\nSources used: 2, 4"
    cited = extract_cited(answer)
    assert cited == {2, 4}


def test_extract_empty_when_no_citations():
    """Verify empty set when no citations are present."""
    answer = "No citations in this answer at all."
    cited = extract_cited(answer)
    assert cited == set()


# ── 3. Summary Metric Calculations ────────────────────────────────────────────

def test_summary_calculation_formulas():
    """Verify visibility and own-domain citation percentage formulas."""
    total_runs = 5
    mentioned_count = 4
    own_domain_cited_count = 1

    visibility_percentage = round((mentioned_count / total_runs) * 100, 1)
    own_domain_citation_percentage = round(
        (own_domain_cited_count / total_runs) * 100, 1
    )

    assert visibility_percentage == 80.0
    assert own_domain_citation_percentage == 20.0


# ── 4. Variant Count Clamping Logic ───────────────────────────────────────────

def test_variant_count_bounds():
    """Verify that variant count bounds adhere to min=1 and max=MAX_VARIANT_COUNT."""
    def clamp_count(c: int) -> int:
        return max(1, min(c, MAX_VARIANT_COUNT))

    assert clamp_count(0) == 1
    assert clamp_count(-5) == 1
    assert clamp_count(5) == 5
    assert clamp_count(10) == 10
    assert clamp_count(50) == 10  # clamped to MAX_VARIANT_COUNT


# ── 5. Schema Validations ─────────────────────────────────────────────────────

def test_tracking_batch_rounds_validation():
    """Verify rounds must be between 1 and 3."""
    # Valid
    b1 = TrackingBatchCreate(rounds=1)
    assert b1.rounds == 1
    b3 = TrackingBatchCreate(rounds=3, model="openai/gpt-4o")
    assert b3.rounds == 3
    assert b3.model == "openai/gpt-4o"

    # Invalid (< 1 or > 3)
    with pytest.raises(ValidationError):
        TrackingBatchCreate(rounds=0)

    with pytest.raises(ValidationError):
        TrackingBatchCreate(rounds=4)


# ── 6. Project Lifecycle & Empty State API Tests ──────────────────────────────

def test_project_lifecycle_empty_state_and_delete():
    """Verify that newly created projects have empty state and can be deleted cleanly."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    # 1. Create a brand new project (Lenovo)
    create_res = client.post(
        "/projects",
        json={
            "brand_name": "Test Lenovo",
            "domain": ["lenovo.com"],
            "competitors": ["HP", "Dell", "Asus"],
            "aliases": ["Lenovo Group"]
        }
    )
    assert create_res.status_code in (200, 201)
    proj = create_res.json()
    proj_id = proj["id"]
    assert proj["brand_name"] == "Test Lenovo"

    try:
        # 2. Check that prompts are completely empty
        prompts_res = client.get(f"/projects/{proj_id}/prompts")
        assert prompts_res.status_code == 200
        assert prompts_res.json() == []

        # 3. Check that summary has 0 runs, 0.0 visibility, and empty top competitors
        summary_res = client.get(f"/projects/{proj_id}/summary")
        assert summary_res.status_code == 200
        summary = summary_res.json()
        assert summary["total_runs"] == 0
        assert summary["mentioned_count"] == 0
        assert summary["visibility_percentage"] == 0.0
        assert summary["top_competitors"] == []

        # 4. Check results / executions list is empty
        results_res = client.get(f"/projects/{proj_id}/results")
        assert results_res.status_code == 200
        assert results_res.json() == []

        # 5. Check citations list is empty
        citations_res = client.get(f"/projects/{proj_id}/citations")
        assert citations_res.status_code == 200
        assert citations_res.json() == []
    finally:
        # 6. Delete the project
        del_res = client.delete(f"/projects/{proj_id}")
        assert del_res.status_code == 204

        # Verify project is gone
        get_res = client.get(f"/projects/{proj_id}")
        assert get_res.status_code == 404
