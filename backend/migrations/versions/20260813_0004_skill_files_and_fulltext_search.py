"""skill files and full-text search

Revision ID: 20260813_0004
Revises: 20260320_0003
Create Date: 2026-08-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260813_0004"
down_revision: Union[str, Sequence[str], None] = "20260320_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "skill_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.String(length=20), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("language", sa.String(length=50), nullable=True),
        sa.Column("size", sa.Integer(), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_skill_files_skill_version", "skill_files", ["skill_id", "version"])
    op.create_index("ix_skill_files_path", "skill_files", ["path"])
    op.execute(
        "CREATE INDEX ix_skill_files_content_trgm ON skill_files USING gin (content gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_skill_files_content_trgm")
    op.drop_index("ix_skill_files_path", table_name="skill_files")
    op.drop_index("ix_skill_files_skill_version", table_name="skill_files")
    op.drop_table("skill_files")
