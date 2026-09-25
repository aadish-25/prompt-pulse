import os
import hashlib
import hmac
import secrets

def get_password_hash(password: str) -> str:
    rounds = 310_000
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), rounds).hex()
    return f"pbkdf2_sha256${rounds}${salt}${digest}"
