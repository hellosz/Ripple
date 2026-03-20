from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.services.comment_service import build_comment_threads


def make_user(name: str):
    return SimpleNamespace(
        id=uuid4(),
        nickname=name,
        avatar_url=None,
        email=f"{name}@example.com",
    )


def make_comment(skill_id, author_id, content: str, parent_id=None):
    return SimpleNamespace(
        id=uuid4(),
        skill_id=skill_id,
        author_id=author_id,
        parent_id=parent_id,
        content=content,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def test_comment_threads_keep_top_level_and_deep_replies_attached():
    skill_id = uuid4()
    root_user = make_user("root")
    child_user = make_user("child")
    grandchild_user = make_user("grandchild")

    root = make_comment(skill_id, root_user.id, "root")
    child = make_comment(skill_id, child_user.id, "child", parent_id=root.id)
    grandchild = make_comment(skill_id, grandchild_user.id, "grandchild", parent_id=child.id)

    threads = build_comment_threads(
        [root, child, grandchild],
        {
            root_user.id: root_user,
            child_user.id: child_user,
            grandchild_user.id: grandchild_user,
        },
    )

    assert len(threads) == 1
    assert threads[0]["content"] == "root"
    assert threads[0]["children"][0]["content"] == "child"
    assert threads[0]["children"][0]["children"][0]["content"] == "grandchild"
