import os
import tempfile
import shutil
from uuid import UUID
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.models.skill import Skill, SkillVersion, SkillStatusEnum, RatingEnum
from app.models.interaction import UserSkillLike, UserSkillDownload
from app.models.ripple import Ripple, RipplePush
from app.services.git_service import (
    copy_skill_to_repo,
    git_commit_skill,
    get_file_tree,
    get_file_content as git_get_file_content,
    get_skills_base_path,
)
from app.services.rating_service import rate_skill
from app.utils.validators import validate_skill_zip, extract_zip_to_dir, get_skill_content_without_frontmatter


def get_size_tier(count: int) -> str:
    if count == 0:
        return "default"
    elif count <= 10:
        return "small"
    elif count <= 50:
        return "medium"
    elif count <= 200:
        return "large"
    else:
        return "xlarge"


async def get_skill_stats(skill_id: UUID, db: AsyncSession) -> dict:
    like_count = (await db.execute(
        select(func.count()).select_from(UserSkillLike).where(UserSkillLike.skill_id == skill_id)
    )).scalar() or 0

    download_count = (await db.execute(
        select(func.count()).select_from(UserSkillDownload).where(UserSkillDownload.skill_id == skill_id)
    )).scalar() or 0

    ripple_count = (await db.execute(
        select(func.count()).select_from(Ripple).where(Ripple.skill_id == skill_id)
    )).scalar() or 0

    ripple_reach = (await db.execute(
        select(func.count()).select_from(RipplePush)
        .join(Ripple)
        .where(Ripple.skill_id == skill_id)
    )).scalar() or 0

    return {
        "like_count": like_count,
        "download_count": download_count,
        "ripple_count": ripple_count,
        "ripple_reach": ripple_reach,
        "like_size_tier": get_size_tier(like_count),
        "download_size_tier": get_size_tier(download_count),
        "ripple_size_tier": get_size_tier(ripple_count),
    }


async def get_user_interactions(skill_id: UUID, user_id: Optional[UUID], db: AsyncSession) -> dict:
    if not user_id:
        return {"user_liked": False, "user_downloaded": False, "user_rippled": False}

    liked = (await db.execute(
        select(UserSkillLike).where(
            UserSkillLike.user_id == user_id,
            UserSkillLike.skill_id == skill_id,
        )
    )).scalar_one_or_none()

    downloaded = (await db.execute(
        select(UserSkillDownload).where(
            UserSkillDownload.user_id == user_id,
            UserSkillDownload.skill_id == skill_id,
        )
    )).scalar_one_or_none()

    rippled = (await db.execute(
        select(Ripple).where(
            Ripple.sender_id == user_id,
            Ripple.skill_id == skill_id,
        )
    )).scalar_one_or_none()

    return {
        "user_liked": liked is not None,
        "user_downloaded": downloaded is not None,
        "user_rippled": rippled is not None,
    }


async def list_skills(
    db: AsyncSession,
    user_id: Optional[UUID] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    tags: Optional[List[str]] = None,
    rating: Optional[str] = None,
    origin_type: Optional[str] = None,
    sort_by: str = "updated_at",
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[dict], int]:
    query = select(Skill).where(Skill.status == SkillStatusEnum.active)

    if search:
        query = query.where(
            or_(
                Skill.name.ilike(f"%{search}%"),
                Skill.display_name.ilike(f"%{search}%"),
                Skill.description.ilike(f"%{search}%"),
            )
        )

    if category:
        query = query.where(Skill.category == category)

    if rating:
        query = query.where(Skill.rating == RatingEnum(rating))

    if origin_type:
        query = query.where(Skill.origin_type == origin_type)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Sort
    if sort_by == "updated_at":
        query = query.order_by(Skill.updated_at.desc())
    elif sort_by == "created_at":
        query = query.order_by(Skill.created_at.desc())
    else:
        query = query.order_by(Skill.updated_at.desc())

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    skills = result.scalars().all()

    items = []
    for skill in skills:
        # Load author
        from app.models.user import User
        author_result = await db.execute(select(User).where(User.id == skill.author_id))
        author = author_result.scalar_one()

        stats = await get_skill_stats(skill.id, db)
        interactions = await get_user_interactions(skill.id, user_id, db)

        items.append({
            "id": skill.id,
            "name": skill.name,
            "display_name": skill.display_name,
            "description": skill.description,
            "category": skill.category,
            "tags": skill.tags,
            "rating": skill.rating.value,
            "origin_type": skill.origin_type.value,
            "version": skill.version,
            "author": {
                "id": author.id,
                "nickname": author.nickname,
                "avatar_url": author.avatar_url,
                "email": author.email,
            },
            "stats": stats,
            **interactions,
            "created_at": skill.created_at,
            "updated_at": skill.updated_at,
        })

    return items, total


async def get_skill_detail(slug: str, db: AsyncSession, user_id: Optional[UUID] = None) -> Optional[dict]:
    result = await db.execute(
        select(Skill).where(Skill.name == slug, Skill.status != SkillStatusEnum.offline)
    )
    skill = result.scalar_one_or_none()
    if not skill:
        return None

    from app.models.user import User
    author_result = await db.execute(select(User).where(User.id == skill.author_id))
    author = author_result.scalar_one()

    stats = await get_skill_stats(skill.id, db)
    interactions = await get_user_interactions(skill.id, user_id, db)

    # Read SKILL.md content
    content = None
    if skill.category and skill.name:
        file_data = git_get_file_content(skill.category, skill.name, "SKILL.md")
        if file_data:
            content = get_skill_content_without_frontmatter(file_data["content"])

    # Versions
    versions_result = await db.execute(
        select(SkillVersion).where(SkillVersion.skill_id == skill.id).order_by(SkillVersion.created_at.desc())
    )
    versions = versions_result.scalars().all()

    return {
        "id": skill.id,
        "name": skill.name,
        "display_name": skill.display_name,
        "description": skill.description,
        "category": skill.category,
        "tags": skill.tags,
        "rating": skill.rating.value,
        "origin_type": skill.origin_type.value,
        "version": skill.version,
        "recommendation": skill.recommendation,
        "author": {
            "id": author.id,
            "nickname": author.nickname,
            "avatar_url": author.avatar_url,
            "email": author.email,
        },
        "stats": stats,
        **interactions,
        "content": content,
        "versions": [
            {
                "id": v.id,
                "version": v.version,
                "changelog": v.changelog,
                "rating": v.rating.value if v.rating else None,
                "created_at": v.created_at,
            }
            for v in versions
        ],
        "created_at": skill.created_at,
        "updated_at": skill.updated_at,
    }


async def upload_skill(
    zip_path: str,
    author_id: UUID,
    recommendation: str,
    origin_type: str,
    tags: Optional[List[str]],
    db: AsyncSession,
) -> Tuple[Optional[dict], Optional[str]]:
    """Process skill upload. Returns (result, error)."""
    is_valid, error, frontmatter = validate_skill_zip(zip_path)
    if not is_valid:
        return None, error

    name = frontmatter["name"]
    description = frontmatter.get("description", "")
    version = frontmatter.get("version", "1.0.0")
    category = frontmatter.get("category", "tools")
    fm_tags = frontmatter.get("tags", [])

    # Check for duplicate name (different author)
    existing = await db.execute(select(Skill).where(Skill.name == name))
    existing_skill = existing.scalar_one_or_none()
    if existing_skill and existing_skill.author_id != author_id:
        return None, f"Skill name '{name}' already exists by another author"

    # Extract ZIP
    tmp_dir = tempfile.mkdtemp()
    try:
        extracted = extract_zip_to_dir(zip_path, tmp_dir)

        # Check for agents directory
        has_agents = os.path.isdir(os.path.join(extracted, "agents"))

        # Read SKILL.md content for rating
        skill_md_path = os.path.join(extracted, "SKILL.md")
        with open(skill_md_path, "r", encoding="utf-8") as f:
            content = f.read()
        content_body = get_skill_content_without_frontmatter(content)

        # Rate
        skill_rating, suggestions = rate_skill(content_body, frontmatter, has_agents)

        # Copy to repo
        copy_skill_to_repo(extracted, category, name)

        # Git commit
        commit_sha = git_commit_skill(
            category, name, version,
            f"{'Update' if existing_skill else 'Add'} skill"
        )

        if existing_skill:
            # Update existing
            existing_skill.description = description
            existing_skill.version = version
            existing_skill.recommendation = recommendation
            existing_skill.origin_type = origin_type
            existing_skill.rating = skill_rating
            existing_skill.tags = (tags or []) + fm_tags
            existing_skill.category = category
            existing_skill.display_name = frontmatter.get("display_name", name)
            await db.flush()
            skill = existing_skill
        else:
            # Create new
            skill = Skill(
                name=name,
                display_name=frontmatter.get("display_name", name),
                description=description,
                author_id=author_id,
                recommendation=recommendation,
                origin_type=origin_type,
                rating=skill_rating,
                version=version,
                tags=(tags or []) + fm_tags,
                category=category,
                git_path=f"skills/{category}/{name}",
            )
            db.add(skill)
            await db.flush()
            await db.refresh(skill)

        # Create version record
        sv = SkillVersion(
            skill_id=skill.id,
            version=version,
            changelog=f"{'Updated' if existing_skill else 'Initial'} version",
            rating=skill_rating,
            git_commit_sha=commit_sha,
            author_id=author_id,
        )
        db.add(sv)
        await db.flush()

        return {
            "id": skill.id,
            "name": skill.name,
            "rating": skill_rating.value,
            "version": version,
            "suggestions": suggestions if suggestions else None,
        }, None

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
