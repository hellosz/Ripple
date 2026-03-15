from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.middleware.auth import get_current_user, get_optional_user
from app.models.user import User
from app.models.skill import Skill
from app.models.interaction import UserSkillLike, UserSkillDownload
from app.models.ripple import Ripple
from app.services.ripple_service import create_ripple
from app.services.skill_service import get_skill_stats
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

    # Check if downloaded
    dl = await db.execute(
        select(UserSkillDownload).where(
            UserSkillDownload.user_id == user.id,
            UserSkillDownload.skill_id == skill.id,
        )
    )
    if not dl.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You must download the skill before RP")

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
