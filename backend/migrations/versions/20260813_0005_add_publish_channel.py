"""add publish channel to skills

Revision ID: 20260813_0005
Revises: 20260813_0004
Create Date: 2026-08-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260813_0005"
down_revision: Union[str, Sequence[str], None] = "20260813_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    publish_channel_enum = sa.Enum("production", "gray", name="publishchannelenum")
    publish_channel_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "skills",
        sa.Column(
            "publish_channel",
            publish_channel_enum,
            nullable=True,
            server_default="production",
        ),
    )
    op.execute("UPDATE skills SET publish_channel = 'production' WHERE publish_channel IS NULL")


def downgrade() -> None:
    op.drop_column("skills", "publish_channel")
