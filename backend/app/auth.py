import os
import hashlib
import hmac
import secrets

def get_password_hash(password: str) -> str:
    rounds = 310_000
    # 16-byte cryptographically secure random salt per hash (enforces high entropy)
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), rounds).hex()
    return f"pbkdf2_sha256${rounds}${salt}${digest}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        scheme, rounds, salt, digest = hashed_password.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        calculated = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt.encode(), int(rounds)).hex()
        return hmac.compare_digest(calculated, digest)
    except (ValueError, TypeError):
        return False

from typing import Optional
from pydantic import BaseModel

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or secrets.token_urlsafe(48)
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "10080"))

class TokenData(BaseModel):
    username: str
    role: str
    exp: Optional[int] = None

class UserContext(BaseModel):
    username: str
    role: str
    is_admin: bool
    is_demo: bool
    user_id: int | None = None
