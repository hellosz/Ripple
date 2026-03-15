import os
import tempfile
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.skill import SkillListResponse, SkillDetail, FileTreeNode, FileContent, SkillUploadResponse
from app.middleware.auth import get_current_user, get_optional_user
from app.models.user import User
from app.models.skill import Skill, SkillStatusEnum
from app.services.skill_service import list_skills, get_skill_detail, upload_skill, get_skill_stats
from app.services.git_service import get_file_tree, get_file_content, create_skill_zip

router = APIRouter(prefix="/api/skills", tags=["skills"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("")
async def get_skills(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    rating: Optional[str] = Query(None),
    origin_type: Optional[str] = Query(None),
    sort_by: str = Query("updated_at"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    tag_list = tags.split(",") if tags else None
    items, total = await list_skills(
        db=db,
        user_id=user.id if user else None,
        search=search,
        category=category,
        tags=tag_list,
        rating=rating,
        origin_type=origin_type,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{slug}")
async def get_skill(
    slug: str,
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    detail = await get_skill_detail(slug, db, user.id if user else None)
    if not detail:
        raise HTTPException(status_code=404, detail="Skill not found")
    return detail


@router.get("/{slug}/files")
async def get_skill_files(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill or not skill.category:
        raise HTTPException(status_code=404, detail="Skill not found")

    tree = get_file_tree(skill.category, skill.name)
    return tree


@router.get("/{slug}/files/{file_path:path}")
async def get_skill_file_content(
    slug: str,
    file_path: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill or not skill.category:
        raise HTTPException(status_code=404, detail="Skill not found")

    content = get_file_content(skill.category, skill.name, file_path)
    if not content:
        raise HTTPException(status_code=404, detail="File not found")
    return content


@router.get("/{slug}/versions")
async def get_skill_versions(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    from app.models.skill import SkillVersion
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    versions_result = await db.execute(
        select(SkillVersion).where(SkillVersion.skill_id == skill.id).order_by(SkillVersion.created_at.desc())
    )
    versions = versions_result.scalars().all()
    return [
        {
            "id": v.id,
            "version": v.version,
            "changelog": v.changelog,
            "rating": v.rating.value if v.rating else None,
            "created_at": v.created_at,
        }
        for v in versions
    ]


@router.get("/{slug}/download")
async def download_skill(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill or not skill.category:
        raise HTTPException(status_code=404, detail="Skill not found")

    # Record download
    from app.models.interaction import UserSkillDownload
    existing = await db.execute(
        select(UserSkillDownload).where(
            UserSkillDownload.user_id == user.id,
            UserSkillDownload.skill_id == skill.id,
        )
    )
    dl = existing.scalar_one_or_none()
    if dl:
        dl.version = skill.version
    else:
        dl = UserSkillDownload(user_id=user.id, skill_id=skill.id, version=skill.version)
        db.add(dl)
    await db.flush()

    zip_path = create_skill_zip(skill.category, skill.name)
    if not zip_path:
        raise HTTPException(status_code=500, detail="Failed to create download package")

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"{skill.name}-v{skill.version}.zip",
    )


@router.post("", response_model=SkillUploadResponse)
async def create_skill(
    file: UploadFile = File(...),
    recommendation: str = Form(...),
    origin_type: str = Form(...),
    tags: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are accepted")

    # Save upload to temp file
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    try:
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        tmp.write(content)
        tmp.close()

        tag_list = tags.split(",") if tags else None
        result, error = await upload_skill(
            zip_path=tmp.name,
            author_id=user.id,
            recommendation=recommendation,
            origin_type=origin_type,
            tags=tag_list,
            db=db,
        )

        if error:
            raise HTTPException(status_code=400, detail=error)

        return result
    finally:
        os.unlink(tmp.name)


@router.put("/{slug}")
async def update_skill(
    slug: str,
    file: UploadFile = File(...),
    recommendation: str = Form(...),
    origin_type: str = Form(...),
    tags: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    if skill.author_id != user.id:
        raise HTTPException(status_code=403, detail="Only the author can update this skill")

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are accepted")

    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    try:
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        tmp.write(content)
        tmp.close()

        tag_list = tags.split(",") if tags else None
        upload_result, error = await upload_skill(
            zip_path=tmp.name,
            author_id=user.id,
            recommendation=recommendation,
            origin_type=origin_type,
            tags=tag_list,
            db=db,
        )

        if error:
            raise HTTPException(status_code=400, detail=error)

        # Notify subscribers of update
        from app.models.interaction import UserSkillDownload
        from app.services.notification_service import push_to_user, is_user_online
        subscribers = await db.execute(
            select(UserSkillDownload.user_id).where(UserSkillDownload.skill_id == skill.id)
        )
        for (uid,) in subscribers.fetchall():
            if uid != user.id and is_user_online(uid):
                await push_to_user(uid, {
                    "type": "skill_update",
                    "skill_name": skill.display_name,
                    "skill_slug": skill.name,
                    "new_version": upload_result["version"],
                    "changelog": "Skill updated",
                })

        return upload_result
    finally:
        os.unlink(tmp.name)


@router.patch("/{slug}/status")
async def update_skill_status(
    slug: str,
    status_update: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Skill).where(Skill.name == slug))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    if skill.author_id != user.id and user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")

    new_status = status_update.get("status")
    if new_status not in [e.value for e in SkillStatusEnum]:
        raise HTTPException(status_code=400, detail="Invalid status")

    skill.status = SkillStatusEnum(new_status)
    await db.flush()
    return {"message": f"Skill status updated to {new_status}"}
