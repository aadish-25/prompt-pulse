"""
Comprehensive API Integration Test Suite for PromptPulse Authentication & Account Lifecycle.
Covers registration, validation, credential verification, admin & demo roles,
profile read/update, and secure password changes.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestUserRegistration:
    """Verifies account registration rules, validations, and JWT issuance."""

    def test_successful_registration(self):
        uname = f"reg_{uuid.uuid4().hex[:8]}"
        res = client.post("/api/auth/register", json={
            "username": uname,
            "email": f"{uname}@promptpulse.io",
            "password": "SecurePassword@2026!"
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == uname
        assert data["user"]["email"] == f"{uname}@promptpulse.io"
        assert data["user"]["role"] == "user"

    def test_invalid_email_format_rejected(self):
        uname = f"bad_mail_{uuid.uuid4().hex[:8]}"
        res = client.post("/api/auth/register", json={
            "username": uname,
            "email": "not-an-email-format",
            "password": "Password@123"
        })
        assert res.status_code == 422

    def test_reserved_usernames_rejected(self):
        for reserved in ["admin", "demo", "ADMIN", "Demo"]:
            res = client.post("/api/auth/register", json={
                "username": reserved,
                "email": f"{reserved}@example.com",
                "password": "Password@123"
            })
            assert res.status_code == 409
            assert "reserved" in res.json()["detail"].lower()

    def test_duplicate_username_rejected(self):
        uname = f"dup_{uuid.uuid4().hex[:8]}"
        payload = {"username": uname, "email": f"{uname}@t.io", "password": "Password@123"}
        res1 = client.post("/api/auth/register", json=payload)
        assert res1.status_code == 200

        # Duplicate attempt with identical username
        res2 = client.post("/api/auth/register", json={
            "username": uname,
            "email": f"different_{uname}@t.io",
            "password": "Password@123"
        })
        assert res2.status_code == 409

    def test_duplicate_email_rejected(self):
        shared_email = f"shared_{uuid.uuid4().hex[:8]}@t.io"
        res1 = client.post("/api/auth/register", json={
            "username": f"u1_{uuid.uuid4().hex[:6]}",
            "email": shared_email,
            "password": "Password@123"
        })
        assert res1.status_code == 200

        res2 = client.post("/api/auth/register", json={
            "username": f"u2_{uuid.uuid4().hex[:6]}",
            "email": shared_email,
            "password": "Password@123"
        })
        assert res2.status_code == 409


class TestUserLoginAndSessions:
    """Verifies unified login authentication for users, demo, and admin."""

    def test_valid_user_login(self):
        uname = f"login_user_{uuid.uuid4().hex[:8]}"
        password = "CorrectSecretPassword@1"
        client.post("/api/auth/register", json={
            "username": uname, "email": f"{uname}@t.io", "password": password
        })

        login_res = client.post("/api/auth/login", json={
            "username": uname, "password": password
        })
        assert login_res.status_code == 200
        data = login_res.json()
        assert "access_token" in data
        assert data["user"]["username"] == uname

    def test_incorrect_password_rejected(self):
        uname = f"wrong_pwd_{uuid.uuid4().hex[:8]}"
        client.post("/api/auth/register", json={
            "username": uname, "email": f"{uname}@t.io", "password": "OriginalPassword@1"
        })

        res = client.post("/api/auth/login", json={
            "username": uname, "password": "WrongPassword@999"
        })
        assert res.status_code == 401

    def test_nonexistent_user_rejected(self):
        res = client.post("/api/auth/login", json={
            "username": f"ghost_{uuid.uuid4().hex}", "password": "AnyPassword@1"
        })
        assert res.status_code == 401

    def test_demo_login_flow(self):
        res = client.post("/api/auth/demo-login")
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["user"]["role"] == "demo"
        assert data["user"]["is_demo"] is True


class TestProfileAndSecuritySettings:
    """Tests /me endpoint, profile updates, and password changes."""

    def test_get_profile_authenticated(self):
        uname = f"profile_{uuid.uuid4().hex[:8]}"
        reg = client.post("/api/auth/register", json={
            "username": uname, "email": f"{uname}@t.io", "password": "Password@1"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/auth/me", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == uname
        assert data["email"] == f"{uname}@t.io"
        assert "free_prompt_limit" in data

    def test_patch_profile_success(self):
        uname = f"pre_patch_{uuid.uuid4().hex[:8]}"
        reg = client.post("/api/auth/register", json={
            "username": uname, "email": f"{uname}@t.io", "password": "Password@1"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        updated_uname = f"post_patch_{uuid.uuid4().hex[:8]}"
        updated_email = f"{updated_uname}@newdomain.io"

        res = client.patch("/api/auth/me", json={
            "username": updated_uname,
            "email": updated_email
        }, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == updated_uname
        assert data["email"] == updated_email

    def test_patch_profile_demo_blocked(self):
        demo_res = client.post("/api/auth/demo-login")
        token = demo_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = client.patch("/api/auth/me", json={
            "username": "new_demo_name", "email": "demo@new.io"
        }, headers=headers)
        assert res.status_code == 403

    def test_change_password_success(self):
        uname = f"pwd_change_{uuid.uuid4().hex[:8]}"
        old_pwd = "OldPassword@2026!"
        new_pwd = "NewBrandPassword@2027!"

        reg = client.post("/api/auth/register", json={
            "username": uname, "email": f"{uname}@t.io", "password": old_pwd
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        change_res = client.post("/api/auth/change-password", json={
            "current_password": old_pwd,
            "new_password": new_pwd
        }, headers=headers)
        assert change_res.status_code == 200

        # Login with old password should fail
        assert client.post("/api/auth/login", json={"username": uname, "password": old_pwd}).status_code == 401
        # Login with new password should succeed
        assert client.post("/api/auth/login", json={"username": uname, "password": new_pwd}).status_code == 200

    def test_change_password_wrong_current_password_rejected(self):
        uname = f"wrong_old_{uuid.uuid4().hex[:8]}"
        reg = client.post("/api/auth/register", json={
            "username": uname, "email": f"{uname}@t.io", "password": "CorrectPassword@1"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/auth/change-password", json={
            "current_password": "IncorrectCurrentPassword!",
            "new_password": "BrandNewPassword@2"
        }, headers=headers)
        assert res.status_code == 400

    def test_change_password_short_password_rejected(self):
        uname = f"short_pwd_{uuid.uuid4().hex[:8]}"
        reg = client.post("/api/auth/register", json={
            "username": uname, "email": f"{uname}@t.io", "password": "ValidPassword@1"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/auth/change-password", json={
            "current_password": "ValidPassword@1",
            "new_password": "short"  # < 8 chars
        }, headers=headers)
        assert res.status_code == 400
