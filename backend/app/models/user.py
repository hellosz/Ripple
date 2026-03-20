import uuid
from datetime import datetime
from sqlalchemy import String, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
import enum


class GenderEnum(str, enum.Enum):
    male = "male"
    female = "female"
    secret = "secret"


class RoleEnum(str, enum.Enum):
    user = "user"
    admin = "admin"


class UserStatusEnum(str, enum.Enum):
    active = "active"
    disabled = "disabled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(String(200))
    gender: Mapped[GenderEnum | None] = mapped_column(Enum(GenderEnum))
    zodiac: Mapped[str | None] = mapped_column(String(20))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    tags: Mapped[dict | None] = mapped_column(JSONB, default=list)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum), default=RoleEnum.user)
    status: Mapped[UserStatusEnum] = mapped_column(Enum(UserStatusEnum), default=UserStatusEnum.active)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    skills = relationship("Skill", back_populates="author")
    likes = relationship("UserSkillLike", back_populates="user")
    copies = relationship("UserSkillCopy", back_populates="user")
    downloads = relationship("UserSkillDownload", back_populates="user")
    ripples_sent = relationship("Ripple", back_populates="sender")
    ripple_pushes_received = relationship("RipplePush", back_populates="target_user")
    guest_sessions = relationship("GuestSession", back_populates="claimed_user")
    comments = relationship("SkillComment", back_populates="author")
