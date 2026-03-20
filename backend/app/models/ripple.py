import uuid
from datetime import datetime
from sqlalchemy import String, Enum, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class PushStatusEnum(str, enum.Enum):
    pending = "pending"
    shown = "shown"
    consumed = "consumed"
    dismissed = "dismissed"


class Ripple(Base):
    __tablename__ = "ripples"
    __table_args__ = (UniqueConstraint("sender_id", "skill_id", name="uq_sender_skill_ripple"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sender_nickname: Mapped[str | None] = mapped_column(String(50))
    comment: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    skill = relationship("Skill", back_populates="ripples")
    sender = relationship("User", back_populates="ripples_sent")
    pushes = relationship("RipplePush", back_populates="ripple")


class GuestSession(Base):
    __tablename__ = "guest_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    claimed_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    claimed_user = relationship("User", back_populates="guest_sessions")
    pushes = relationship("RipplePush", back_populates="guest_session")


class RipplePush(Base):
    __tablename__ = "ripple_pushes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ripple_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ripples.id"), nullable=False)
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    guest_session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("guest_sessions.id"))
    status: Mapped[PushStatusEnum] = mapped_column(Enum(PushStatusEnum), default=PushStatusEnum.pending)
    shown_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    ripple = relationship("Ripple", back_populates="pushes")
    target_user = relationship("User", back_populates="ripple_pushes_received")
    guest_session = relationship("GuestSession", back_populates="pushes")
