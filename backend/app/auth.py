import os
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from pydantic import BaseModel
from fastapi import Depends, HTTPException, Security, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db import get_db
from app import models
from app.logger import logger

# Configuration
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or secrets.token_urlsafe(48)
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "10080"))  # 7 days

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
DEMO_USERNAME = "demo"

FREE_TIER_PROMPT_LIMIT = int(os.environ.get("FREE_TIER_PROMPT_LIMIT", "5"))

security_bearer = HTTPBearer(auto_error=False)


class TokenData(BaseModel):
    username: str
    role: str  # "admin" | "demo" | "user"
    exp: Optional[int] = None


class UserContext(BaseModel):
    username: str
    role: str
    is_admin: bool
    is_demo: bool
    user_id: int | None = None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        scheme, rounds, salt, digest = hashed_password.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        calculated = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt.encode(), int(rounds)).hex()
        return hmac.compare_digest(calculated, digest)
    except (ValueError, TypeError):
        return False


def get_password_hash(password: str) -> str:
    rounds = 310_000
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), rounds).hex()
    return f"pbkdf2_sha256${rounds}${salt}${digest}"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role", "demo")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject identity",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return TokenData(username=username, role=role, exp=payload.get("exp"))
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def payload_user_id(token: str) -> int | None:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        value = payload.get("user_id")
        return int(value) if value is not None else None
    except (jwt.PyJWTError, TypeError, ValueError):
        return None


def get_current_user_optional(
    auth_header: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
) -> UserContext:
    """Returns authenticated user if bearer token is present, else demo guest context."""
    if not auth_header or not auth_header.credentials:
        # Default to demo context for frictionless onboarding
        return UserContext(
            username=DEMO_USERNAME,
            role="demo",
            is_admin=False,
            is_demo=True,
        )

    token_data = decode_token(auth_header.credentials)
    is_admin = (token_data.username == ADMIN_USERNAME and token_data.role == "admin")
    return UserContext(
        username=token_data.username,
        role=token_data.role,
        is_admin=is_admin,
        is_demo=(token_data.role == "demo"),
        user_id=payload_user_id(auth_header.credentials),
    )


def require_admin_user(
    current_user: UserContext = Depends(get_current_user_optional),
) -> UserContext:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this operation",
        )
    return current_user


def get_byok_keys_from_request(request: Request) -> dict[str, str]:
    """Extract user-provided API keys from HTTP headers."""
    keys = {}
    if openrouter := request.headers.get("X-OpenRouter-Key"):
        keys["openrouter"] = openrouter.strip()
    if groq := request.headers.get("X-Groq-Key"):
        keys["groq"] = groq.strip()
    if deepseek := request.headers.get("X-DeepSeek-Key"):
        keys["deepseek"] = deepseek.strip()
    if tavily := request.headers.get("X-Tavily-Key"):
        keys["tavily"] = tavily.strip()
    return keys


def enforce_free_tier_prompt_quota(
    db: Session,
    project_id: int,
    user: UserContext,
    byok_provided: bool = False,
    prompt_count_requested: int = 1,
):
    """
    Guards server resources:
    1. Admin user -> UNLIMITED
    2. User brought their own API key (BYOK) -> UNLIMITED
    3. Demo/Free user without BYOK -> max FREE_TIER_PROMPT_LIMIT (5 prompts lifetime total)
    """
    if user.is_admin or byok_provided:
        return

    # Count executions across project using server credentials
    if user.user_id:
        total_server_runs = (
            db.query(models.PromptExecution)
            .join(models.Prompt)
            .join(models.Project)
            .filter(models.Project.owner_id == user.user_id)
            .count()
        )
    else:
        total_server_runs = (
            db.query(models.PromptExecution)
            .join(models.Prompt)
            .filter(models.Prompt.project_id == project_id)
            .count()
        )

    if (total_server_runs + prompt_count_requested) > FREE_TIER_PROMPT_LIMIT:
        logger.warning(
            f"Free tier limit exceeded for project {project_id}: currently {total_server_runs} runs. "
            f"Requested {prompt_count_requested}. Limit: {FREE_TIER_PROMPT_LIMIT}"
        )
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "FREE_TIER_EXHAUSTED",
                "message": (
                    f"Free trial limit reached ({FREE_TIER_PROMPT_LIMIT} prompts total). "
                    "To continue tracking unlimited prompts, please provide your own API key in Settings (Bring Your Own Key)."
                ),
                "current_usage": total_server_runs,
                "limit": FREE_TIER_PROMPT_LIMIT,
                "requires_byok": True,
            },
        )
