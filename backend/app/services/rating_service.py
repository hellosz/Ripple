import re
from typing import List, Tuple
from app.models.skill import RatingEnum


def rate_skill(content: str, frontmatter: dict, has_agents_dir: bool) -> Tuple[RatingEnum, List[str]]:
    """
    Rate a skill based on its content and structure.
    Returns (rating, suggestions).
    """
    suggestions = []
    description = frontmatter.get("description", "")

    # Count second-level headings
    h2_headings = re.findall(r"^## .+", content, re.MULTILINE)
    h2_count = len(h2_headings)
    h2_titles = [h.replace("## ", "").strip() for h in h2_headings]

    has_workflow = any(
        "workflow" in t.lower() or "architecture" in t.lower()
        for t in h2_titles
    )
    has_decision_rules = any("decision" in t.lower() or "rule" in t.lower() for t in h2_titles)
    has_quality_bar = any("quality" in t.lower() for t in h2_titles)
    has_output_template = bool(re.search(r"```[\s\S]*?```", content))

    # Check for S rating (夯)
    if (
        has_workflow
        and has_agents_dir
        and has_decision_rules
        and len(description) >= 50
        and has_output_template
    ):
        return RatingEnum.S, []

    # Build suggestions for non-S ratings
    if not has_workflow:
        suggestions.append("Add a '## Workflow' section describing the step-by-step process")
    if not has_agents_dir:
        suggestions.append("Add an 'agents/' directory with agent configuration files")
    if not has_decision_rules:
        suggestions.append("Add a '## Decision Rules' section")
    if len(description) < 50:
        suggestions.append(f"Expand the description (currently {len(description)} chars, need ≥50)")
    if not has_output_template:
        suggestions.append("Include structured output templates (code blocks)")
    if not has_quality_bar:
        suggestions.append("Add a '## Quality Bar' section with quality standards")

    # Check for A rating (稳)
    if has_workflow and len(description) >= 30 and h2_count >= 3:
        return RatingEnum.A, suggestions

    if not has_workflow:
        pass  # already suggested
    if len(description) < 30:
        suggestions.append(f"Expand the description to at least 30 characters (currently {len(description)})")
    if h2_count < 3:
        suggestions.append(f"Add more sections (currently {h2_count} h2 headings, need ≥3)")

    # Check for B rating (行)
    if h2_count >= 2 and len(description) >= 20:
        return RatingEnum.B, suggestions

    if h2_count < 2:
        suggestions.append(f"Add more sections (currently {h2_count} h2 headings, need ≥2)")
    if len(description) < 20:
        suggestions.append(f"Add a longer description (currently {len(description)} chars, need ≥20)")

    # Default: C rating (拉)
    return RatingEnum.C, suggestions


def get_rating_label(rating: RatingEnum) -> str:
    labels = {
        RatingEnum.S: "夯 🟢",
        RatingEnum.A: "稳 🔵",
        RatingEnum.B: "行 🟡",
        RatingEnum.C: "拉 🔴",
    }
    return labels.get(rating, "拉 🔴")
