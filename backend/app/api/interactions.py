from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.middleware.auth import get_current_user, get_optional_user
from app.models.user import User
from app.models.skill import Skill
from app.models.interaction import UserSkillLike, UserSkillDownload, UserSkillCopy
from app.services.ripple_service import create_ripple
from app.services.skill_service import (
    build_upload_metadata,
    get_current_version_record,
    get_skill_stats,
    get_user_interactions,
)
from app.schemas.ripple import RippleCreateRequest
from typing import Optional

router = APIRouter(prefix="/api/skills", tags=["interactions"])


@router.post("/{slug}/like")
async def like_skill(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    existing = await db.execute(
        select(UserSkillLike).where(
            UserSkillLike.user_id == user.id,
            UserSkillLike.skill_id == skill.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already liked")

    like = UserSkillLike(user_id=user.id, skill_id=skill.id)
    db.add(like)
    await db.flush()

    stats = await get_skill_stats(skill.id, db)
    return {"message": "Liked", "stats": stats}


@router.delete("/{slug}/like")
async def unlike_skill(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    existing = await db.execute(
        select(UserSkillLike).where(
            UserSkillLike.user_id == user.id,
            UserSkillLike.skill_id == skill.id,
        )
    )
    like = existing.scalar_one_or_none()
    if not like:
        raise HTTPException(status_code=400, detail="Not liked")

    await db.delete(like)
    await db.flush()

    stats = await get_skill_stats(skill.id, db)
    return {"message": "Unliked", "stats": stats}


@router.post("/{slug}/ripple")
async def ripple_skill(
    slug: str,
    req: RippleCreateRequest = RippleCreateRequest(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    interactions = await get_user_interactions(skill.id, user.id, db)
    if not interactions["ripple_available"]:
        raise HTTPException(status_code=400, detail="You must copy and like the skill before RP")

    ripple = await create_ripple(skill.id, user.id, db, req.comment)
    if not ripple:
        raise HTTPException(status_code=400, detail="Already rippled or cannot ripple")

    return {"message": "Ripple sent!", "ripple_id": str(ripple.id)}


@router.get("/{slug}/stats")
async def get_stats(
    slug: str,
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    stats = await get_skill_stats(skill.id, db)

    # Add user interaction state
    if user:
        from app.services.skill_service import get_user_interactions
        interactions = await get_user_interactions(skill.id, user.id, db)
        stats.update(interactions)

    return stats


@router.post("/{slug}/copy")
async def copy_skill_command(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    version_record = await get_current_version_record(skill, db)
    upload_metadata = build_upload_metadata(skill, version_record)
    existing = await db.execute(
        select(UserSkillCopy).where(
            UserSkillCopy.user_id == user.id,
            UserSkillCopy.skill_id == skill.id,
        )
    )
    copy = existing.scalar_one_or_none()
    if not copy:
        copy = UserSkillCopy(
            user_id=user.id,
            skill_id=skill.id,
            command=upload_metadata["install_command"],
        )
        db.add(copy)
        await db.flush()

    stats = await get_skill_stats(skill.id, db)
    interactions = await get_user_interactions(skill.id, user.id, db)
    return {
        "message": "Copied",
        "command": upload_metadata["install_command"],
        "stats": stats,
        **interactions,
    }
