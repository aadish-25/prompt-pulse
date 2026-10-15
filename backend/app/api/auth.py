import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas
from app.auth import get_password_hash, create_access_token, ADMIN_USERNAME, DEMO_USERNAME
from app.logger import logger

router = APIRouter(prefix="/auth", tags=["auth"])

def user_payload(user):
    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role}

@router.post("/register")
def register(body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    user = models.User(username=body.username.strip(), email=body.email.strip().lower(), password_hash=get_password_hash(body.password), role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.username, "role": user.role, "user_id": user.id})
    return {"access_token": token, "token_type": "bearer", "user": user_payload(user)}
