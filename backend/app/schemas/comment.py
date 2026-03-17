from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.user import UserBrief


class SkillCommentCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    parent_id: Optional[UUID] = None


class SkillCommentResponse(BaseModel):
    id: UUID
    skill_id: UUID
    parent_id: Optional[UUID] = None
    content: str
    author: UserBrief
    children: List["SkillCommentResponse"] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


SkillCommentResponse.model_rebuild()
