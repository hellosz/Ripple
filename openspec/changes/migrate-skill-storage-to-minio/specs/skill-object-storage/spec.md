## ADDED Requirements

### Requirement: Upload persists canonical package to object storage
The system SHALL store the uploaded skill ZIP as an immutable object in MinIO and persist its object key, filename, and SHA-256 checksum on the skill and version records so downloads are reproducible and verifiable.

#### Scenario: Successful upload writes package object
- **WHEN** an authenticated user uploads a valid skill ZIP
- **THEN** the system writes the ZIP to the MinIO skill package bucket and records the object key, filename, and checksum in the upload contract

#### Scenario: Package object is content-addressed
- **WHEN** the same package bytes are uploaded for a given skill version
- **THEN** the system derives the object key from the checksum so identical content maps to the same object

### Requirement: Text files are stored as structured records
The system SHALL extract text files from an uploaded skill and persist each file as a `skill_files` row with its relative path, content, language, size, and checksum, while skipping binary files.

#### Scenario: Upload indexes text files
- **WHEN** an uploaded skill contains SKILL.md, agent YAML, or script text files
- **THEN** each UTF-8 text file is stored as a `skill_files` record tied to the skill and version

#### Scenario: Binary files are excluded from file records
- **WHEN** an uploaded skill contains binary assets such as images
- **THEN** those files are not stored as text `skill_files` rows and remain available inside the package object

### Requirement: File browsing reads from structured records
The system SHALL serve skill file tree and file content from `skill_files` records instead of the filesystem.

#### Scenario: File tree is derived from stored files
- **WHEN** a client requests a skill file tree
- **THEN** the system returns the tree built from `skill_files` paths for the current version

#### Scenario: File content is served from records
- **WHEN** a client requests a specific file path
- **THEN** the system returns the stored content and language hint from `skill_files`

### Requirement: Download prefers stored package with fallback
The system SHALL serve downloads from the MinIO package object when present and fall back to packaging current `skill_files` when the object is missing, keeping the existing download endpoint contract.

#### Scenario: Download streams stored package
- **WHEN** a skill has a stored package object
- **THEN** the download endpoint streams that package with the persisted filename

#### Scenario: Download falls back to generated archive
- **WHEN** a skill has no stored package object
- **THEN** the system generates a ZIP from current `skill_files` records

### Requirement: Version history no longer depends on Git
The system SHALL derive skill version history from `skill_versions` records and shall not perform Git commit or push operations as part of the upload flow.

#### Scenario: Upload records version without Git
- **WHEN** a skill is uploaded or updated
- **THEN** a `skill_versions` record captures the version, changelog, and package lineage without invoking Git commit

#### Scenario: File snapshots are version-scoped
- **WHEN** a skill has multiple versions
- **THEN** each version references its own `skill_files` snapshot
