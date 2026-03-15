import os
import shutil
import logging
from typing import Optional, List, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)


def get_skills_base_path() -> str:
    """Get the base path for skills storage."""
    if settings.SKILLS_REPO_PATH:
        return settings.SKILLS_REPO_PATH
    # Default: skills/ directory relative to project root
    return os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "..", "skills")


def get_skill_path(category: str, name: str) -> str:
    return os.path.join(get_skills_base_path(), category, name)


def copy_skill_to_repo(source_dir: str, category: str, name: str) -> str:
    """Copy extracted skill files to the git repo."""
    target = get_skill_path(category, name)
    if os.path.exists(target):
        shutil.rmtree(target)
    shutil.copytree(source_dir, target)
    return target


def git_commit_skill(category: str, name: str, version: str, message: str) -> Optional[str]:
    """Git add, commit and return commit SHA."""
    try:
        import git

        repo_path = get_skills_base_path()
        # Walk up to find .git directory
        search = repo_path
        while search != "/":
            if os.path.isdir(os.path.join(search, ".git")):
                break
            search = os.path.dirname(search)
        else:
            logger.warning("No git repository found, skipping commit")
            return None

        repo = git.Repo(search)
        skill_rel_path = os.path.relpath(get_skill_path(category, name), search)
        repo.index.add([skill_rel_path])
        commit = repo.index.commit(f"[{name}] v{version}: {message}")

        if settings.GIT_REMOTE_URL and "origin" in [r.name for r in repo.remotes]:
            try:
                repo.remotes.origin.push()
            except Exception as e:
                logger.warning(f"Git push failed: {e}")

        return str(commit.hexsha)
    except Exception as e:
        logger.error(f"Git commit failed: {e}")
        return None


def get_file_tree(category: str, name: str) -> List[Dict[str, Any]]:
    """Get the file tree structure for a skill."""
    skill_path = get_skill_path(category, name)
    if not os.path.exists(skill_path):
        return []

    def build_tree(path: str, base_path: str) -> List[Dict[str, Any]]:
        entries = []
        try:
            items = sorted(os.listdir(path))
        except OSError:
            return entries

        for item in items:
            full = os.path.join(path, item)
            rel = os.path.relpath(full, base_path)
            if item.startswith("."):
                continue
            if os.path.isdir(full):
                entries.append({
                    "name": item,
                    "path": rel,
                    "type": "directory",
                    "children": build_tree(full, base_path),
                })
            else:
                entries.append({
                    "name": item,
                    "path": rel,
                    "type": "file",
                    "size": os.path.getsize(full),
                })
        return entries

    return build_tree(skill_path, skill_path)


def get_file_content(category: str, name: str, file_path: str) -> Optional[Dict[str, Any]]:
    """Read a file from a skill directory."""
    skill_path = get_skill_path(category, name)
    full_path = os.path.join(skill_path, file_path)

    # Security: ensure path doesn't escape skill directory
    real_skill = os.path.realpath(skill_path)
    real_file = os.path.realpath(full_path)
    if not real_file.startswith(real_skill):
        return None

    if not os.path.isfile(full_path):
        return None

    ext = os.path.splitext(file_path)[1].lower()
    binary_exts = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot"}
    lang_map = {
        ".py": "python", ".js": "javascript", ".ts": "typescript", ".tsx": "tsx",
        ".yaml": "yaml", ".yml": "yaml", ".json": "json", ".md": "markdown",
        ".sh": "bash", ".bash": "bash", ".css": "css", ".html": "html",
        ".sql": "sql", ".toml": "toml", ".xml": "xml", ".go": "go",
        ".rs": "rust", ".java": "java", ".rb": "ruby",
    }

    if ext in binary_exts:
        import base64
        with open(full_path, "rb") as f:
            content = base64.b64encode(f.read()).decode("utf-8")
        return {
            "path": file_path,
            "name": os.path.basename(file_path),
            "content": content,
            "language": None,
            "is_binary": True,
        }

    try:
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
    except UnicodeDecodeError:
        return {"path": file_path, "name": os.path.basename(file_path), "content": "", "language": None, "is_binary": True}

    return {
        "path": file_path,
        "name": os.path.basename(file_path),
        "content": content,
        "language": lang_map.get(ext),
        "is_binary": False,
    }


def create_skill_zip(category: str, name: str) -> Optional[str]:
    """Create a ZIP of a skill directory, returns path to temp ZIP file."""
    import tempfile
    import zipfile

    skill_path = get_skill_path(category, name)
    if not os.path.exists(skill_path):
        return None

    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(skill_path):
            for file in files:
                full = os.path.join(root, file)
                arcname = os.path.join(name, os.path.relpath(full, skill_path))
                zf.write(full, arcname)

    return tmp.name
