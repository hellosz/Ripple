import zipfile
import tempfile
import os
import yaml
import logging
from typing import Tuple, Optional, Dict, Any

logger = logging.getLogger(__name__)


def validate_skill_zip(zip_path: str) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Validate a skill ZIP file.
    Returns (is_valid, error_message, frontmatter_data).
    """
    try:
        if not zipfile.is_zipfile(zip_path):
            return False, "Not a valid ZIP file", None

        with zipfile.ZipFile(zip_path, "r") as zf:
            # Security check: prevent path traversal
            for name in zf.namelist():
                if name.startswith("/") or ".." in name:
                    return False, f"Unsafe path in ZIP: {name}", None

            # Find SKILL.md
            skill_md_path = None
            for name in zf.namelist():
                basename = os.path.basename(name)
                if basename == "SKILL.md":
                    skill_md_path = name
                    break

            if not skill_md_path:
                return False, "ZIP must contain a SKILL.md file", None

            # Read and parse SKILL.md
            content = zf.read(skill_md_path).decode("utf-8")
            frontmatter = parse_frontmatter(content)

            if not frontmatter:
                return False, "SKILL.md must contain valid YAML frontmatter", None

            if "name" not in frontmatter:
                return False, "SKILL.md frontmatter must include 'name' field", None

            if "description" not in frontmatter:
                return False, "SKILL.md frontmatter must include 'description' field", None

            return True, None, frontmatter

    except Exception as e:
        logger.error(f"Error validating skill ZIP: {e}")
        return False, f"Error processing ZIP: {str(e)}", None


def parse_frontmatter(content: str) -> Optional[Dict[str, Any]]:
    """Parse YAML frontmatter from markdown content."""
    if not content.startswith("---"):
        return None

    parts = content.split("---", 2)
    if len(parts) < 3:
        return None

    try:
        return yaml.safe_load(parts[1])
    except yaml.YAMLError:
        return None


def get_skill_content_without_frontmatter(content: str) -> str:
    """Remove YAML frontmatter from markdown content."""
    if not content.startswith("---"):
        return content

    parts = content.split("---", 2)
    if len(parts) < 3:
        return content

    return parts[2].strip()


def extract_zip_to_dir(zip_path: str, target_dir: str) -> str:
    """
    Extract ZIP to target directory.
    Returns the root directory of extracted content.
    """
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(target_dir)

    # If ZIP contains a single root directory, return that
    entries = os.listdir(target_dir)
    if len(entries) == 1 and os.path.isdir(os.path.join(target_dir, entries[0])):
        return os.path.join(target_dir, entries[0])
    return target_dir


def find_skill_root(root_dir: str) -> Optional[str]:
    """Find the directory that contains SKILL.md inside extracted content."""
    for current_root, _, files in os.walk(root_dir):
        if "SKILL.md" in files:
            return current_root
    return None
