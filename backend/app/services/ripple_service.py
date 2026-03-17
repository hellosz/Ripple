import random
from datetime import datetime, timezone
from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, true
from app.models.ripple import Ripple, RipplePush, PushStatusEnum
from app.models.interaction import UserSkillLike, UserSkillCopy
from app.models.user import User, UserStatusEnum
from app.models.skill import Skill
from app.services.notification_service import is_user_online, push_to_user


async def create_ripple(
    skill_id: UUID,
    sender_id: UUID,
    db: AsyncSession,
    comment: Optional[str] = None,
) -> Optional[Ripple]:
    """Create a ripple and push to random users."""
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
    if not copy_result.scalar_one_or_none() or not like_result.scalar_one_or_none():
        return None

    # Check not already rippled
    existing = await db.execute(
        select(Ripple).where(
            Ripple.sender_id == sender_id,
            Ripple.skill_id == skill_id,
        )
    )
    if existing.scalar_one_or_none():
        return None

    # Create ripple
    ripple = Ripple(skill_id=skill_id, sender_id=sender_id)
    db.add(ripple)
    await db.flush()

    # Select random target users (3-7)
    num_targets = random.randint(3, 7)
    liked_user_ids_result = await db.execute(
        select(UserSkillLike.user_id).where(UserSkillLike.skill_id == skill_id)
    )
    liked_user_ids = {row[0] for row in liked_user_ids_result.fetchall()}

    result = await db.execute(
        select(User.id).where(
            User.id != sender_id,
            User.status == UserStatusEnum.active,
            User.id.not_in(liked_user_ids) if liked_user_ids else true(),
        )
    )
    all_user_ids = [row[0] for row in result.fetchall()]
    target_ids = random.sample(all_user_ids, min(num_targets, len(all_user_ids)))

    # Get skill and sender info for notification
    skill_result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = skill_result.scalar_one()
    sender_result = await db.execute(select(User).where(User.id == sender_id))
    sender = sender_result.scalar_one()

    # Create push records
    for target_id in target_ids:
        push = RipplePush(ripple_id=ripple.id, target_user_id=target_id)

        # If target is online, deliver immediately
        if is_user_online(target_id):
            push.status = PushStatusEnum.delivered
            push.delivered_at = datetime.now(timezone.utc)
            await push_to_user(target_id, {
                "type": "ripple",
                "ripple_id": str(ripple.id),
                "skill_name": skill.display_name,
                "skill_slug": skill.name,
                "sender": {
                    "id": str(sender.id),
                    "nickname": sender.nickname,
                    "avatar_url": sender.avatar_url,
                    "email": sender.email,
                },
                "comment": comment,
            })

        db.add(push)

    await db.flush()
    await db.refresh(ripple)
    return ripple


async def get_pending_pushes(user_id: UUID, db: AsyncSession) -> list:
    """Get all pending pushes for a user (for when they come online)."""
    result = await db.execute(
        select(RipplePush)
        .join(Ripple)
        .where(
            RipplePush.target_user_id == user_id,
            RipplePush.status == PushStatusEnum.pending,
        )
    )
    pushes = result.scalars().all()

    notifications = []
    for push in pushes:
        push.status = PushStatusEnum.delivered
        push.delivered_at = datetime.now(timezone.utc)

        # Load related data
        ripple_result = await db.execute(
            select(Ripple).where(Ripple.id == push.ripple_id)
        )
        ripple = ripple_result.scalar_one()

        skill_result = await db.execute(select(Skill).where(Skill.id == ripple.skill_id))
        skill = skill_result.scalar_one()

        sender_result = await db.execute(select(User).where(User.id == ripple.sender_id))
        sender = sender_result.scalar_one()

        notifications.append({
            "type": "ripple",
            "ripple_id": str(ripple.id),
            "skill_name": skill.display_name,
            "skill_slug": skill.name,
            "sender": {
                "id": str(sender.id),
                "nickname": sender.nickname,
                "avatar_url": sender.avatar_url,
                "email": sender.email,
            },
        })

    return notifications


async def mark_push_viewed(push_id: UUID, user_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(RipplePush).where(
            RipplePush.id == push_id,
            RipplePush.target_user_id == user_id,
        )
    )
    push = result.scalar_one_or_none()
    if push:
        push.status = PushStatusEnum.viewed
        push.viewed_at = datetime.now(timezone.utc)


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
