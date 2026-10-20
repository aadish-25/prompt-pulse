import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas
from app.auth import (
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    DEMO_USERNAME,
    FREE_TIER_PROMPT_LIMIT,
    create_access_token,
    get_current_user_optional,
    get_password_hash,
    verify_password,
    UserContext,
)
from app.logger import logger

router = APIRouter(prefix="/auth", tags=["auth"])


def user_payload(user: models.User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_admin": False,
        "is_demo": False,
        "avatar_url": user.avatar_url,
    }


@router.post("/login")
def login(creds: schemas.LoginRequest, db: Session = Depends(get_db)):
    if creds.username == ADMIN_USERNAME and creds.password == ADMIN_PASSWORD:
        token = create_access_token({"sub": ADMIN_USERNAME, "role": "admin"})
        return {"access_token": token, "token_type": "bearer", "user": {"username": ADMIN_USERNAME, "role": "admin", "is_admin": True, "is_demo": False}}
    if creds.username == "demo" and creds.password == "demo":
        token = create_access_token({"sub": "demo", "role": "demo"})
        return {"access_token": token, "token_type": "bearer", "user": {"username": "demo", "role": "demo", "is_admin": False, "is_demo": True}}

    user = db.query(models.User).filter(models.User.username == creds.username).first()
    if not user or not verify_password(creds.password, user.password_hash):
        logger.warning("Failed login attempt for username: %s", creds.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    token = create_access_token({"sub": user.username, "role": user.role, "user_id": user.id})
    return {"access_token": token, "token_type": "bearer", "user": user_payload(user)}


@router.post("/register")
def register(body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(422, "Enter a valid email address")
    if body.username.strip().lower() in {ADMIN_USERNAME.lower(), DEMO_USERNAME.lower()}:
        raise HTTPException(409, "That username is reserved")
    if db.query(models.User).filter(models.User.username.ilike(body.username)).first():
        raise HTTPException(409, "That username is already in use")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(409, "An account already exists for that email")
    user = models.User(username=body.username.strip(), email=email, password_hash=get_password_hash(body.password), role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.username, "role": user.role, "user_id": user.id})
    logger.info("Registered account: %s", user.username)
    return {"access_token": token, "token_type": "bearer", "user": user_payload(user)}


@router.post("/demo-login")
def demo_login():
    token = create_access_token({"sub": DEMO_USERNAME, "role": "demo"})
    return {"access_token": token, "token_type": "bearer", "user": {"username": DEMO_USERNAME, "role": "demo", "is_admin": False, "is_demo": True}}


