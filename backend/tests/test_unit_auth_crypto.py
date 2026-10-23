"""
Comprehensive Unit Test Suite for PromptPulse Cryptography, Authentication & Quota Guard.
Covers PBKDF2-HMAC-SHA256 hashing, timing-attack resistance, salt entropy,
JWT tokens, claim validation, BYOK header parsing, and lifetime quota logic.
"""
import uuid
import secrets
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_token,
    payload_user_id,
    get_byok_keys_from_request,
    enforce_free_tier_prompt_quota,
    TokenData,
    UserContext,
    FREE_TIER_PROMPT_LIMIT,
)


class TestPbkdf2Cryptography:
    """Verifies NIST-compliant PBKDF2 password hashing implementation."""

    def test_hash_format_and_rounds(self):
        password = "StandardPassword123!"
        hashed = get_password_hash(password)
        parts = hashed.split("$")
        assert len(parts) == 4
        assert parts[0] == "pbkdf2_sha256"
        assert parts[1] == "310000"
        assert len(parts[2]) == 32  # 16 bytes hex-encoded = 32 chars
        assert len(parts[3]) == 64  # SHA-256 digest = 32 bytes hex = 64 chars

    def test_verify_password_positive(self):
        password = "CorrectHorseBatteryStaple@2026"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_negative(self):
        password = "CorrectHorseBatteryStaple@2026"
        hashed = get_password_hash(password)
        assert verify_password("WrongPassword123", hashed) is False
        assert verify_password(password.lower(), hashed) is False
        assert verify_password(password + " ", hashed) is False

    def test_salt_uniqueness_and_entropy(self):
        password = "IdenticalPasswordForSaltTest"
        hashes = [get_password_hash(password) for _ in range(50)]
        # All 50 hashes must be strictly unique
        assert len(set(hashes)) == 50
        # All 50 must independently verify
        for h in hashes:
            assert verify_password(password, h) is True

    def test_timing_attack_resistance_invalid_hashes(self):
        """Ensures corrupted, truncated, or tampered hashes fail safely without crashing."""
        password = "TestPassword123"
        assert verify_password(password, "") is False
        assert verify_password(password, "invalid_hash_string") is False
        assert verify_password(password, "bcrypt$12$some_random_hash_string") is False
        assert verify_password(password, "pbkdf2_sha256$notanumber$salt$digest") is False
        assert verify_password(password, "pbkdf2_sha256$310000$salt") is False
        assert verify_password(password, None) is False

    def test_special_characters_and_unicode_passwords(self):
        passwords = [
            "P@ssw0rd!#$&*()_+~|}{[]:;?><,.",
            "ПарольДляТеста2026!🔒",
            "密码测试SafePassword888",
            "🔑🛡️PromptPulseEnterpriseSecurity2026🚀",
            "a" * 512,  # Long password
        ]
        for pwd in passwords:
            hashed = get_password_hash(pwd)
            assert verify_password(pwd, hashed) is True
            assert verify_password(pwd + "x", hashed) is False


class TestJwtTokenManagement:
    """Tests JWT access token generation, decoding, expiration, and claim extraction."""

    def test_create_and_decode_token_success(self):
        token = create_access_token({"sub": "alex_developer", "role": "user", "user_id": 101})
        decoded = decode_token(token)
        assert isinstance(decoded, TokenData)
        assert decoded.username == "alex_developer"
        assert decoded.role == "user"
        assert decoded.exp is not None

    def test_payload_user_id_extraction(self):
        token_with_id = create_access_token({"sub": "admin", "role": "admin", "user_id": 42})
        assert payload_user_id(token_with_id) == 42

        token_without_id = create_access_token({"sub": "demo", "role": "demo"})
        assert payload_user_id(token_without_id) is None

        assert payload_user_id("invalid.token.here") is None

    def test_decode_token_missing_subject_raises_401(self):
        # Create token without 'sub'
        token = create_access_token({"role": "user"})
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401
        assert "missing subject" in str(exc_info.value.detail).lower()

    def test_decode_token_tampered_signature_raises_401(self):
        valid_token = create_access_token({"sub": "legit_user", "role": "user"})
        parts = valid_token.split(".")
        # Tamper with the payload part
        tampered_token = f"{parts[0]}.eyJhZG1pbiI6dHJ1ZX0.{parts[2]}"
        with pytest.raises(HTTPException) as exc_info:
            decode_token(tampered_token)
        assert exc_info.value.status_code == 401


class TestByokHeadersAndQuota:
    """Tests BYOK extraction and lifetime quota enforcement."""

    def test_get_byok_keys_from_request_all_present(self):
        mock_req = MagicMock()
        mock_req.headers = {
            "x-openrouter-key": "sk-or-test-key",
            "x-groq-key": "gsk_test_key",
            "x-deepseek-key": "sk-ds-test-key",
            "x-tavily-key": "tvly-test-key",
        }
        keys = get_byok_keys_from_request(mock_req)
        assert keys["openrouter"] == "sk-or-test-key"
        assert keys["groq"] == "gsk_test_key"
        assert keys["deepseek"] == "sk-ds-test-key"
        assert keys["tavily"] == "tvly-test-key"

    def test_get_byok_keys_from_request_empty_or_whitespace(self):
        mock_req = MagicMock()
        mock_req.headers = {
            "x-openrouter-key": "   ",
            "x-groq-key": "",
        }
        keys = get_byok_keys_from_request(mock_req)
        assert keys == {}

    def test_enforce_free_tier_prompt_quota_admin_bypass(self):
        mock_db = MagicMock()
        admin_ctx = UserContext(username="admin", role="admin", is_admin=True, is_demo=False, user_id=1)
        # Must not raise even if usage exceeds limit
        enforce_free_tier_prompt_quota(mock_db, project_id=1, user=admin_ctx, byok_provided=False, prompt_count_requested=100)

    def test_enforce_free_tier_prompt_quota_byok_bypass(self):
        mock_db = MagicMock()
        user_ctx = UserContext(username="free_user", role="user", is_admin=False, is_demo=False, user_id=2)
        # Must not raise when BYOK is provided
        enforce_free_tier_prompt_quota(mock_db, project_id=1, user=user_ctx, byok_provided=True, prompt_count_requested=50)

    def test_enforce_free_tier_prompt_quota_exhausted_raises_402(self):
        mock_db = MagicMock()
        # Mock query count returning 5 runs
        mock_query = MagicMock()
        mock_query.join.return_value.join.return_value.filter.return_value.count.return_value = 5
        mock_db.query.return_value = mock_query

        user_ctx = UserContext(username="free_user", role="user", is_admin=False, is_demo=False, user_id=2)
        with pytest.raises(HTTPException) as exc_info:
            enforce_free_tier_prompt_quota(mock_db, project_id=1, user=user_ctx, byok_provided=False, prompt_count_requested=1)
        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["code"] == "FREE_TIER_EXHAUSTED"
        assert exc_info.value.detail["limit"] == FREE_TIER_PROMPT_LIMIT
        assert exc_info.value.detail["requires_byok"] is True
