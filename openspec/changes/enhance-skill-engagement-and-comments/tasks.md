## 1. Upload and engagement contract

- [ ] 1.1 Audit the current upload flow and document how category, recommendation, ZIP, and origin type are currently validated and persisted.
- [ ] 1.2 Extend the backend skill upload schema and persistence so required upload metadata is normalized onto skill and version records.
- [ ] 1.3 Update detail/read APIs so copy command rendering and download behavior consume the persisted upload metadata contract.
- [ ] 1.4 Add or update migrations/backfill logic for existing skills that do not yet have normalized upload metadata.

## 2. Engagement state and Ripple eligibility

- [ ] 2.1 Define persisted interaction state for copy, like, download, and Ripple availability.
- [ ] 2.2 Update backend action endpoints so Ripple availability is computed from stored engagement state rather than frontend-only conditions.
- [ ] 2.3 Implement Ripple recipient selection that excludes users who already liked the skill and tracks eligible guest exposure.
- [ ] 2.4 Add tests covering copy/like preconditions, recipient filtering, and guest-to-login Ripple eligibility.

## 3. Ripple delivery and presentation

- [ ] 3.1 Add backend delivery records or queue handling for pending, shown, and consumed Ripple events.
- [ ] 3.2 Implement frontend Ripple trigger behavior and wire it to the new delivery state.
- [ ] 3.3 Build the animated Ripple reveal flow with centered wave motion, gift-like icon emergence, and modal presentation.
- [ ] 3.4 Include the triggering user nickname in the Ripple modal header and validate the end-to-end presentation flow.

## 4. Threaded comments on skill detail

- [ ] 4.1 Add database schema and backend models for recursive skill comments using parent-child relationships.
- [ ] 4.2 Implement comment create/read APIs that return hierarchical threads for unlimited reply depth.
- [ ] 4.3 Build the skill detail comments UI with nested replies and relative-time display.
- [ ] 4.4 Add tests for top-level comments, deep replies, and relative-time rendering inputs.
