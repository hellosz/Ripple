## 1. Infrastructure: MinIO sidecar

- [ ] 1.1 Add `minio` and `minio-init` services to `docker-compose.yml` with persistent volume and bucket creation.
- [ ] 1.2 Add MinIO settings to `backend/.env.example` and `backend/app/config.py` (`MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_SECURE`).
- [ ] 1.3 Add `boto3` to `backend/pyproject.toml` and refresh the lockfile.

## 2. Database migration and model

- [ ] 2.1 Add `SkillFile` model with `(skill_id, version, path, content, language, size, sha256)` fields.
- [ ] 2.2 Add migration `0004_skill_files_and_fulltext_search` creating `skill_files`, enabling `pg_trgm`, and adding GIN indexes.
- [ ] 2.3 Keep `skills.git_path` as deprecated (no new writes) and document `package_storage_path` semantics as MinIO object key.

## 3. Object storage service

- [ ] 3.1 Add `app/services/storage_service.py` wrapping boto3 put/get/delete/exists with bucket configuration.
- [ ] 3.2 Implement content-addressed object key derivation from the package checksum.

## 4. Upload and read path rework

- [ ] 4.1 Rework `store_uploaded_skill_package` to write the ZIP to MinIO and return the object key.
- [ ] 4.2 Extract text files from the uploaded ZIP into `skill_files` rows (skip binary files).
- [ ] 4.3 Update `get_skill_detail` to read SKILL.md body from `skill_files`.
- [ ] 4.4 Update file tree and file content endpoints to read from `skill_files`.
- [ ] 4.5 Remove `copy_skill_to_repo` and `git_commit_skill` calls from the upload flow.

## 5. Download path

- [ ] 5.1 Serve downloads by streaming the MinIO package object when present.
- [ ] 5.2 Fall back to packaging current `skill_files` records when the object is missing.

## 6. Full-text search

- [ ] 6.1 Extend `list_skills` search to match SKILL.md body via pg_trgm.
- [ ] 6.2 Ensure search hits are updated on upload and update (no manual reindex).

## 7. Seed and cleanup

- [ ] 7.1 Rewrite `seed_skills.py` to load `skills/` content into `skill_files` and MinIO idempotently.
- [ ] 7.2 Remove or neutralize Git write logic in `git_service.py`.
- [ ] 7.3 Add tests for upload indexing, download fallback, and full-text search matching.
