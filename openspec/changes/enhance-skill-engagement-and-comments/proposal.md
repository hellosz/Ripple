## Why

Current skill interactions are fragmented: upload lacks a well-defined data contract, engagement actions are not sequenced into a clear workflow, and Ripple has no formalized trigger or delivery behavior. The skill detail page also lacks a discussion layer, which blocks user feedback and community-driven refinement.

## What Changes

- Define a consistent upload workflow for skills, including required submission fields, storage ownership, and the mapping between uploaded metadata and downstream actions such as copy, download, like, and Ripple.
- Formalize the engagement state model for copy, like, download, and Ripple so the frontend can show the correct actions at the correct time.
- Introduce a Ripple delivery flow that targets users who have not liked the skill yet, including eligible logged-in users, guests, and users who authenticate after exposure.
- Specify the Ripple presentation experience as a distinct animated reveal that originates from the page center and surfaces the skill in a modal with the triggering user identity.
- Add a nested comment system to the skill detail page with relative-time display and support for unbounded reply depth.

## Capabilities

### New Capabilities
- `skill-engagement-workflow`: Defines skill upload requirements, persistence ownership, downstream action enablement, and Ripple trigger and delivery behavior.
- `threaded-skill-comments`: Defines nested comments, relative-time presentation, and skill detail page discussion behavior.

### Modified Capabilities
- None.

## Impact

- Backend APIs and persistence for skill upload, engagement state, Ripple targeting, and comments.
- Frontend upload form, detail page actions, Ripple animation flow, and comments UI.
- Database schema for skill metadata ownership, engagement records, Ripple delivery state, and recursive comments.
- Product logic connecting upload outputs to copy/download commands and Ripple eligibility.
