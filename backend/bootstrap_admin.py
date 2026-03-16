"""Create or update the default admin user."""

import asyncio

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.user import RoleEnum, User, UserStatusEnum
from app.utils.password import hash_password


async def bootstrap_admin() -> None:
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
        user = result.scalar_one_or_none()

        if user:
            user.password_hash = hash_password(settings.ADMIN_PASSWORD)
            user.role = RoleEnum.admin
            user.status = UserStatusEnum.active
            print(f"Updated admin user: {user.email}")
        else:
            user = User(
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                nickname="Admin",
                role=RoleEnum.admin,
                status=UserStatusEnum.active,
            )
            db.add(user)
            print(f"Created admin user: {user.email}")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(bootstrap_admin())
