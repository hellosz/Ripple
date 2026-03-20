import random
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interaction import UserSkillLike, UserSkillCopy
from app.models.ripple import GuestSession, PushStatusEnum, Ripple, RipplePush
from app.models.skill import Skill
from app.models.user import User, UserStatusEnum
from app.services.notification_service import is_user_online, push_to_user

ACTIVE_GUEST_WINDOW_MINUTES = 30
GUEST_SESSION_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def compute_ripple_availability(
    copied_at: Optional[datetime],
    liked_at: Optional[datetime],
    rippled_at: Optional[datetime],
) -> bool:
    return copied_at is not None and liked_at is not None and rippled_at is None


def filter_logged_in_recipient_ids(
    candidate_user_ids: list[UUID],
    liked_user_ids: set[UUID],
    sender_id: UUID,
) -> list[UUID]:
    return [
        user_id
        for user_id in candidate_user_ids
        if user_id != sender_id and user_id not in liked_user_ids
    ]


def is_guest_delivery_claimable(has_liked_skill: bool, already_targeted: bool) -> bool:
    return not has_liked_skill and not already_targeted


def normalize_guest_session_key(session_key: Optional[str]) -> Optional[str]:
    if not session_key:
        return None
    cleaned = session_key.strip()
    if not cleaned or not GUEST_SESSION_KEY_PATTERN.match(cleaned):
        return None
    return cleaned


async def touch_guest_session(
    session_key: Optional[str],
    db: AsyncSession,
    claimed_user_id: Optional[UUID] = None,
) -> Optional[GuestSession]:
    normalized_key = normalize_guest_session_key(session_key)
    if not normalized_key:
        return None

    result = await db.execute(
        select(GuestSession).where(GuestSession.session_key == normalized_key)
    )
    guest_session = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if guest_session is None:
        guest_session = GuestSession(
            session_key=normalized_key,
            claimed_user_id=claimed_user_id,
            last_seen_at=now,
        )
        db.add(guest_session)
    else:
        guest_session.last_seen_at = now
        if claimed_user_id and guest_session.claimed_user_id is None:
            guest_session.claimed_user_id = claimed_user_id

    await db.flush()
    return guest_session


async def claim_guest_session_deliveries(
    session_key: Optional[str],
    user_id: UUID,
    db: AsyncSession,
) -> None:
    guest_session = await touch_guest_session(session_key, db, claimed_user_id=user_id)
    if guest_session is None:
        return

    pending_guest_pushes_result = await db.execute(
        select(RipplePush).where(
            RipplePush.guest_session_id == guest_session.id,
            RipplePush.target_user_id.is_(None),
            RipplePush.status == PushStatusEnum.pending,
        )
    )
    pending_guest_pushes = pending_guest_pushes_result.scalars().all()
    if not pending_guest_pushes:
        return

    liked_skill_ids_result = await db.execute(
        select(UserSkillLike.skill_id).where(UserSkillLike.user_id == user_id)
    )
    liked_skill_ids = {row[0] for row in liked_skill_ids_result.fetchall()}

    existing_ripple_ids_result = await db.execute(
        select(RipplePush.ripple_id).where(RipplePush.target_user_id == user_id)
    )
    targeted_ripple_ids = {row[0] for row in existing_ripple_ids_result.fetchall()}

    ripple_ids = {push.ripple_id for push in pending_guest_pushes}
    ripple_result = await db.execute(select(Ripple).where(Ripple.id.in_(ripple_ids)))
    ripple_by_id = {ripple.id: ripple for ripple in ripple_result.scalars().all()}

    for push in pending_guest_pushes:
        ripple = ripple_by_id.get(push.ripple_id)
        if ripple is None:
            push.status = PushStatusEnum.dismissed
            continue

        claimable = is_guest_delivery_claimable(
            has_liked_skill=ripple.skill_id in liked_skill_ids,
            already_targeted=push.ripple_id in targeted_ripple_ids,
        )
        if not claimable:
            push.status = PushStatusEnum.dismissed
            continue

        push.target_user_id = user_id
        targeted_ripple_ids.add(push.ripple_id)

    await db.flush()


def build_ripple_notification(push: RipplePush, ripple: Ripple, skill: Skill, sender: User) -> dict:
    return {
        "type": "ripple",
        "delivery_id": str(push.id),
        "ripple_id": str(ripple.id),
        "skill_name": skill.display_name,
        "skill_display_name": skill.display_name,
        "skill_slug": skill.name,
        "sender": {
            "id": str(sender.id),
            "nickname": ripple.sender_nickname or sender.nickname,
            "avatar_url": sender.avatar_url,
            "email": sender.email,
        },
        "comment": ripple.comment,
    }


async def create_ripple(
    skill_id: UUID,
    sender_id: UUID,
    db: AsyncSession,
    comment: Optional[str] = None,
) -> Optional[Ripple]:
    copy_result = await db.execute(
        select(UserSkillCopy).where(
            UserSkillCopy.user_id == sender_id,
            UserSkillCopy.skill_id == skill_id,
        )
    )
    like_result = await db.execute(
        select(UserSkillLike).where(
            UserSkillLike.user_id == sender_id,
            UserSkillLike.skill_id == skill_id,
        )
    )
    copied = copy_result.scalar_one_or_none()
    liked = like_result.scalar_one_or_none()
    if not compute_ripple_availability(
        copied.created_at if copied else None,
        liked.created_at if liked else None,
        None,
    ):
        return None

    existing = await db.execute(
        select(Ripple).where(
            Ripple.sender_id == sender_id,
            Ripple.skill_id == skill_id,
        )
    )
    if existing.scalar_one_or_none():
        return None

    sender_result = await db.execute(select(User).where(User.id == sender_id))
    sender = sender_result.scalar_one()

    ripple = Ripple(
        skill_id=skill_id,
        sender_id=sender_id,
        sender_nickname=sender.nickname,
        comment=comment.strip() if comment else None,
    )
    db.add(ripple)
    await db.flush()

    liked_user_ids_result = await db.execute(
        select(UserSkillLike.user_id).where(UserSkillLike.skill_id == skill_id)
    )
    liked_user_ids = {row[0] for row in liked_user_ids_result.fetchall()}

    user_candidates_result = await db.execute(
        select(User.id).where(User.status == UserStatusEnum.active)
    )
    candidate_user_ids = [row[0] for row in user_candidates_result.fetchall()]
    logged_in_candidates = [
        ("user", recipient_id)
        for recipient_id in filter_logged_in_recipient_ids(candidate_user_ids, liked_user_ids, sender_id)
    ]

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ACTIVE_GUEST_WINDOW_MINUTES)
    guest_candidates_result = await db.execute(
        select(GuestSession.id).where(
            GuestSession.claimed_user_id.is_(None),
            GuestSession.last_seen_at >= cutoff,
        )
    )
    guest_candidates = [("guest", row[0]) for row in guest_candidates_result.fetchall()]

    recipients = logged_in_candidates + guest_candidates
    if recipients:
        target_count = min(random.randint(3, 7), len(recipients))
        recipients = random.sample(recipients, target_count)

    skill_result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = skill_result.scalar_one()

    for recipient_type, recipient_id in recipients:
        if recipient_type == "user":
            push = RipplePush(
                ripple_id=ripple.id,
                target_user_id=recipient_id,
            )
        else:
            push = RipplePush(
                ripple_id=ripple.id,
                guest_session_id=recipient_id,
            )

        db.add(push)
        await db.flush()

        if recipient_type == "user" and is_user_online(recipient_id):
            push.status = PushStatusEnum.shown
            push.shown_at = datetime.now(timezone.utc)
            await push_to_user(recipient_id, build_ripple_notification(push, ripple, skill, sender))

    await db.flush()
    await db.refresh(ripple)
    return ripple


async def get_pending_pushes(user_id: UUID, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(RipplePush).where(
            RipplePush.target_user_id == user_id,
            RipplePush.status == PushStatusEnum.pending,
        )
    )
    pushes = result.scalars().all()
    if not pushes:
        return []

    ripple_ids = {push.ripple_id for push in pushes}
    ripple_result = await db.execute(select(Ripple).where(Ripple.id.in_(ripple_ids)))
    ripple_by_id = {ripple.id: ripple for ripple in ripple_result.scalars().all()}

    skill_ids = {ripple.skill_id for ripple in ripple_by_id.values()}
    skill_result = await db.execute(select(Skill).where(Skill.id.in_(skill_ids)))
    skill_by_id = {skill.id: skill for skill in skill_result.scalars().all()}

    sender_ids = {ripple.sender_id for ripple in ripple_by_id.values()}
    sender_result = await db.execute(select(User).where(User.id.in_(sender_ids)))
    sender_by_id = {sender.id: sender for sender in sender_result.scalars().all()}

    notifications = []
    now = datetime.now(timezone.utc)
    for push in pushes:
        ripple = ripple_by_id.get(push.ripple_id)
        if ripple is None:
            push.status = PushStatusEnum.dismissed
            continue

        skill = skill_by_id.get(ripple.skill_id)
        sender = sender_by_id.get(ripple.sender_id)
        if skill is None or sender is None:
            push.status = PushStatusEnum.dismissed
            continue

        push.status = PushStatusEnum.shown
        push.shown_at = now
        notifications.append(build_ripple_notification(push, ripple, skill, sender))

    await db.flush()
    return notifications


async def mark_delivery_consumed(delivery_id: UUID, user_id: UUID, db: AsyncSession) -> Optional[RipplePush]:
    result = await db.execute(
        select(RipplePush).where(
            RipplePush.id == delivery_id,
            RipplePush.target_user_id == user_id,
        )
    )
    push = result.scalar_one_or_none()
    if push is None:
        return None

    push.status = PushStatusEnum.consumed
    push.consumed_at = datetime.now(timezone.utc)
    await db.flush()
    return push


async def mark_push_dismissed(push_id: UUID, user_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(RipplePush).where(
            RipplePush.id == push_id,
            RipplePush.target_user_id == user_id,
        )
    )
    push = result.scalar_one_or_none()
    if push:
        push.status = PushStatusEnum.dismissed
        await db.flush()
