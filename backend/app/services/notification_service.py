import asyncio
import json
import logging
from typing import Dict, Set
from uuid import UUID

logger = logging.getLogger(__name__)

# In-memory store of active SSE connections: user_id -> set of queues
_connections: Dict[str, Set[asyncio.Queue]] = {}


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
    """Check if a user has active SSE connections."""
    return str(user_id) in _connections and len(_connections[str(user_id)]) > 0


async def push_to_user(user_id: UUID, data: dict):
    """Push a notification to all SSE connections of a user."""
    uid = str(user_id)
    if uid not in _connections:
        return False

    message = json.dumps(data, default=str)
    for queue in _connections[uid]:
        await queue.put(message)
    return True


async def push_to_users(user_ids: list[UUID], data: dict):
    """Push a notification to multiple users."""
    for uid in user_ids:
        await push_to_user(uid, data)
