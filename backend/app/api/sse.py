import asyncio
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.notification_service import register_connection, unregister_connection
from app.services.ripple_service import get_pending_pushes

router = APIRouter(prefix="/api/sse", tags=["sse"])


@router.get("/notifications")
async def sse_notifications(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
