from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.user import UserUpdate, UserResponse, GenerateProfileRequest, GenerateProfileResponse, ProfileCandidate
from app.schemas.skill import SkillListItem
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.interaction import UserSkillLike, UserSkillDownload
from app.models.skill import Skill
from app.models.ripple import Ripple, RipplePush
from app.services.llm_service import generate_profile_candidates
from app.services.skill_service import get_skill_stats, get_user_interactions

router = APIRouter(prefix="/api/users", tags=["users"])


@router.put("/me", response_model=UserResponse)
async def update_profile(
    update: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if update.gender is not None:
        user.gender = update.gender
    if update.zodiac is not None:
        user.zodiac = update.zodiac
    if update.tags is not None:
        user.tags = update.tags
    if update.nickname is not None:
        user.nickname = update.nickname
    if update.description is not None:
        user.description = update.description
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/me/generate-profile", response_model=GenerateProfileResponse)
async def generate_profile(
    req: GenerateProfileRequest,
    user: User = Depends(get_current_user),
):
    candidates = await generate_profile_candidates(
        gender=req.gender or (user.gender.value if user.gender else None),
        zodiac=req.zodiac or user.zodiac,
        tags=req.tags or (user.tags if user.tags else None),
    )
    return GenerateProfileResponse(
        candidates=[ProfileCandidate(**c) for c in candidates]
    )


@router.get("/me/likes")
async def get_my_likes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSkillLike)
        .where(UserSkillLike.user_id == user.id)
        .order_by(UserSkillLike.created_at.desc())
    )
    likes = result.scalars().all()

    items = []
    for like in likes:
        skill_result = await db.execute(select(Skill).where(Skill.id == like.skill_id))
        skill = skill_result.scalar_one_or_none()
        if skill:
            stats = await get_skill_stats(skill.id, db)
            items.append({
                "id": skill.id,
                "name": skill.name,
                "display_name": skill.display_name,
                "description": skill.description,
                "rating": skill.rating.value,
                "tags": skill.tags,
                "stats": stats,
                "liked_at": like.created_at,
            })
    return items


@router.get("/me/downloads")
async def get_my_downloads(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSkillDownload)
        .where(UserSkillDownload.user_id == user.id)
        .order_by(UserSkillDownload.created_at.desc())
    )
    downloads = result.scalars().all()

    items = []
    for dl in downloads:
        skill_result = await db.execute(select(Skill).where(Skill.id == dl.skill_id))
        skill = skill_result.scalar_one_or_none()
        if skill:
            stats = await get_skill_stats(skill.id, db)
            items.append({
                "id": skill.id,
                "name": skill.name,
                "display_name": skill.display_name,
                "description": skill.description,
                "rating": skill.rating.value,
                "tags": skill.tags,
                "stats": stats,
                "version": dl.version,
                "downloaded_at": dl.created_at,
            })
    return items


@router.get("/me/ripples")
async def get_my_ripples(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Ripple)
        .where(Ripple.sender_id == user.id)
        .order_by(Ripple.created_at.desc())
    )
    ripples = result.scalars().all()

    items = []
    for ripple in ripples:
        skill_result = await db.execute(select(Skill).where(Skill.id == ripple.skill_id))
        skill = skill_result.scalar_one_or_none()
        if not skill:
            continue

        pushes_result = await db.execute(
            select(RipplePush).where(RipplePush.ripple_id == ripple.id)
        )
        pushes = pushes_result.scalars().all()

        push_details = []
        for push in pushes:
            target_result = await db.execute(select(User).where(User.id == push.target_user_id))
            target = target_result.scalar_one_or_none()
            if target:
                push_details.append({
                    "id": push.id,
                    "target_user": {
                        "id": target.id,
                        "nickname": target.nickname,
                        "avatar_url": target.avatar_url,
                        "email": target.email,
                    },
                    "status": push.status.value,
                    "delivered_at": push.delivered_at,
                    "viewed_at": push.viewed_at,
                })

        items.append({
            "id": ripple.id,
            "skill_id": skill.id,
            "skill_name": skill.name,
            "skill_display_name": skill.display_name,
            "sender": {
                "id": user.id,
                "nickname": user.nickname,
                "avatar_url": user.avatar_url,
                "email": user.email,
            },
            "pushes": push_details,
            "created_at": ripple.created_at,
        })
    return items
