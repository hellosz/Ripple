"""skill engagement delivery contract

Revision ID: 20260320_0003
Revises: 20260317_0002
Create Date: 2026-03-20 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260320_0003"
down_revision: Union[str, Sequence[str], None] = "20260317_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


origin_type_enum = postgresql.ENUM("original", "derivative", "repost", name="origintypeenum", create_type=False)
push_status_enum = postgresql.ENUM("pending", "shown", "consumed", "dismissed", name="pushstatusenum", create_type=False)
legacy_push_status_enum = postgresql.ENUM(
    "pending",
    "delivered",
    "viewed",
    "dismissed",
    name="pushstatusenum_old",
    create_type=False,
)
restored_push_status_enum = postgresql.ENUM(
    "pending",
    "delivered",
    "viewed",
    "dismissed",
    name="pushstatusenum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    origin_type_enum.create(bind, checkfirst=True)

    op.add_column("skills", sa.Column("install_command", sa.String(length=500), nullable=True))
    op.add_column("skills", sa.Column("package_file_name", sa.String(length=255), nullable=True))
    op.add_column("skills", sa.Column("package_storage_path", sa.String(length=500), nullable=True))
    op.add_column("skills", sa.Column("package_checksum", sa.String(length=64), nullable=True))

    op.add_column("skill_versions", sa.Column("category", sa.String(length=50), nullable=True))
    op.add_column("skill_versions", sa.Column("recommendation", sa.Text(), nullable=True))
    op.add_column("skill_versions", sa.Column("origin_type", origin_type_enum, nullable=True))
    op.add_column("skill_versions", sa.Column("install_command", sa.String(length=500), nullable=True))
    op.add_column("skill_versions", sa.Column("package_file_name", sa.String(length=255), nullable=True))
    op.add_column("skill_versions", sa.Column("package_storage_path", sa.String(length=500), nullable=True))
    op.add_column("skill_versions", sa.Column("package_checksum", sa.String(length=64), nullable=True))

    op.add_column("ripples", sa.Column("sender_nickname", sa.String(length=50), nullable=True))
    op.add_column("ripples", sa.Column("comment", sa.String(length=500), nullable=True))

    op.create_table(
        "guest_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_key", sa.String(length=64), nullable=False),
        sa.Column("claimed_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["claimed_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_guest_sessions_session_key"), "guest_sessions", ["session_key"], unique=True)

    op.add_column("ripple_pushes", sa.Column("guest_session_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("ripple_pushes", sa.Column("shown_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("ripple_pushes", sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_ripple_pushes_guest_session_id_guest_sessions",
        "ripple_pushes",
        "guest_sessions",
        ["guest_session_id"],
        ["id"],
    )
    op.alter_column("ripple_pushes", "target_user_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    op.execute("UPDATE ripple_pushes SET shown_at = delivered_at, consumed_at = viewed_at")

    op.execute("ALTER TYPE pushstatusenum RENAME TO pushstatusenum_old")
    push_status_enum.create(bind, checkfirst=True)
    op.execute(
        """
        ALTER TABLE ripple_pushes
        ALTER COLUMN status TYPE pushstatusenum
        USING (
            CASE status::text
                WHEN 'delivered' THEN 'shown'
                WHEN 'viewed' THEN 'consumed'
                ELSE status::text
            END
        )::pushstatusenum
        """
    )
    legacy_push_status_enum.drop(bind, checkfirst=True)

    op.drop_column("ripple_pushes", "delivered_at")
    op.drop_column("ripple_pushes", "viewed_at")

    op.execute(
        """
        UPDATE skills
        SET install_command = 'npx skills add https://github.com/org/ripple --skill ' || name
        WHERE install_command IS NULL
        """
    )

    op.execute(
        """
        UPDATE skill_versions AS sv
        SET
            category = s.category,
            recommendation = s.recommendation,
            origin_type = s.origin_type,
            install_command = COALESCE(s.install_command, 'npx skills add https://github.com/org/ripple --skill ' || s.name),
            package_file_name = s.package_file_name,
            package_storage_path = s.package_storage_path,
            package_checksum = s.package_checksum
        FROM skills AS s
        WHERE sv.skill_id = s.id
        """
    )

    op.execute(
        """
        UPDATE ripples AS r
        SET sender_nickname = u.nickname
        FROM users AS u
        WHERE r.sender_id = u.id
        """
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.add_column("ripple_pushes", sa.Column("viewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("ripple_pushes", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE ripple_pushes SET delivered_at = shown_at, viewed_at = consumed_at")

    op.execute("ALTER TYPE pushstatusenum RENAME TO pushstatusenum_new")
    restored_push_status_enum.create(bind, checkfirst=True)
    op.execute(
        """
        ALTER TABLE ripple_pushes
        ALTER COLUMN status TYPE pushstatusenum
        USING (
            CASE status::text
                WHEN 'shown' THEN 'delivered'
                WHEN 'consumed' THEN 'viewed'
                ELSE status::text
            END
        )::pushstatusenum
        """
    )
    op.execute("DROP TYPE pushstatusenum_new")

    op.drop_constraint("fk_ripple_pushes_guest_session_id_guest_sessions", "ripple_pushes", type_="foreignkey")
    op.execute("DELETE FROM ripple_pushes WHERE target_user_id IS NULL")
    op.alter_column("ripple_pushes", "target_user_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.drop_column("ripple_pushes", "consumed_at")
    op.drop_column("ripple_pushes", "shown_at")
    op.drop_column("ripple_pushes", "guest_session_id")

    op.drop_index(op.f("ix_guest_sessions_session_key"), table_name="guest_sessions")
    op.drop_table("guest_sessions")

    op.drop_column("ripples", "comment")
    op.drop_column("ripples", "sender_nickname")

    op.drop_column("skill_versions", "package_checksum")
    op.drop_column("skill_versions", "package_storage_path")
    op.drop_column("skill_versions", "package_file_name")
    op.drop_column("skill_versions", "install_command")
    op.drop_column("skill_versions", "origin_type")
    op.drop_column("skill_versions", "recommendation")
    op.drop_column("skill_versions", "category")

    op.drop_column("skills", "package_checksum")
    op.drop_column("skills", "package_storage_path")
    op.drop_column("skills", "package_file_name")
    op.drop_column("skills", "install_command")
