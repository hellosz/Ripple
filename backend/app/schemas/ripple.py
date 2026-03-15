from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from app.schemas.user import UserBrief


class RippleCreateRequest(BaseModel):
    comment: Optional[str] = None


class RipplePushResponse(BaseModel):
    id: UUID
    target_user: UserBrief
    status: str
    delivered_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RippleResponse(BaseModel):
    id: UUID
    skill_id: UUID
    skill_name: str
    skill_display_name: str
    sender: UserBrief
    pushes: List[RipplePushResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class RippleNotification(BaseModel):
    type: str = "ripple"
    ripple_id: UUID
    skill_name: str
    skill_slug: str
    sender: UserBrief
    comment: Optional[str] = None


class UpdateNotification(BaseModel):
    type: str = "skill_update"
    skill_name: str
    skill_slug: str
    new_version: str
    changelog: Optional[str] = None
