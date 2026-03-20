from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, get_optional_user
from app.models.user import User
from app.services.ripple_service import mark_delivery_consumed, touch_guest_session

router = APIRouter(prefix="/api/ripples", tags=["ripples"])


@router.post("/guest-session/touch")
async def touch_guest_ripple_session(
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    guest_session = await touch_guest_session(
        request.headers.get("x-ripple-guest-session"),
        db,
        claimed_user_id=user.id if user else None,
    )
    if guest_session is None:
        raise HTTPException(status_code=400, detail="Missing guest session header")

    return {
        "session_key": guest_session.session_key,
        "claimed_user_id": str(guest_session.claimed_user_id) if guest_session.claimed_user_id else None,
    }


@router.post("/deliveries/{delivery_id}/consume")
async def consume_ripple_delivery(
    delivery_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    push = await mark_delivery_consumed(delivery_id, user.id, db)
    if push is None:
        raise HTTPException(status_code=404, detail="Ripple delivery not found")
    return {"message": "Ripple delivery consumed", "delivery_id": str(push.id)}
