"""Backfill skill_files and MinIO packages for existing skills."""

import asyncio
import hashlib
import os
from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.skill import Skill
from app.models.skill_file import SkillFile
from app.services.skill_service import iter_text_files
from app.services.storage_service import build_object_key, put_package, package_exists
from seed_skills import parse_frontmatter, zip_skill_dir


async def backfill():
    skills_root = Path(
        settings.SKILLS_REPO_PATH or os.path.join(os.path.dirname(__file__), "..", "skills")
    ).resolve()

    async with async_session() as db:
        for skill_md in sorted(skills_root.glob("*/*/SKILL.md")):
            skill_dir = skill_md.parent
            fm = parse_frontmatter(skill_md.read_text(encoding="utf-8"))
            name = fm.get("name")
            if not name:
                continue

            skill = (await db.execute(select(Skill).where(Skill.name == name))).scalar_one_or_none()
            if not skill:
                print(f"跳过 {name} — 数据库无记录")
                continue

            existing = (await db.execute(
                select(SkillFile).where(SkillFile.skill_id == skill.id).limit(1)
            )).scalars().first()
            if existing:
                print(f"跳过 {name} — skill_files 已有数据")
                continue

            version = skill.version
            package_bytes = zip_skill_dir(skill_dir, name)
            checksum = hashlib.sha256(package_bytes).hexdigest()
            object_key = build_object_key(name, version, checksum)
            if not package_exists(object_key):
                put_package(object_key, package_bytes)

            for rec in iter_text_files(str(skill_dir)):
                db.add(SkillFile(
                    skill_id=skill.id,
                    version=version,
                    path=rec["path"],
                    content=rec["content"],
                    language=rec["language"],
                    size=rec["size"],
                    sha256=rec["sha256"],
                ))

            skill.package_storage_path = object_key
            skill.package_checksum = checksum
            skill.package_file_name = f"{name}-{version}.zip"
            print(f"回填 {name} → {object_key}")

        await db.commit()
        print("完成")


if __name__ == "__main__":
    asyncio.run(backfill())
