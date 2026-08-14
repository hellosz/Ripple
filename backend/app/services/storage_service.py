"""MinIO (S3-compatible) object storage for skill packages."""

import logging
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


def build_object_key(skill_name: str, version: str, checksum: str) -> str:
    """Content-addressed object key within the skill package bucket."""
    return f"{skill_name}/{version}/{checksum}.zip"


def _client():
    scheme = "https" if settings.MINIO_SECURE else "http"
    return boto3.client(
        "s3",
        endpoint_url=f"{scheme}://{settings.MINIO_ENDPOINT}",
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def put_package(object_key: str, data: bytes) -> None:
    """Upload package bytes to the object store."""
    client = _client()
    client.put_object(Bucket=settings.MINIO_BUCKET, Key=object_key, Body=data)


def get_package(object_key: str) -> Optional[bytes]:
    """Download package bytes, returning None when the object is missing."""
    client = _client()
    try:
        response = client.get_object(Bucket=settings.MINIO_BUCKET, Key=object_key)
        return response["Body"].read()
    except ClientError as exc:
        if exc.response["Error"]["Code"] in ("NoSuchKey", "404", "NotFound"):
            return None
        logger.error(f"MinIO get_package failed for {object_key}: {exc}")
        raise


def package_exists(object_key: str) -> bool:
    """Return whether the object exists in the bucket."""
    client = _client()
    try:
        client.head_object(Bucket=settings.MINIO_BUCKET, Key=object_key)
        return True
    except ClientError:
        return False


def delete_package(object_key: str) -> None:
    """Delete an object from the bucket (best-effort)."""
    client = _client()
    try:
        client.delete_object(Bucket=settings.MINIO_BUCKET, Key=object_key)
    except ClientError as exc:
        logger.warning(f"MinIO delete_package failed for {object_key}: {exc}")
