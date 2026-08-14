import uuid
from datetime import datetime
from sqlalchemy import String, Text, Enum, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
import enum


class OriginTypeEnum(str, enum.Enum):
    original = "original"
    derivative = "derivative"
    repost = "repost"


class RatingEnum(str, enum.Enum):
    S = "S"  # 夯
    A = "A"  # 稳
    B = "B"  # 行
    C = "C"  # 拉


class SkillStatusEnum(str, enum.Enum):
    active = "active"
    hidden = "hidden"
    offline = "offline"
    disabled = "disabled"


class PublishChannelEnum(str, enum.Enum):
    production = "production"  # 正式：所有用户可见
    gray = "gray"  # 灰度：仅管理员可见


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recommendation: Mapped[str | None] = mapped_column(Text)
    origin_type: Mapped[OriginTypeEnum] = mapped_column(Enum(OriginTypeEnum), default=OriginTypeEnum.original)
    rating: Mapped[RatingEnum] = mapped_column(Enum(RatingEnum), default=RatingEnum.C)
    version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    tags: Mapped[dict | None] = mapped_column(JSONB, default=list)
    category: Mapped[str | None] = mapped_column(String(50))
    install_command: Mapped[str | None] = mapped_column(String(500))
    package_file_name: Mapped[str | None] = mapped_column(String(255))
    package_storage_path: Mapped[str | None] = mapped_column(String(500))
    package_checksum: Mapped[str | None] = mapped_column(String(64))
    git_path: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[SkillStatusEnum] = mapped_column(Enum(SkillStatusEnum), default=SkillStatusEnum.active)
    publish_channel: Mapped[PublishChannelEnum] = mapped_column(Enum(PublishChannelEnum), default=PublishChannelEnum.production)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    author = relationship("User", back_populates="skills")
    versions = relationship("SkillVersion", back_populates="skill", order_by="SkillVersion.created_at.desc()")
    likes = relationship("UserSkillLike", back_populates="skill")
    copies = relationship("UserSkillCopy", back_populates="skill")
    downloads = relationship("UserSkillDownload", back_populates="skill")
    ripples = relationship("Ripple", back_populates="skill")
    comments = relationship("SkillComment", back_populates="skill", cascade="all, delete-orphan")


class SkillVersion(Base):
    __tablename__ = "skill_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    changelog: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(50))
    recommendation: Mapped[str | None] = mapped_column(Text)
    origin_type: Mapped[OriginTypeEnum | None] = mapped_column(Enum(OriginTypeEnum))
    rating: Mapped[RatingEnum | None] = mapped_column(Enum(RatingEnum))
    install_command: Mapped[str | None] = mapped_column(String(500))
    package_file_name: Mapped[str | None] = mapped_column(String(255))
    package_storage_path: Mapped[str | None] = mapped_column(String(500))
    package_checksum: Mapped[str | None] = mapped_column(String(64))
    git_commit_sha: Mapped[str | None] = mapped_column(String(40))
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    skill = relationship("Skill", back_populates="versions")
    author = relationship("User")
