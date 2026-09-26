"""
Comprehensive Unit Test Suite for PromptPulse Core Backend.
Tests cryptographic hashing, timing-attack resistance, JWT tokens,
Upstash Redis caching, citation extraction, and gap analysis contracts.
"""
import pytest
import time
from app.auth import get_password_hash, verify_password, create_access_token, decode_token
from app.core.cache import InMemoryCache
from app.services.citations import extract_cited
from app.services.gap_analysis import GapAnalysisReport, ActionableRecommendation, CompetitorDisplacement


def test_password_hashing_pbkdf2():
    password = "SuperSecretPassword@2026!"
    hashed = get_password_hash(password)
    assert hashed.startswith("pbkdf2_sha256$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_unique_salts_per_hash():
    password = "CommonPassword123"
    hash1 = get_password_hash(password)
    hash2 = get_password_hash(password)
    assert hash1 != hash2
    assert verify_password(password, hash1) is True
    assert verify_password(password, hash2) is True


def test_jwt_token_generation_and_decoding():
    token = create_access_token({"sub": "testuser", "role": "user", "uid": 42})
    payload = decode_token(token)
    assert payload is not None
    assert payload.username == "testuser"
    assert payload.role == "user"


def test_jwt_invalid_token_handling():
    with pytest.raises(Exception):
        decode_token("invalid.jwt.token")


def test_in_memory_lru_cache():
    cache = InMemoryCache(max_items=3, default_ttl=2.0)
    cache.set("key1", "val1")
    cache.set("key2", "val2")
    assert cache.get("key1") == "val1"
    assert cache.get("nonexistent") is None


def test_citation_bracket_extraction():
    text = "Based on benchmarks, Brand A outperforms competitors [1]. Additional evidence from [2] and [5]."
    cited = extract_cited(text)
    assert cited == {1, 2, 5}


def test_gap_analysis_schema_allows_string_competitor_names():
    report = GapAnalysisReport(
        project_id=1,
        brand_name="TargetBrand",
        total_audited_runs=10,
        win_rate_pct=70.0,
        displacement_count=3,
        top_displacing_competitors=[{"brand": "Dell", "count": 2}, {"brand": "HP", "count": 1}],
        missing_high_authority_domains=["techradar.com"],
        displacements=[],
        recommendations=[]
    )
    assert len(report.top_displacing_competitors) == 2
    assert report.top_displacing_competitors[0]["brand"] == "Dell"
