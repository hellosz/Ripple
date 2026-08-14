"""OAuth 2.0 Device Authorization Flow (Redis-backed).

CLI login uses this flow: the CLI requests a device code, the user opens a
verification URL in a browser and confirms, and the CLI polls until authorized.
State lives in Redis with TTL expiration, so it survives backend restarts.
"""

import json
import secrets
from uuid import UUID

from app.services.redis_client import redis_client

DEVICE_EXPIRES_SECONDS = 600  # 10 minutes
POLL_INTERVAL_SECONDS = 2

_USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _device_key(device_code: str) -> str:
    return f"ripple:device:{device_code}"


def _usercode_key(user_code: str) -> str:
    return f"ripple:device:usercode:{user_code}"


def _normalize_user_code(user_code: str) -> str:
    return user_code.replace(" ", "").replace("-", "").upper()


def _generate_user_code() -> str:
    code = "".join(secrets.choice(_USER_CODE_ALPHABET) for _ in range(8))
    return f"{code[:4]}-{code[4:]}"


async def create_device() -> tuple[str, str]:
    """Create a pending device flow and return (device_code, user_code)."""
    device_code = secrets.token_urlsafe(32)
    user_code = _generate_user_code()
    data = json.dumps({"user_code": user_code, "status": "pending", "user_id": None})

    await redis_client.set(_device_key(device_code), data, ex=DEVICE_EXPIRES_SECONDS)
    await redis_client.set(
        _usercode_key(_normalize_user_code(user_code)), device_code, ex=DEVICE_EXPIRES_SECONDS
    )
    return device_code, user_code


async def get_device(device_code: str):
    raw = await redis_client.get(_device_key(device_code))
    if not raw:
        return None
    return json.loads(raw)


async def find_by_user_code(user_code: str):
    normalized = _normalize_user_code(user_code)
    device_code = await redis_client.get(_usercode_key(normalized))
    if not device_code:
        return None, None
    dev = await get_device(device_code)
    if not dev:
        return None, None
    return device_code, dev


async def authorize(device_code: str, user_id: UUID) -> bool:
    dev = await get_device(device_code)
    if not dev:
        return False
    dev["status"] = "authorized"
    dev["user_id"] = str(user_id)
    await redis_client.set(_device_key(device_code), json.dumps(dev), ex=DEVICE_EXPIRES_SECONDS)
    return True


async def consume(device_code: str):
    """Pop the device flow record once authorized (single-use token exchange)."""
    dev = await get_device(device_code)
    if dev:
        await redis_client.delete(_device_key(device_code))
        await redis_client.delete(_usercode_key(_normalize_user_code(dev["user_code"])))
    return dev
