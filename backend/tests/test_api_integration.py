"""
Comprehensive API Integration Test Suite for PromptPulse.
Tests account registration, login, tenant isolation, zero-state onboarding,
prompt CRUD, project settings, and 5-run free quota enforcement with BYOK bypass.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import SessionLocal
from app import models

client = TestClient(app)


def test_api_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_models_endpoint_returns_supported_models():
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert "default_model" in data
    assert len(data["supported_models"]) > 0


def test_cache_stats_endpoint():
    response = client.get("/api/cache/stats")
    assert response.status_code == 200
    stats = response.json()
    assert "backend" in stats
    assert "hits" in stats
    assert "misses" in stats


def test_user_registration_and_jwt_issuance():
    username = f"user_{uuid.uuid4().hex[:8]}"
    email = f"{username}@testpulse.io"
    password = "TestPassword@2026!"

    res = client.post("/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == username


def test_duplicate_user_registration_fails():
    username = f"dup_{uuid.uuid4().hex[:8]}"
    payload = {
        "username": username,
        "email": f"{username}@testpulse.io",
        "password": "Password@123"
    }
    first_res = client.post("/api/auth/register", json=payload)
    assert first_res.status_code == 200

    second_res = client.post("/api/auth/register", json=payload)
    assert second_res.status_code == 409


def test_user_login_success_and_failure():
    username = f"login_{uuid.uuid4().hex[:8]}"
    password = "CorrectPassword@999"

    client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@testpulse.io",
        "password": password
    })

    # Successful login
    login_res = client.post("/api/auth/login", json={
        "username": username,
        "password": password
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # Bad password
    bad_res = client.post("/api/auth/login", json={
        "username": username,
        "password": "WrongPassword!"
    })
    assert bad_res.status_code == 401


def test_zero_projects_onboarding_state():
    username = f"fresh_{uuid.uuid4().hex[:8]}"
    reg = client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@testpulse.io",
        "password": "Password@123"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Brand-new accounts must receive a clean zero-state list
    res = client.get("/api/projects", headers=headers)
    assert res.status_code == 200
    assert res.json() == []


def test_tenant_isolation_projects():
    # User 1
    u1_name = f"tenant1_{uuid.uuid4().hex[:8]}"
    r1 = client.post("/api/auth/register", json={
        "username": u1_name, "email": f"{u1_name}@t.io", "password": "Password@1"
    })
    h1 = {"Authorization": f"Bearer {r1.json()['access_token']}"}

    p1_res = client.post("/api/projects", json={
        "brand_name": "Tenant One Brand",
        "domain": ["tenantone.com"],
        "aliases": ["T1"],
        "competitors": ["T2"]
    }, headers=h1)
    assert p1_res.status_code == 200
    proj1_id = p1_res.json()["id"]

    # User 2
    u2_name = f"tenant2_{uuid.uuid4().hex[:8]}"
    r2 = client.post("/api/auth/register", json={
        "username": u2_name, "email": f"{u2_name}@t.io", "password": "Password@2"
    })
    h2 = {"Authorization": f"Bearer {r2.json()['access_token']}"}

    # User 2 must see 0 projects
    p2_list = client.get("/api/projects", headers=h2)
    assert p2_list.status_code == 200
    assert len(p2_list.json()) == 0

    # User 2 must not be able to read User 1's project
    cross_get = client.get(f"/api/projects/{proj1_id}", headers=h2)
    assert cross_get.status_code == 404


def test_project_settings_crud():
    username = f"settings_{uuid.uuid4().hex[:8]}"
    reg = client.post("/api/auth/register", json={
        "username": username, "email": f"{username}@t.io", "password": "Password@1"
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    p_res = client.post("/api/projects", json={
        "brand_name": "Settings Audio",
        "domain": ["settingsaudio.com"]
    }, headers=headers)
    proj_id = p_res.json()["id"]

    # Get settings
    get_s = client.get(f"/api/projects/{proj_id}/settings", headers=headers)
    assert get_s.status_code == 200

    # Update settings
    put_s = client.put(f"/api/projects/{proj_id}/settings", json={
        "brand_context": {"industry": "Audio", "market": "Global"},
        "models": ["OR: openai/gpt-4o-mini"],
        "schedule": {"frequency": "weekly", "autoRun": True}
    }, headers=headers)
    assert put_s.status_code == 200
    updated = put_s.json()
    assert updated["brand_context"]["industry"] == "Audio"
    assert updated["schedule"]["frequency"] == "weekly"


def test_free_tier_quota_enforcement_and_byok_bypass():
    username = f"quota_test_{uuid.uuid4().hex[:8]}"
    reg = client.post("/api/auth/register", json={
        "username": username, "email": f"{username}@t.io", "password": "Password@1"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    p_res = client.post("/api/projects", json={
        "brand_name": "Quota Test Brand",
        "domain": ["quotatest.com"]
    }, headers=headers)
    proj_id = p_res.json()["id"]

    pr_res = client.post(f"/api/projects/{proj_id}/prompts", json={
        "text": "Best test audio gear?"
    }, headers=headers)
    prompt_id = pr_res.json()["id"]

    # Simulate quota consumption (5 runs)
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.username == username).first()
    user.free_runs_used = 5
    for _ in range(5):
        db.add(models.PromptExecution(prompt_id=prompt_id, round=1, status="done", raw_answer="mock"))
    db.commit()
    db.close()

    # 6th execution attempt without BYOK keys -> 402 Payment Required
    exhausted_res = client.post(f"/api/prompts/{prompt_id}/run-once", headers=headers)
    assert exhausted_res.status_code == 402
    assert exhausted_res.json()["detail"]["code"] == "FREE_TIER_EXHAUSTED"

    # Execution with BYOK header bypasses quota (does not return 402)
    byok_headers = {**headers, "X-OpenRouter-Key": "sk-test-byok-key"}
    bypass_res = client.post(f"/api/prompts/{prompt_id}/run-once", headers=byok_headers)
    assert bypass_res.status_code != 402
