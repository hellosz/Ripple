import io
import zipfile
from types import SimpleNamespace

from app.services.skill_service import (
    iter_text_files,
    build_file_tree_from_paths,
    build_skill_files_zip_bytes,
)


def test_iter_text_files_extracts_text_and_skips_binary(tmp_path):
    (tmp_path / "SKILL.md").write_text("---\nname: demo\n---\n# Body\n", encoding="utf-8")
    agents = tmp_path / "agents"
    agents.mkdir()
    (agents / "openai.yaml").write_text("model: gpt-4o\n", encoding="utf-8")
    (tmp_path / "logo.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16)

    records = list(iter_text_files(str(tmp_path)))

    paths = {r["path"] for r in records}
    assert "SKILL.md" in paths
    assert "agents/openai.yaml" in paths
    assert "logo.png" not in paths

    md = next(r for r in records if r["path"] == "SKILL.md")
    assert md["language"] == "markdown"
    assert md["sha256"]


def test_build_file_tree_from_paths_nests_directories():
    records = [
        SimpleNamespace(path="SKILL.md", size=10),
        SimpleNamespace(path="agents/openai.yaml", size=20),
    ]
    tree = build_file_tree_from_paths(records)
    assert tree[0]["type"] == "file"
    assert tree[1]["type"] == "directory"
    assert tree[1]["children"][0]["path"] == "agents/openai.yaml"


def test_build_skill_files_zip_bytes_roundtrip():
    records = [
        SimpleNamespace(path="SKILL.md", content="# Hello"),
        SimpleNamespace(path="agents/openai.yaml", content="model: gpt-4o"),
    ]
    data = build_skill_files_zip_bytes("demo", records)
    assert data is not None

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        names = zf.namelist()
        assert "demo/SKILL.md" in names
        assert "demo/agents/openai.yaml" in names
        assert zf.read("demo/SKILL.md").decode() == "# Hello"
