import asyncio
import json
import logging
from typing import Dict, Set
from uuid import UUID

from app.services.redis_client import redis_client

logger = logging.getLogger(__name__)

# In-memory store of active SSE connections: user_id -> set of queues.
# asyncio.Queue 必须留在进程内（直接连着客户端），跨实例靠 Redis pub/sub 广播。
_connections: Dict[str, Set[asyncio.Queue]] = {}

_CHANNEL_PREFIX = "ripple:sse:"


def _channel(user_id: str) -> str:
    return f"{_CHANNEL_PREFIX}{user_id}"


def register_connection(user_id: UUID) -> asyncio.Queue:
    """Register a new SSE connection for a user."""
    queue = asyncio.Queue()
    uid = str(user_id)
    if uid not in _connections:
        _connections[uid] = set()
    _connections[uid].add(queue)
    logger.info(f"SSE connection registered for user {uid}. Total: {len(_connections[uid])}")
    return queue


def unregister_connection(user_id: UUID, queue: asyncio.Queue):
    """Remove an SSE connection."""
    uid = str(user_id)
    if uid in _connections:
        _connections[uid].discard(queue)
        if not _connections[uid]:
            del _connections[uid]


def is_user_online(user_id: UUID) -> bool:
    """Check if a user has active SSE connections (local to this instance)."""
    return str(user_id) in _connections and len(_connections[str(user_id)]) > 0


def _deliver_local(uid: str, message: str) -> bool:
    """Deliver a serialized message to all local connections of a user."""
    if uid not in _connections:
        return False
    for queue in _connections[uid]:
        queue.put_nowait(message)
    return True


async def push_to_user(user_id: UUID, data: dict):
    """Push a notification to a user across all instances via Redis pub/sub."""
    uid = str(user_id)
    message = json.dumps(data, default=str)

    try:
        await redis_client.publish(_channel(uid), message)
        return True
    except Exception as exc:
        # Redis unavailable → fall back to local delivery only
        logger.warning(f"Redis publish failed, falling back to local delivery: {exc}")
        return _deliver_local(uid, message)


async def push_to_users(user_ids: list[UUID], data: dict):
    """Push a notification to multiple users."""
    for uid in user_ids:
        await push_to_user(uid, data)


async def start_sse_subscriber():
    """Subscribe Redis SSE channels and forward messages to local connections.

    Runs as a background task started in the app lifespan.
    """
    pubsub = redis_client.pubsub()
    await pubsub.psubscribe(f"{_CHANNEL_PREFIX}*")
    logger.info("SSE Redis subscriber started")

    try:
        async for message in pubsub.listen():
            if message["type"] != "pmessage":
                continue
            channel = message["channel"]
            if isinstance(channel, bytes):
                channel = channel.decode()
            uid = channel[len(_CHANNEL_PREFIX):]
            _deliver_local(uid, message["data"])
    finally:
        await pubsub.unsubscribe()
        await pubsub.aclose()
