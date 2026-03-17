from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from app.schemas.user import UserBrief


class SkillListQuery(BaseModel):
    search: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    rating: Optional[str] = None
    origin_type: Optional[str] = None
    sort_by: Optional[str] = "updated_at"
    page: int = 1
    page_size: int = 20


class SkillStats(BaseModel):
    copy_count: int = 0
    like_count: int = 0
    download_count: int = 0
    ripple_count: int = 0
    ripple_reach: int = 0
    copy_size_tier: str = "default"
    like_size_tier: str = "default"
    download_size_tier: str = "default"
    ripple_size_tier: str = "default"


class SkillListItem(BaseModel):
    id: UUID
    name: str
    display_name: str
    description: str
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    rating: str
    origin_type: str
    version: str
    author: UserBrief
    stats: SkillStats
    install_command: str
    download_url: str
    recommendation: Optional[str] = None
    ripple_available: bool = False
    user_copied: bool = False
    user_liked: bool = False
    user_downloaded: bool = False
    user_rippled: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SkillListResponse(BaseModel):
    items: List[SkillListItem]
    total: int
    page: int
    page_size: int


class SkillVersionResponse(BaseModel):
    id: UUID
    version: str
    changelog: Optional[str] = None
    rating: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SkillDetail(BaseModel):
    id: UUID
    name: str
    display_name: str
    description: str
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    rating: str
    origin_type: str
    version: str
    recommendation: Optional[str] = None
    author: UserBrief
    stats: SkillStats
    install_command: str
    download_url: str
    ripple_available: bool = False
    user_copied: bool = False
    user_liked: bool = False
    user_downloaded: bool = False
    user_rippled: bool = False
    content: Optional[str] = None
    versions: List[SkillVersionResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FileTreeNode(BaseModel):
    name: str
    path: str
    type: str  # "file" or "directory"
    children: Optional[List["FileTreeNode"]] = None
    size: Optional[int] = None


class FileContent(BaseModel):
    path: str
    name: str
    content: str
    language: Optional[str] = None
    is_binary: bool = False


class SkillUploadResponse(BaseModel):
    id: UUID
    name: str
    rating: str
    version: str
    suggestions: Optional[List[str]] = None


class RatingResult(BaseModel):
    rating: str
    suggestions: List[str] = []
