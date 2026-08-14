from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.schemas.user import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.services.auth_service import register_user, login_user, get_user_by_email
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.ripple_service import claim_guest_session_deliveries

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(
    req: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    existing = await get_user_by_email(req.email, db)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please login instead.",
        )

    user, raw_password = await register_user(req.email, db)
    await claim_guest_session_deliveries(
        request.headers.get("x-ripple-guest-session"),
        user.id,
        db,
    )
    from app.middleware.auth import create_access_token
    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = await login_user(req.email, req.password, db)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    user = await get_user_by_email(req.email, db)
    if user is not None:
        await claim_guest_session_deliveries(
            request.headers.get("x-ripple-guest-session"),
            user.id,
            db,
        )
    return TokenResponse(access_token=token)


@router.post("/logout")
async def logout():
    # JWT is stateless, client handles token removal
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/device/init")
async def device_init():
    """Start a device authorization flow for CLI login."""
    from app.services.device_flow import create_device, DEVICE_EXPIRES_SECONDS

    device_code, user_code = await create_device()
    return {
        "device_code": device_code,
        "user_code": user_code,
        "verification_url": f"{settings.FRONTEND_URL}/auth/device?code={user_code}",
        "expires_in": DEVICE_EXPIRES_SECONDS,
        "interval": 2,
    }


@router.get("/device/poll")
async def device_poll(device_code: str):
    """CLI polls this endpoint until the user authorizes in the browser."""
    from uuid import UUID
    from app.services.device_flow import get_device, consume
    from app.middleware.auth import create_access_token

    dev = await get_device(device_code)
    if not dev:
        raise HTTPException(status_code=400, detail="设备码无效或已过期，请重新登录")

    if dev["status"] == "pending":
        return {"status": "pending"}

    if dev["status"] == "authorized":
        await consume(device_code)
        token = create_access_token(UUID(dev["user_id"]))
        return {"status": "authorized", "access_token": token}

    return {"status": "unknown"}


@router.post("/device/confirm")
async def device_confirm(payload: dict, user: User = Depends(get_current_user)):
    """Browser confirms authorization for a pending user code (requires login)."""
    from app.services.device_flow import find_by_user_code, authorize

    user_code = payload.get("user_code", "")
    device_code, dev = await find_by_user_code(user_code)
    if not device_code:
        raise HTTPException(status_code=400, detail="验证码无效或已过期")

    await authorize(device_code, user.id)
    return {"status": "confirmed"}
