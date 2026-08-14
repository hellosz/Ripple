"""Seed script: import skill files from /skills/ into the database + MinIO."""

import asyncio
import hashlib
import io
import os
import zipfile
from pathlib import Path

import yaml
from sqlalchemy import select

from app.database import async_session
from app.models.user import User
from app.models.skill import Skill, SkillVersion, SkillStatusEnum, RatingEnum, OriginTypeEnum
from app.models.skill_file import SkillFile
from app.config import settings
from app.services.skill_service import iter_text_files, build_install_command
from app.services.storage_service import build_object_key, put_package, package_exists


def parse_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter from SKILL.md."""
    if not content.startswith("---"):
        return {}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}
    return yaml.safe_load(parts[1]) or {}


def zip_skill_dir(skill_dir: Path, name: str) -> bytes:
    """Build a ZIP in memory from a skill directory, mirroring the upload package shape."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(skill_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for file_name in sorted(files):
                if file_name.startswith("."):
                    continue
                full_path = os.path.join(root, file_name)
                arcname = os.path.join(name, os.path.relpath(full_path, skill_dir))
                zf.write(full_path, arcname)
    return buffer.getvalue()


async def seed():
    skills_root = Path(
        settings.SKILLS_REPO_PATH or os.path.join(os.path.dirname(__file__), "..", "skills")
    )
    skills_root = skills_root.resolve()

    if not skills_root.exists():
        print(f"Skills directory not found: {skills_root}")
        return

    async with async_session() as db:
        # Get admin user as author
        result = await db.execute(select(User).where(User.role == "admin").limit(1))
        admin = result.scalar_one_or_none()
        if not admin:
            print("No admin user found. Register one first.")
            return

        print(f"Using author: {admin.email} ({admin.id})")

        # Scan all SKILL.md files
        skill_md_paths = list(skills_root.glob("*/*/SKILL.md"))
        if not skill_md_paths:
            print(f"No SKILL.md files found under {skills_root}")
            return

        seeded = 0
        for skill_md in skill_md_paths:
            skill_dir = skill_md.parent
            content = skill_md.read_text(encoding="utf-8")
            fm = parse_frontmatter(content)
            if not fm.get("name"):
                print(f"  Skipping {skill_md} — no 'name' in frontmatter")
                continue

            name = fm["name"]

            # Check if already exists
            existing = await db.execute(select(Skill).where(Skill.name == name))
            if existing.scalar_one_or_none():
                print(f"  Skipping '{name}' — already in database")
                continue

            category = fm.get("category", "tools")
            version = fm.get("version", "1.0.0")
            tags = fm.get("tags", [])
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(",")]

            rating_str = fm.get("rating", "B")
            try:
                rating = RatingEnum(rating_str)
            except ValueError:
                rating = RatingEnum.B

            origin_str = fm.get("origin", "original")
            try:
                origin = OriginTypeEnum(origin_str)
            except ValueError:
                origin = OriginTypeEnum.original

            install_command = build_install_command(name, category)

            # Package the directory and store it in MinIO (content-addressed)
            package_bytes = zip_skill_dir(skill_dir, name)
            checksum = hashlib.sha256(package_bytes).hexdigest()
            object_key = build_object_key(name, version, checksum)
            if not package_exists(object_key):
                put_package(object_key, package_bytes)

            skill = Skill(
                name=name,
                display_name=fm.get("display_name", name),
                description=fm.get("description", ""),
                author_id=admin.id,
                recommendation=None,
                origin_type=origin,
                rating=rating,
                version=version,
                tags=tags,
                category=category,
                install_command=install_command,
                package_file_name=f"{name}-{version}.zip",
                package_storage_path=object_key,
                package_checksum=checksum,
                status=SkillStatusEnum.active,
            )
            db.add(skill)
            await db.flush()
            await db.refresh(skill)

            sv = SkillVersion(
                skill_id=skill.id,
                version=version,
                changelog="Initial seed import",
                category=category,
                recommendation=None,
                origin_type=origin,
                rating=rating,
                install_command=install_command,
                package_file_name=f"{name}-{version}.zip",
                package_storage_path=object_key,
                package_checksum=checksum,
                git_commit_sha=None,
                author_id=admin.id,
            )
            db.add(sv)

            # Index text files for browsing and full-text search
            for record in iter_text_files(str(skill_dir)):
                db.add(SkillFile(
                    skill_id=skill.id,
                    version=version,
                    path=record["path"],
                    content=record["content"],
                    language=record["language"],
                    size=record["size"],
                    sha256=record["sha256"],
                ))

            await db.flush()
            print(f"  Seeded: {name} (category={category}, rating={rating.value})")
            seeded += 1

        await db.commit()
        print(f"\nDone! Seeded {seeded} skill(s).")


if __name__ == "__main__":
    asyncio.run(seed())
