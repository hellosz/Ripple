from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class RegisterRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        if not v.endswith("@patpat.com"):
            raise ValueError("Only @patpat.com emails are allowed")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserUpdate(BaseModel):
    gender: Optional[str] = None
    zodiac: Optional[str] = None
    tags: Optional[List[str]] = None
    nickname: Optional[str] = None
    description: Optional[str] = None


class GenerateProfileRequest(BaseModel):
    gender: Optional[str] = None
    zodiac: Optional[str] = None
    tags: Optional[List[str]] = None


class ProfileCandidate(BaseModel):
    nickname: str
    description: str


class GenerateProfileResponse(BaseModel):
    candidates: List[ProfileCandidate]


class UserResponse(BaseModel):
    id: UUID
    email: str
    nickname: Optional[str] = None
    description: Optional[str] = None
    gender: Optional[str] = None
    zodiac: Optional[str] = None
    avatar_url: Optional[str] = None
    tags: Optional[List[str]] = None
    role: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserBrief(BaseModel):
    id: UUID
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    email: str

    model_config = {"from_attributes": True}
