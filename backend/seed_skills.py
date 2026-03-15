"""Seed script: import existing skill files from /skills/ into the database."""

import asyncio
import os
import yaml
from pathlib import Path
from sqlalchemy import select
from app.database import engine, async_session, Base
from app.models.user import User
from app.models.skill import Skill, SkillVersion, SkillStatusEnum, RatingEnum, OriginTypeEnum
from app.config import settings


def parse_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter from SKILL.md."""
    if not content.startswith("---"):
        return {}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}
    return yaml.safe_load(parts[1]) or {}


async def seed():
    skills_root = Path(settings.SKILLS_REPO_PATH or os.path.join(os.path.dirname(__file__), "..", "skills"))
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
        skill_files = list(skills_root.glob("*/*/SKILL.md"))
        if not skill_files:
            print(f"No SKILL.md files found under {skills_root}")
            return

        seeded = 0
        for skill_md in skill_files:
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

            # Map rating
            rating_str = fm.get("rating", "B")
            try:
                rating = RatingEnum(rating_str)
            except ValueError:
                rating = RatingEnum.B

            # Map origin
            origin_str = fm.get("origin", "original")
            try:
                origin = OriginTypeEnum(origin_str)
            except ValueError:
                origin = OriginTypeEnum.original

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
                git_path=f"skills/{category}/{name}",
                status=SkillStatusEnum.active,
            )
            db.add(skill)
            await db.flush()
            await db.refresh(skill)

            sv = SkillVersion(
                skill_id=skill.id,
                version=version,
                changelog="Initial seed import",
                rating=rating,
                git_commit_sha=None,
                author_id=admin.id,
            )
            db.add(sv)

            print(f"  Seeded: {name} (category={category}, rating={rating.value})")
            seeded += 1

        await db.commit()
        print(f"\nDone! Seeded {seeded} skill(s).")


if __name__ == "__main__":
    asyncio.run(seed())
