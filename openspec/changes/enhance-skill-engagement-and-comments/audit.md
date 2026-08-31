## Upload Flow Audit

### Before This Change

- `POST /api/skills` and `PUT /api/skills/{slug}` already required form fields for `category`, `recommendation`, `origin_type`, and a ZIP upload.
- ZIP validation only guaranteed the archive shape (`SKILL.md`, frontmatter with `name` and `description`) via `validate_skill_zip`.
- `category`, `recommendation`, and `origin_type` were persisted on `skills`, but the derived `skill_versions` rows did not keep a normalized copy of those upload fields.
- The uploaded ZIP itself was not stored as a canonical package lineage record. Downloads were regenerated from the checked-out repository tree on demand.
- Install command rendering came from `build_install_command(skill.name)` and therefore depended on recomputing a command at read time instead of consuming a persisted upload contract.

### Gaps Identified

- No version-level contract existed for category, recommendation, origin type, install command, or uploaded ZIP lineage.
- Download behavior could drift from the original upload because it rebuilt ZIPs from the repo instead of the uploaded package when available.
- Ripple and copy flows only used boolean interaction checks and did not expose stable persisted timestamps/state in the read contract.

### Implemented Contract

- Upload metadata is now normalized onto both `skills` and `skill_versions`.
- Upload stores a canonical ZIP artifact checksum and storage path for the current version lineage.
- Detail/list reads now expose `upload_metadata` and `engagement_state`.
- Download prefers the persisted uploaded package and falls back to repository ZIP generation only for older rows without stored lineage.
