import uuid
from datetime import datetime
from sqlalchemy import String, Enum, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class PushStatusEnum(str, enum.Enum):
    pending = "pending"
    delivered = "delivered"
    viewed = "viewed"
    dismissed = "dismissed"


class Ripple(Base):
    __tablename__ = "ripples"
    __table_args__ = (UniqueConstraint("sender_id", "skill_id", name="uq_sender_skill_ripple"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    skill = relationship("Skill", back_populates="ripples")
    sender = relationship("User", back_populates="ripples_sent")
    pushes = relationship("RipplePush", back_populates="ripple")


class RipplePush(Base):
    __tablename__ = "ripple_pushes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ripple_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ripples.id"), nullable=False)
    target_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[PushStatusEnum] = mapped_column(Enum(PushStatusEnum), default=PushStatusEnum.pending)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    ripple = relationship("Ripple", back_populates="pushes")
    target_user = relationship("User", back_populates="ripple_pushes_received")
