## Context

Ripple currently stores skills and basic interactions, but the core engagement journey is not defined end-to-end. Upload requires a stronger contract between submitted metadata and persisted records, while copy, download, like, and Ripple need a single source of truth for enablement. The detail page also has no discussion model, so introducing recursive comments will require new persistence, API behavior, and rendering rules.

This change cuts across backend APIs, database schema, frontend action gating, and detail-page presentation. It also introduces a richer animated Ripple delivery experience that must coordinate product rules and UI timing without breaking the existing skill browsing flow.

## Goals / Non-Goals

**Goals:**
- Define the data model and API behavior for skill upload, including required fields and how uploaded metadata powers copy/download/Ripple flows.
- Define a consistent engagement state machine for copy, like, download, and Ripple eligibility.
- Specify how Ripple recipients are selected and how the frontend presents an incoming Ripple event.
- Add a nested comment model with relative-time rendering and unlimited reply depth at the API and UI contract level.
- Create implementation-ready artifacts so the work can be delivered incrementally.

**Non-Goals:**
- Finalize the exact visual motion language, easing curve, or illustration assets for the Ripple animation.
- Build recommendation ranking or moderation workflows for comments in this change.
- Redesign the whole skill detail layout outside of the new Ripple and comments surfaces.

## Decisions

### 1. Treat upload metadata as the canonical skill interaction contract
Upload SHALL require category, recommendation text, skill package ZIP, and origin type. The backend SHALL persist these values on the skill record and derived version record so downstream actions do not need to infer metadata from the ZIP after creation.

Why: upload is the entry point for the entire skill lifecycle. If category, recommendation, and type are not normalized at write time, copy/download/Ripple behavior becomes brittle and dependent on repository parsing.

Alternative considered: derive all interaction-facing metadata dynamically from the uploaded skill files on each read. Rejected because it increases read-time coupling and makes commands/download payloads unstable.

### 2. Model engagement actions explicitly rather than inferring Ripple eligibility from UI state
The backend SHALL treat copy, like, download, and Ripple as separate interaction records or computed states. Ripple eligibility SHALL be based on persisted engagement conditions, not just whether the current frontend has shown a button.

Why: Ripple depends on preconditions across users and sessions. Explicit records support authenticated users, guests who later sign in, and future analytics.

Alternative considered: compute Ripple eligibility purely on the client after copy/like actions. Rejected because it fails across sessions and does not support guest-to-login transitions.

### 3. Introduce a Ripple delivery queue abstraction
Ripple clicks SHALL create delivery records for candidate recipients who have not liked the skill. Candidate pools SHALL include eligible logged-in users, active guests, and newly authenticated users who were exposed to the pending Ripple event.

Why: the feature needs deterministic targeting and replay behavior. A delivery queue gives us a place to track pending, shown, and consumed Ripple states.

Alternative considered: broadcast Ripple events directly over current sessions only. Rejected because it excludes offline and guest-to-login users and makes retry logic opaque.

### 4. Implement comments as an adjacency-list tree with recursive retrieval
Comments SHALL store `parent_id` nullable references to the same table. Read APIs SHALL return hierarchical trees suitable for rendering nested threads with unlimited depth.

Why: adjacency lists are simple, fit the existing PostgreSQL + SQLAlchemy stack, and are sufficient for recursive thread traversal at current scale.

Alternative considered: materialized path or nested set models. Rejected because they add mutation complexity before we know comment volume justifies it.

### 5. Keep relative time presentation on the frontend
The API SHALL return stable timestamps in ISO format. The frontend SHALL render relative time strings such as “3 minutes ago”.

Why: relative time is locale-sensitive and presentation-oriented, so it belongs in the UI layer while keeping the backend output stable.

Alternative considered: return preformatted relative strings from the backend. Rejected because it couples formatting to one locale and becomes stale in long-lived sessions.

## Risks / Trade-offs

- [Ripple candidate selection spans guests and logged-in users] → Mitigation: define explicit delivery states and exposure tracking before animation work begins.
- [Unlimited comment depth can create expensive recursive reads] → Mitigation: return bounded page sizes per root thread and design the API to recurse only on the requested skill thread.
- [Upload contract changes can break current seed/import assumptions] → Mitigation: document required fields and backfill defaults in migrations where older skills lack normalized metadata.
- [Animation-first Ripple work can block the rules engine] → Mitigation: implement delivery and eligibility logic before polishing motion details.

## Migration Plan

1. Add schema changes for normalized engagement tracking, Ripple delivery records, and recursive comments.
2. Update upload and interaction APIs to write the new records while preserving current detail-page reads.
3. Ship frontend gating for copy/like/download/Ripple based on the new API responses.
4. Add comments UI and recursive reads.
5. Enable the richer Ripple presentation after delivery logic and recipient tracking are verified.

Rollback strategy: disable new frontend affordances, stop creating new delivery/comment records, and keep existing skill reads functional while database tables remain unused.

## Open Questions

- Should “copy” be persisted when the install command is copied, when the command is executed, or both?
- What exact session/exposure mechanism should identify a guest as a valid Ripple recipient before login?
- Should Ripple target all eligible users immediately, or a capped batch per click?
- Do comments require deletion/editing in the first iteration, or is create/read sufficient for the initial release?
