"""initial schema

Revision ID: 20260316_0001
Revises:
Create Date: 2026-03-16 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260316_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


gender_enum = postgresql.ENUM("male", "female", "secret", name="genderenum", create_type=False)
role_enum = postgresql.ENUM("user", "admin", name="roleenum", create_type=False)
user_status_enum = postgresql.ENUM("active", "disabled", name="userstatusenum", create_type=False)
origin_type_enum = postgresql.ENUM("original", "derivative", "repost", name="origintypeenum", create_type=False)
rating_enum = postgresql.ENUM("S", "A", "B", "C", name="ratingenum", create_type=False)
skill_status_enum = postgresql.ENUM("active", "hidden", "offline", "disabled", name="skillstatusenum", create_type=False)
push_status_enum = postgresql.ENUM("pending", "delivered", "viewed", "dismissed", name="pushstatusenum", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    gender_enum.create(bind, checkfirst=True)
    role_enum.create(bind, checkfirst=True)
    user_status_enum.create(bind, checkfirst=True)
    origin_type_enum.create(bind, checkfirst=True)
    rating_enum.create(bind, checkfirst=True)
    skill_status_enum.create(bind, checkfirst=True)
    push_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("nickname", sa.String(length=50), nullable=True),
        sa.Column("description", sa.String(length=200), nullable=True),
        sa.Column("gender", gender_enum, nullable=True),
        sa.Column("zodiac", sa.String(length=20), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("status", user_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("origin_type", origin_type_enum, nullable=False),
        sa.Column("rating", rating_enum, nullable=False),
        sa.Column("version", sa.String(length=20), nullable=False),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("git_path", sa.String(length=500), nullable=True),
        sa.Column("status", skill_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_skills_name"), "skills", ["name"], unique=True)

    op.create_table(
        "ripples",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sender_id", "skill_id", name="uq_sender_skill_ripple"),
    )

    op.create_table(
        "skill_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.String(length=20), nullable=False),
        sa.Column("changelog", sa.Text(), nullable=True),
        sa.Column("rating", rating_enum, nullable=True),
        sa.Column("git_commit_sha", sa.String(length=40), nullable=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_skill_downloads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "skill_id", name="uq_user_skill_download"),
    )

    op.create_table(
        "user_skill_likes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "skill_id", name="uq_user_skill_like"),
    )

    op.create_table(
        "ripple_pushes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ripple_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", push_status_enum, nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["ripple_id"], ["ripples.id"]),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("ripple_pushes")
    op.drop_table("user_skill_likes")
    op.drop_table("user_skill_downloads")
    op.drop_table("skill_versions")
    op.drop_table("ripples")
    op.drop_index(op.f("ix_skills_name"), table_name="skills")
    op.drop_table("skills")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    push_status_enum.drop(bind, checkfirst=True)
    skill_status_enum.drop(bind, checkfirst=True)
    rating_enum.drop(bind, checkfirst=True)
    origin_type_enum.drop(bind, checkfirst=True)
    user_status_enum.drop(bind, checkfirst=True)
    role_enum.drop(bind, checkfirst=True)
    gender_enum.drop(bind, checkfirst=True)
