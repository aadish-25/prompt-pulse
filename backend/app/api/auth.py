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


@router.get("/me")
def get_profile(db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    if user.user_id:
        record = db.get(models.User, user.user_id)
        if not record:
            raise HTTPException(401, "Account no longer exists")
        payload = user_payload(record)
    else:
        payload = {"username": user.username, "role": user.role, "is_admin": user.is_admin, "is_demo": user.is_demo, "email": None, "avatar_url": None}
    payload["free_prompt_limit"] = FREE_TIER_PROMPT_LIMIT
    return payload


@router.patch("/me")
def update_profile(body: schemas.ProfileUpdate, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    if not user.user_id:
        raise HTTPException(403, "Demo and administrator profiles cannot be edited here")
    record = db.get(models.User, user.user_id)
    if not record:
        raise HTTPException(404, "Account not found")
    email = body.email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(422, "Enter a valid email address")
    if body.username.strip().lower() in {ADMIN_USERNAME.lower(), DEMO_USERNAME.lower()}:
        raise HTTPException(409, "That username is reserved")
    username_conflict = db.query(models.User).filter(models.User.username.ilike(body.username), models.User.id != record.id).first()
    email_conflict = db.query(models.User).filter(models.User.email == email, models.User.id != record.id).first()
    if username_conflict:
        raise HTTPException(409, "That username is already in use")
    if email_conflict:
        raise HTTPException(409, "That email address is already in use")
    if "avatar_url" in body.model_fields_set:
        if body.avatar_url and not body.avatar_url.startswith(("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")):
            raise HTTPException(422, "Profile images must be JPEG, PNG or WebP data URLs")
        record.avatar_url = body.avatar_url
    record.username = body.username.strip()
    record.email = email
    db.commit()
    db.refresh(record)
    return user_payload(record)


@router.post("/change-password")
def change_password(body: schemas.PasswordChange, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    if not user.user_id:
        raise HTTPException(403, "Password changes are unavailable for demo and administrator profiles")
    record = db.get(models.User, user.user_id)
    if not record or not verify_password(body.current_password, record.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    record.password_hash = get_password_hash(body.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


@router.get("/quota/{project_id}")
def get_project_quota(project_id: int, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    from app.api.projects import get_project_or_404
    get_project_or_404(db, project_id, user)
    total_runs = db.query(models.PromptExecution).join(models.Prompt).filter(models.Prompt.project_id == project_id).count()
    return {"project_id": project_id, "used_prompts": total_runs, "limit": FREE_TIER_PROMPT_LIMIT, "remaining": max(0, FREE_TIER_PROMPT_LIMIT - total_runs) if not user.is_admin else 999999, "is_unlimited": user.is_admin}
