import asyncio
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.middleware.auth import decode_token
from app.models.user import User
from app.services.notification_service import register_connection, unregister_connection
from app.services.ripple_service import get_pending_pushes

router = APIRouter(prefix="/api/sse", tags=["sse"])


@router.get("/notifications")
async def sse_notifications(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = request.query_params.get("token")
    user_id = decode_token(token) if token else None
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.status.value == "disabled":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    queue = register_connection(user.id)

    async def event_stream():
        try:
            # Send any pending notifications first
            pending = await get_pending_pushes(user.id, db)
            for notification in pending:
                yield f"data: {__import__('json').dumps(notification, default=str)}\n\n"

            # Keep connection alive
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {message}\n\n"
                except asyncio.TimeoutError:
                    # Send heartbeat
                    yield ": heartbeat\n\n"
        finally:
            unregister_connection(user.id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
