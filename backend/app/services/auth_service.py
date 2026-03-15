from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User, RoleEnum, UserStatusEnum
from app.utils.password import generate_random_password, hash_password, verify_password
from app.utils.email import send_password_email
from app.middleware.auth import create_access_token
from app.config import settings
from typing import Tuple, Optional


async def register_user(email: str, db: AsyncSession) -> Tuple[User, str]:
    """Register a new user. Returns (user, raw_password)."""
    raw_password = generate_random_password()
    user = User(
        email=email,
        password_hash=hash_password(raw_password),
        role=RoleEnum.admin if email == settings.ADMIN_EMAIL else RoleEnum.user,
        status=UserStatusEnum.active,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Send password email (non-blocking, don't fail registration)
    await send_password_email(email, raw_password)

    return user, raw_password


async def login_user(email: str, password: str, db: AsyncSession) -> Optional[str]:
    """Login and return JWT token, or None if invalid."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    if user.status == UserStatusEnum.disabled:
        return None

    return create_access_token(user.id)


async def get_user_by_email(email: str, db: AsyncSession) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()
