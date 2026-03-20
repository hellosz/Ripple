import os
import tempfile
import shutil
import hashlib
from pathlib import Path
from uuid import UUID
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.models.skill import Skill, SkillVersion, SkillStatusEnum, RatingEnum, OriginTypeEnum
from app.models.interaction import UserSkillLike, UserSkillDownload, UserSkillCopy
from app.models.ripple import Ripple, RipplePush
from app.services.git_service import (
    copy_skill_to_repo,
    git_commit_skill,
    get_file_content as git_get_file_content,
)
from app.services.rating_service import rate_skill
from app.utils.validators import (
    validate_skill_zip,
    extract_zip_to_dir,
    find_skill_root,
    get_skill_content_without_frontmatter,
)

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def build_install_command(skill_name: str, category: Optional[str] = None) -> str:
    return f"npx skills add https://github.com/org/ripple --skill {skill_name}"


def compute_ripple_availability(
    copied_at,
    liked_at,
    rippled_at,
) -> bool:
    return copied_at is not None and liked_at is not None and rippled_at is None


def normalize_tags(*tag_sets: Optional[List[str]]) -> List[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for tag_set in tag_sets:
        for tag in tag_set or []:
            cleaned = tag.strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(cleaned)
    return normalized


def store_uploaded_skill_package(zip_path: str, skill_name: str, version: str) -> tuple[str, str, str]:
    with open(zip_path, "rb") as source_file:
        package_bytes = source_file.read()

    checksum = hashlib.sha256(package_bytes).hexdigest()
    relative_path = os.path.join(
        "backend",
        "storage",
        "skill_packages",
        skill_name,
        version,
        f"{checksum}.zip",
    )
    full_path = PROJECT_ROOT / relative_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(package_bytes)
    return relative_path, f"{skill_name}-{version}.zip", checksum


def resolve_package_storage_path(package_storage_path: Optional[str]) -> Optional[Path]:
    if not package_storage_path:
        return None
    resolved = PROJECT_ROOT / package_storage_path
    return resolved if resolved.is_file() else None


def build_upload_metadata(skill: Skill, version: Optional[SkillVersion]) -> dict:
    category = version.category if version and version.category else skill.category
    recommendation = (
        version.recommendation if version and version.recommendation is not None else skill.recommendation
    )
    origin_type = version.origin_type if version and version.origin_type else skill.origin_type
    install_command = (
        version.install_command
        if version and version.install_command
        else skill.install_command or build_install_command(skill.name, skill.category)
    )
    package_file_name = (
        version.package_file_name if version and version.package_file_name else skill.package_file_name
    )
    package_checksum = (
        version.package_checksum if version and version.package_checksum else skill.package_checksum
    )
    package_storage_path = (
        version.package_storage_path if version and version.package_storage_path else skill.package_storage_path
    )
    package_ready = resolve_package_storage_path(package_storage_path) is not None
    return {
        "category": category,
        "recommendation": recommendation,
        "origin_type": origin_type.value if hasattr(origin_type, "value") else origin_type,
        "install_command": install_command,
        "package_file_name": package_file_name,
        "package_checksum": package_checksum,
        "package_ready": package_ready,
        "download_source": "uploaded_package" if package_ready else "generated_repository_archive",
    }


async def get_current_version_record(skill: Skill, db: AsyncSession) -> Optional[SkillVersion]:
    exact_match = await db.execute(
        select(SkillVersion)
        .where(
            SkillVersion.skill_id == skill.id,
            SkillVersion.version == skill.version,
        )
        .order_by(SkillVersion.created_at.desc())
    )
    version_record = exact_match.scalars().first()
    if version_record:
        return version_record

    fallback = await db.execute(
        select(SkillVersion)
        .where(SkillVersion.skill_id == skill.id)
        .order_by(SkillVersion.created_at.desc())
    )
    return fallback.scalars().first()


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
    copy_count = (await db.execute(
        select(func.count()).select_from(UserSkillCopy).where(UserSkillCopy.skill_id == skill_id)
    )).scalar() or 0

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
        "copy_count": copy_count,
        "like_count": like_count,
        "download_count": download_count,
        "ripple_count": ripple_count,
        "ripple_reach": ripple_reach,
        "copy_size_tier": get_size_tier(copy_count),
        "like_size_tier": get_size_tier(like_count),
        "download_size_tier": get_size_tier(download_count),
        "ripple_size_tier": get_size_tier(ripple_count),
    }


async def get_user_interactions(skill_id: UUID, user_id: Optional[UUID], db: AsyncSession) -> dict:
    if not user_id:
        return {
            "user_copied": False,
            "user_liked": False,
            "user_downloaded": False,
            "user_rippled": False,
            "ripple_available": False,
            "engagement_state": {
                "copied_at": None,
                "liked_at": None,
                "downloaded_at": None,
                "rippled_at": None,
                "ripple_available": False,
            },
        }

    copied = (await db.execute(
        select(UserSkillCopy).where(
            UserSkillCopy.user_id == user_id,
            UserSkillCopy.skill_id == skill_id,
        )
    )).scalar_one_or_none()

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

    copied_at = copied.created_at if copied else None
    liked_at = liked.created_at if liked else None
    downloaded_at = downloaded.created_at if downloaded else None
    rippled_at = rippled.created_at if rippled else None
    ripple_available = compute_ripple_availability(copied_at, liked_at, rippled_at)

    return {
        "user_copied": copied is not None,
        "user_liked": liked is not None,
        "user_downloaded": downloaded is not None,
        "user_rippled": rippled is not None,
        "ripple_available": ripple_available,
        "engagement_state": {
            "copied_at": copied_at,
            "liked_at": liked_at,
            "downloaded_at": downloaded_at,
            "rippled_at": rippled_at,
            "ripple_available": ripple_available,
        },
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

        version_record = await get_current_version_record(skill, db)
        upload_metadata = build_upload_metadata(skill, version_record)
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
            "recommendation": skill.recommendation,
            "upload_metadata": upload_metadata,
            "install_command": upload_metadata["install_command"],
            "download_url": f"/api/skills/{skill.name}/download",
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

    version_record = await get_current_version_record(skill, db)
    upload_metadata = build_upload_metadata(skill, version_record)
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
        "upload_metadata": upload_metadata,
        "install_command": upload_metadata["install_command"],
        "download_url": f"/api/skills/{skill.name}/download",
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
    category: str,
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
    frontmatter_category = frontmatter.get("category", "tools")
    effective_category = (category or frontmatter_category or "").strip()
    if not effective_category:
        return None, "Category is required"
    if not recommendation or not recommendation.strip():
        return None, "Recommendation is required"

    try:
        normalized_origin_type = OriginTypeEnum(origin_type)
    except ValueError:
        return None, "Invalid origin type"

    install_command = build_install_command(name, effective_category)
    package_storage_path, package_file_name, package_checksum = store_uploaded_skill_package(
        zip_path,
        name,
        version,
    )
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
        skill_root = find_skill_root(extracted)
        if not skill_root:
            return None, "ZIP must contain a SKILL.md file"

        # Check for agents directory
        has_agents = os.path.isdir(os.path.join(skill_root, "agents"))

        # Read SKILL.md content for rating
        skill_md_path = os.path.join(skill_root, "SKILL.md")
        with open(skill_md_path, "r", encoding="utf-8") as f:
            content = f.read()
        content_body = get_skill_content_without_frontmatter(content)

        # Rate
        skill_rating, suggestions = rate_skill(content_body, frontmatter, has_agents)

        # Copy to repo
        copy_skill_to_repo(skill_root, effective_category, name)

        # Git commit
        commit_sha = git_commit_skill(
            effective_category, name, version,
            f"{'Update' if existing_skill else 'Add'} skill"
        )

        if existing_skill:
            # Update existing
            existing_skill.description = description
            existing_skill.version = version
            existing_skill.recommendation = recommendation.strip()
            existing_skill.origin_type = normalized_origin_type
            existing_skill.rating = skill_rating
            existing_skill.tags = normalize_tags(tags, fm_tags)
            existing_skill.category = effective_category
            existing_skill.install_command = install_command
            existing_skill.package_file_name = package_file_name
            existing_skill.package_storage_path = package_storage_path
            existing_skill.package_checksum = package_checksum
            existing_skill.display_name = frontmatter.get("display_name", name)
            existing_skill.git_path = f"skills/{effective_category}/{name}"
            await db.flush()
            skill = existing_skill
        else:
            # Create new
            skill = Skill(
                name=name,
                display_name=frontmatter.get("display_name", name),
                description=description,
                author_id=author_id,
                recommendation=recommendation.strip(),
                origin_type=normalized_origin_type,
                rating=skill_rating,
                version=version,
                tags=normalize_tags(tags, fm_tags),
                category=effective_category,
                install_command=install_command,
                package_file_name=package_file_name,
                package_storage_path=package_storage_path,
                package_checksum=package_checksum,
                git_path=f"skills/{effective_category}/{name}",
            )
            db.add(skill)
            await db.flush()
            await db.refresh(skill)

        # Create version record
        sv = SkillVersion(
            skill_id=skill.id,
            version=version,
            changelog=f"{'Updated' if existing_skill else 'Initial'} version",
            category=effective_category,
            recommendation=recommendation.strip(),
            origin_type=normalized_origin_type,
            rating=skill_rating,
            install_command=install_command,
            package_file_name=package_file_name,
            package_storage_path=package_storage_path,
            package_checksum=package_checksum,
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
            "install_command": install_command,
            "download_url": f"/api/skills/{skill.name}/download",
            "suggestions": suggestions if suggestions else None,
        }, None

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
