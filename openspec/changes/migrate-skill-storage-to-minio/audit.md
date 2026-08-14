## Storage Migration Audit

### Before This Change

- Uploaded skill ZIP was written to local filesystem at `backend/storage/skill_packages/<name>/<version>/<checksum>.zip` via `store_uploaded_skill_package`.
- `package_storage_path` pointed to a filesystem-relative path under `backend/storage`, and the directory was not covered by `.gitignore`.
- Skill source trees lived in `skills/<category>/<name>/` and were committed to Git via `copy_skill_to_repo` + `git_commit_skill`.
- File tree, file content, and SKILL.md preview were read from the filesystem (`get_file_tree`, `get_file_content`).
- Downloads regenerated ZIPs from the repository tree (`create_skill_zip`), except when the uploaded package existed on disk.
- Search matched only `name`, `display_name`, and `description`; SKILL.md body was not searchable.

### Gaps Identified

- Binary ZIP artifacts could enter the Git repository and were not shareable across instances.
- File content and metadata lived in separate systems, so body content could not be indexed for search.
- Backup scope was split across database, filesystem, and Git history.
- Version history depended on Git commit side effects, coupling uploads to filesystem availability.

### Implemented Contract

- Skill ZIP packages are stored as objects in MinIO with content-addressed keys; `package_storage_path` is the object key and `package_checksum` is SHA-256.
- Text files are persisted as `skill_files` rows, becoming the source of truth for file tree and content reads.
- Downloads stream the MinIO object and fall back to packaging `skill_files` when the object is missing.
- Version history is derived from `skill_versions`; upload no longer performs Git commit or push.
- Search matches body content via pg_trgm + GIN index.
