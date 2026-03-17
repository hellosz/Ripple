## ADDED Requirements

### Requirement: Upload captures canonical skill metadata
The system SHALL require category, recommendation text, skill package ZIP, and origin type when a user uploads a skill, and SHALL persist those values so downstream interactions can rely on normalized skill metadata.

#### Scenario: Successful upload with required fields
- **WHEN** an authenticated user submits a skill upload with category, recommendation text, ZIP file, and origin type
- **THEN** the system stores the skill record with those normalized fields and creates any version metadata needed for later reads

#### Scenario: Upload rejected when required fields are missing
- **WHEN** an authenticated user submits a skill upload without any required field
- **THEN** the system rejects the request and returns validation errors for the missing inputs

### Requirement: Upload metadata drives copy and download behavior
The system SHALL expose uploaded skill metadata in the detail response so install-command copy and downloadable package behavior use the same persisted source of truth.

#### Scenario: Copy command uses persisted skill metadata
- **WHEN** a client requests skill detail after a successful upload
- **THEN** the response includes the normalized metadata needed to render the install/copy command without reparsing the original ZIP

#### Scenario: Download uses the uploaded skill package lineage
- **WHEN** a user downloads a skill after it has been uploaded
- **THEN** the system serves the downloadable package that corresponds to the stored skill/version record created from the upload flow

### Requirement: Ripple is gated by engagement preconditions
The system SHALL only expose Ripple as available after the current user has copied and liked the skill, and SHALL compute that availability from persisted interaction state.

#### Scenario: Ripple remains unavailable before copy and like
- **WHEN** a user has not completed both copy and like interactions for a skill
- **THEN** the system reports Ripple as unavailable for that user and skill

#### Scenario: Ripple becomes available after copy and like
- **WHEN** a user has completed both copy and like interactions for a skill
- **THEN** the system reports Ripple as available for that user and skill

### Requirement: Ripple targets users who have not liked the skill
The system SHALL create Ripple deliveries only for recipients who have not liked the target skill, including eligible logged-in users, guests with tracked exposure, and users who log in after exposure while still eligible.

#### Scenario: Logged-in user recipients exclude prior likers
- **WHEN** a user triggers Ripple on a skill
- **THEN** the system creates delivery records only for logged-in users who have not liked that skill

#### Scenario: Guest recipients can receive Ripple after login
- **WHEN** a guest is exposed to a pending Ripple event and later logs in without having liked the skill
- **THEN** the system can resolve that pending exposure into a valid Ripple delivery for the authenticated session

### Requirement: Ripple presentation includes source attribution and animated reveal
The system SHALL present a Ripple delivery as a centered animated reveal with ripple motion, a gift-like icon emerging through the wave, and a modal showing the skill content with the triggering user nickname in the title region.

#### Scenario: Ripple delivery opens animated reveal
- **WHEN** an eligible user receives and opens a Ripple delivery
- **THEN** the page plays the configured centered ripple animation before showing the skill modal

#### Scenario: Ripple modal shows triggering user attribution
- **WHEN** the Ripple modal is displayed
- **THEN** the modal includes the original triggering user nickname alongside the revealed skill content
