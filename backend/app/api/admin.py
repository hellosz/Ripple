from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import Optional
from app.database import get_db
from app.middleware.auth import get_admin_user
from app.models.user import User, UserStatusEnum
from app.models.skill import Skill, SkillStatusEnum, RatingEnum, OriginTypeEnum
from app.models.interaction import UserSkillLike, UserSkillDownload
from app.models.ripple import Ripple, RipplePush
from app.services.skill_service import get_skill_stats
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
async def list_users(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)
    if search:
        from sqlalchemy import or_
        query = query.where(
            or_(
                User.email.ilike(f"%{search}%"),
                User.nickname.ilike(f"%{search}%"),
            )
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

    query = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "nickname": u.nickname,
                "description": u.description,
                "gender": u.gender.value if u.gender else None,
                "zodiac": u.zodiac,
                "tags": u.tags,
                "role": u.role.value,
                "status": u.status.value,
                "created_at": u.created_at,
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status_update: dict,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_status = status_update.get("status")
    if new_status not in [e.value for e in UserStatusEnum]:
        raise HTTPException(status_code=400, detail="Invalid status")

    user.status = UserStatusEnum(new_status)
    await db.flush()
    return {"message": f"User status updated to {new_status}"}


@router.get("/skills")
async def list_all_skills(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Skill)
    if search:
        from sqlalchemy import or_
        query = query.where(
            or_(
                Skill.name.ilike(f"%{search}%"),
                Skill.display_name.ilike(f"%{search}%"),
            )
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

    query = query.order_by(Skill.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    skills = result.scalars().all()

    items = []
    for s in skills:
        author_result = await db.execute(select(User).where(User.id == s.author_id))
        author = author_result.scalar_one()
        stats = await get_skill_stats(s.id, db)
        items.append({
            "id": s.id,
            "name": s.name,
            "display_name": s.display_name,
            "description": s.description,
            "category": s.category,
            "rating": s.rating.value,
            "origin_type": s.origin_type.value,
            "status": s.status.value,
            "version": s.version,
            "author_email": author.email,
            "stats": stats,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.patch("/skills/{skill_id}/status")
async def update_skill_admin_status(
    skill_id: str,
    status_update: dict,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    result = await db.execute(select(Skill).where(Skill.id == UUID(skill_id)))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    new_status = status_update.get("status")
    if new_status not in [e.value for e in SkillStatusEnum]:
        raise HTTPException(status_code=400, detail="Invalid status")

    skill.status = SkillStatusEnum(new_status)
    await db.flush()
    return {"message": f"Skill status updated to {new_status}"}


@router.get("/stats")
async def get_overview_stats(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    total_skills = (await db.execute(select(func.count()).select_from(Skill))).scalar() or 0
    total_likes = (await db.execute(select(func.count()).select_from(UserSkillLike))).scalar() or 0
    total_downloads = (await db.execute(select(func.count()).select_from(UserSkillDownload))).scalar() or 0
    total_ripples = (await db.execute(select(func.count()).select_from(Ripple))).scalar() or 0

    # Rating distribution
    rating_dist = {}
    for r in RatingEnum:
        count = (await db.execute(
            select(func.count()).select_from(Skill).where(Skill.rating == r)
        )).scalar() or 0
        rating_dist[r.value] = count

    # Origin type distribution
    origin_dist = {}
    for o in OriginTypeEnum:
        count = (await db.execute(
            select(func.count()).select_from(Skill).where(Skill.origin_type == o)
        )).scalar() or 0
        origin_dist[o.value] = count

    return {
        "users": {
            "total": total_users,
        },
        "skills": {
            "total": total_skills,
            "rating_distribution": rating_dist,
            "origin_distribution": origin_dist,
        },
        "interactions": {
            "total_likes": total_likes,
            "total_downloads": total_downloads,
            "total_ripples": total_ripples,
        },
    }


@router.get("/stats/top")
async def get_top_stats(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    # Top 10 by downloads
    top_downloads = await db.execute(
        select(Skill.name, Skill.display_name, func.count(UserSkillDownload.id).label("count"))
        .join(UserSkillDownload, UserSkillDownload.skill_id == Skill.id)
        .group_by(Skill.id)
        .order_by(func.count(UserSkillDownload.id).desc())
        .limit(10)
    )

    # Top 10 by likes
    top_likes = await db.execute(
        select(Skill.name, Skill.display_name, func.count(UserSkillLike.id).label("count"))
        .join(UserSkillLike, UserSkillLike.skill_id == Skill.id)
        .group_by(Skill.id)
        .order_by(func.count(UserSkillLike.id).desc())
        .limit(10)
    )

    # Top 10 by ripples
    top_ripples = await db.execute(
        select(Skill.name, Skill.display_name, func.count(Ripple.id).label("count"))
        .join(Ripple, Ripple.skill_id == Skill.id)
        .group_by(Skill.id)
        .order_by(func.count(Ripple.id).desc())
        .limit(10)
    )

    return {
        "top_downloads": [{"name": r[0], "display_name": r[1], "count": r[2]} for r in top_downloads],
        "top_likes": [{"name": r[0], "display_name": r[1], "count": r[2]} for r in top_likes],
        "top_ripples": [{"name": r[0], "display_name": r[1], "count": r[2]} for r in top_ripples],
    }
