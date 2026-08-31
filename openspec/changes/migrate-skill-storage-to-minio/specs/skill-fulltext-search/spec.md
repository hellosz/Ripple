## ADDED Requirements

### Requirement: Search matches skill body content
The system SHALL make the skill search query match skill name, display name, description, and SKILL.md body content using a pg_trgm-backed index.

#### Scenario: Search matches body keyword
- **WHEN** a user searches for a term that appears only in a skill SKILL.md body
- **THEN** the system returns that skill in the search results

#### Scenario: Search still matches metadata
- **WHEN** a user searches for a term in the skill name or description
- **THEN** the system returns matching skills as before

#### Scenario: Empty query returns all active skills
- **WHEN** the search query is empty
- **THEN** the system returns active skills without applying a body search filter

### Requirement: Search index is maintained on upload
The system SHALL update the searchable index whenever skill text files are stored or replaced so newly uploaded content is immediately searchable.

#### Scenario: Newly uploaded skill is searchable
- **WHEN** a skill with body content is uploaded
- **THEN** that body content is searchable without a manual reindex step

#### Scenario: Updated skill body refreshes search
- **WHEN** an existing skill is updated with new body content
- **THEN** search results reflect the new body content for that skill
