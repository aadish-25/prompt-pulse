"""
Comprehensive API Integration Test Suite for PromptPulse Projects, Settings,
Prompts, Runs, Analytics, and Multi-Tenant Isolation.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import SessionLocal
from app import models

client = TestClient(app)


def _create_user_and_headers(prefix: str = "tenant") -> tuple[str, dict]:
    uname = f"{prefix}_{uuid.uuid4().hex[:8]}"
    res = client.post("/api/auth/register", json={
        "username": uname,
        "email": f"{uname}@testpulse.io",
        "password": "Password@2026!"
    })
    token = res.json()["access_token"]
    return uname, {"Authorization": f"Bearer {token}"}


class TestSystemDiagnosticsAndCatalogs:
    """Tests health, model catalog, and cache telemetry."""

    def test_health_checks(self):
        res1 = client.get("/health")
        assert res1.status_code == 200
        assert res1.json()["status"] == "ok"

        res2 = client.get("/api/health")
        assert res2.status_code == 200
        assert res2.json()["status"] == "ok"

    def test_models_catalog(self):
        res = client.get("/api/models")
        assert res.status_code == 200
        data = res.json()
        assert "default_model" in data
        assert len(data["supported_models"]) >= 5
        assert any("gpt-4o" in m for m in data["supported_models"])

    def test_cache_telemetry_stats(self):
        res = client.get("/api/cache/stats")
        assert res.status_code == 200
        stats = res.json()
        assert "backend" in stats
        assert "hits" in stats
        assert "misses" in stats


class TestProjectsAndTenantIsolation:
    """Tests multi-tenant project isolation, settings CRUD, and zero-state."""

    def test_clean_zero_state_onboarding_for_new_user(self):
        _, headers = _create_user_and_headers("fresh")
        res = client.get("/api/projects", headers=headers)
        assert res.status_code == 200
        assert res.json() == []

    def test_project_crud_and_tenant_boundary(self):
        # User 1 creates project
        _, h1 = _create_user_and_headers("user1")
        p_res = client.post("/api/projects", json={
            "brand_name": "PulseAudio",
            "domain": ["pulse.io", "pulseaudio.com"],
            "aliases": ["Pulse", "PA"],
            "competitors": ["Sony", "Bose"]
        }, headers=h1)
        assert p_res.status_code == 200
        proj1 = p_res.json()
        assert proj1["brand_name"] == "PulseAudio"
        p1_id = proj1["id"]

        # User 2 lists projects -> must be empty
        _, h2 = _create_user_and_headers("user2")
        p2_list = client.get("/api/projects", headers=h2).json()
        assert len(p2_list) == 0

        # User 2 attempts to view User 1's project -> 404
        assert client.get(f"/api/projects/{p1_id}", headers=h2).status_code == 404

    def test_project_settings_lifecycle(self):
        _, headers = _create_user_and_headers("settings_usr")
        p_res = client.post("/api/projects", json={
            "brand_name": "SaaSFlow",
            "domain": ["saasflow.com"]
        }, headers=headers)
        proj_id = p_res.json()["id"]

        # Default settings
        get_s = client.get(f"/api/projects/{proj_id}/settings", headers=headers)
        assert get_s.status_code == 200

        # Update settings
        put_s = client.put(f"/api/projects/{proj_id}/settings", json={
            "brand_context": {
                "industry": "B2B SaaS",
                "market": "Global",
                "audience": "CTOs, VPs of Eng",
                "topics": ["developer tools", "cloud observability"]
            },
            "models": ["OR: openai/gpt-4o-mini", "OR: anthropic/claude-3.5-sonnet"],
            "schedule": {"frequency": "daily", "autoRun": True, "time": "08:00"}
        }, headers=headers)
        assert put_s.status_code == 200
        data = put_s.json()
        assert data["brand_context"]["industry"] == "B2B SaaS"
        assert len(data["models"]) == 2
        assert data["schedule"]["frequency"] == "daily"


class TestPromptManagement:
    """Tests single prompt CRUD and bulk prompt ingestion."""

    def test_prompt_crud_lifecycle(self):
        _, headers = _create_user_and_headers("prompts_usr")
        p_res = client.post("/api/projects", json={
            "brand_name": "CloudDB",
            "domain": ["clouddb.io"]
        }, headers=headers)
        proj_id = p_res.json()["id"]

        # 1. Create single prompt
        pr_res = client.post(f"/api/projects/{proj_id}/prompts", json={
            "text": "What are the best managed Postgres databases in 2026?"
        }, headers=headers)
        assert pr_res.status_code == 200
        prompt = pr_res.json()
        prompt_id = prompt["id"]
        assert prompt["active"] is True

        # 2. Toggle prompt active status
        patch_res = client.patch(f"/api/prompts/{prompt_id}", json={"active": False}, headers=headers)
        assert patch_res.status_code == 200
        assert patch_res.json()["active"] is False

        # 3. Update prompt text
        content_res = client.patch(f"/api/prompts/{prompt_id}/content", json={
            "text": "Updated: What is the fastest cloud database?"
        }, headers=headers)
        assert content_res.status_code == 200
        assert "fastest" in content_res.json()["text"]

        # 4. Delete prompt
        del_res = client.delete(f"/api/prompts/{prompt_id}", headers=headers)
        assert del_res.status_code == 200

    def test_bulk_prompt_creation(self):
        _, headers = _create_user_and_headers("bulk_usr")
        p_res = client.post("/api/projects", json={
            "brand_name": "BulkBrand", "domain": ["bulk.io"]
        }, headers=headers)
        proj_id = p_res.json()["id"]

        bulk_texts = [
            "Best alternatives to competitor X?",
            "How reliable is BulkBrand for production workloads?",
            "Pricing comparison between BulkBrand and competitor Y"
        ]
        res = client.post(f"/api/projects/{proj_id}/prompts/bulk", json={"texts": bulk_texts}, headers=headers)
        assert res.status_code == 200
        prompts = res.json()
        assert len(prompts) == 3


class TestQuotaGuardAndExecutionSecurity:
    """Tests lifetime free tier quota (5 runs max) and BYOK/admin bypass."""

    def test_lifetime_free_tier_enforcement(self):
        uname, headers = _create_user_and_headers("quota_enforce")
        p_res = client.post("/api/projects", json={
            "brand_name": "QuotaCorp", "domain": ["quotacorp.io"]
        }, headers=headers)
        proj_id = p_res.json()["id"]

        pr_res = client.post(f"/api/projects/{proj_id}/prompts", json={
            "text": "Quota test prompt?"
        }, headers=headers)
        prompt_id = pr_res.json()["id"]

        # Simulate 5 runs executed by user
        db = SessionLocal()
        user = db.query(models.User).filter(models.User.username == uname).first()
        user.free_runs_used = 5
        for _ in range(5):
            db.add(models.PromptExecution(prompt_id=prompt_id, round=1, status="done", raw_answer="cached answer"))
        db.commit()
        db.close()

        # 6th execution without BYOK -> 402 Payment Required
        res = client.post(f"/api/prompts/{prompt_id}/run-once", headers=headers)
        assert res.status_code == 402
        assert res.json()["detail"]["code"] == "FREE_TIER_EXHAUSTED"

        # Execution with custom BYOK key header -> quota bypassed (does not return 402)
        byok_headers = {**headers, "X-OpenRouter-Key": "sk-or-v1-custom-byok-key"}
        byok_res = client.post(f"/api/prompts/{prompt_id}/run-once", headers=byok_headers)
        assert byok_res.status_code != 402

    def test_cross_tenant_prompt_execution_forbidden(self):
        _, h1 = _create_user_and_headers("owner_usr")
        _, h2 = _create_user_and_headers("attacker_usr")

        p_res = client.post("/api/projects", json={"brand_name": "SecureCo", "domain": ["sec.io"]}, headers=h1)
        proj_id = p_res.json()["id"]
        pr_res = client.post(f"/api/projects/{proj_id}/prompts", json={"text": "Confidential prompt"}, headers=h1)
        prompt_id = pr_res.json()["id"]

        # Attacker tries to execute owner's prompt -> 404 Not Found
        res = client.post(f"/api/prompts/{prompt_id}/run-once", headers=h2)
        assert res.status_code == 404
