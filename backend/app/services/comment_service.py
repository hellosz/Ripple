from collections import defaultdict


def serialize_comment_tree(comment, users_by_id: dict, children_map: dict) -> dict:
    author = users_by_id[comment.author_id]
    return {
        "id": comment.id,
        "skill_id": comment.skill_id,
        "parent_id": comment.parent_id,
        "content": comment.content,
        "author": {
            "id": author.id,
            "nickname": author.nickname,
            "avatar_url": author.avatar_url,
            "email": author.email,
        },
        "children": [
            serialize_comment_tree(child, users_by_id, children_map)
            for child in children_map.get(comment.id, [])
        ],
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    }


def build_comment_threads(comments: list, users_by_id: dict) -> list[dict]:
    children_map: dict = defaultdict(list)
    roots = []
    for comment in comments:
        if comment.parent_id:
            children_map[comment.parent_id].append(comment)
        else:
            roots.append(comment)

    return [serialize_comment_tree(comment, users_by_id, children_map) for comment in roots]
