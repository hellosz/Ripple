from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
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
