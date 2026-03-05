# Changelog

All notable changes to this project are documented in this file.

## [0.2.0] - 2026-03-05

Release `0.2.0` includes all updates made since `0.1.0`.

### Added
- Workspace system with support for multiple independent player groups per user.
- Workspace publishing with permanent public slug URLs and live updates.
- Advanced analytics dashboard with filters, trends, head-to-head, and position strategy insights.
- Mobile speed mode improvements including quick swap and multi-step undo/redo.
- Comprehensive automated test coverage for Elo logic, game engine, store behavior, and analytics.
- App version footer, GitHub release workflow, and PR preview deployments.

### Changed
- Elo math refined to preserve zero-sum behavior using pool/milli-elo handling and survivor distribution updates.
- No-killer and self-kill handling expanded and corrected across all court positions.
- Settings and workspace controls unified with app workspace state.
- Analysis UX, trend displays, and history naming improved.
- README expanded with architecture, setup, and operational guidance.

### Fixed
- Settings page render loop crash.
- Workspace switcher default workspace fallback.
- Killer-mode `#1` server self-kill edge cases.
- Analytics kill attribution in no-killer mode.
- Turn input validation and replacement-name handling.
- React hooks lint-related state update issues.

### CI/CD
- Added GitHub Pages deployment workflow and Vite base configuration for pages hosting.
- Added PR preview deployment workflow with auto-commented URL.

