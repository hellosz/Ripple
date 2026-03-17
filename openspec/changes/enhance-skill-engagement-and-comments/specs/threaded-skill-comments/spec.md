## ADDED Requirements

### Requirement: Skill detail page supports nested comments
The system SHALL allow users to create comments on a skill and reply to existing comments with unlimited nesting depth.

#### Scenario: User posts a top-level comment
- **WHEN** an authenticated user submits a comment on a skill without a parent comment
- **THEN** the system stores it as a top-level comment for that skill

#### Scenario: User replies to an existing comment
- **WHEN** an authenticated user submits a comment with a parent comment reference
- **THEN** the system stores it as a child of that comment and preserves the reply hierarchy

### Requirement: Comment reads return hierarchical threads
The system SHALL return comment data for a skill in a structure that preserves parent-child relationships for unlimited reply depth.

#### Scenario: Threaded comments are returned in hierarchy order
- **WHEN** a client requests comments for a skill
- **THEN** the response includes nested replies under each parent comment instead of a flat list

#### Scenario: Deep reply chains remain attached to their ancestors
- **WHEN** a skill contains replies nested multiple levels deep
- **THEN** each reply is returned under its correct ancestor chain

### Requirement: Comment timestamps are rendered as relative time
The system SHALL expose stable timestamps for comments, and the frontend SHALL render them as relative time strings on the skill detail page.

#### Scenario: Recent comment shows relative time
- **WHEN** the frontend renders a recently created comment
- **THEN** the timestamp is displayed as a relative phrase such as minutes or hours ago

#### Scenario: Older comment still uses server timestamp source
- **WHEN** the frontend renders an older comment after a page refresh
- **THEN** the relative time is computed from the server-provided timestamp rather than a client-generated value
