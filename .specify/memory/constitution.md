<!--
## Sync Impact Report

**Version change**: 0.0.0 → 1.0.0

**Added sections**:
- Core Principles (4 principles)
- Technology Stack
- Development Workflow
- Governance

**Removed sections**: None (initial creation)

**Templates requiring updates**:
- `.specify/templates/plan-template.md` ✅ No updates required (generic placeholders work)
- `.specify/templates/spec-template.md` ✅ No updates required (generic placeholders work)
- `.specify/templates/tasks-template.md` ✅ No updates required (generic placeholders work)

**Deferred items**: None

**Bump rationale**: MAJOR version 1.0.0 - Initial constitution establishment for new project
-->

# Oekaki Map Constitution

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)

Every feature implementation MUST follow the TDD cycle:

1. Tests MUST be written before implementation code
2. Tests MUST fail before implementation begins (Red phase)
3. Implementation MUST be minimal to pass tests (Green phase)
4. Refactoring MUST only occur after tests pass (Refactor phase)

**Rationale**: Test-first ensures correctness, enables confident refactoring, and produces
maintainable code. Skipping tests leads to technical debt and regression bugs.

### II. Simplicity & YAGNI

All code MUST follow simplicity principles:

- Start with the simplest solution that works
- MUST NOT add features "for the future" - implement only what is needed now
- Premature optimization is prohibited - measure before optimizing
- Abstractions MUST only be created when there are 3+ concrete use cases
- Configuration MUST default to sensible values; optional complexity only when required

**Rationale**: Simple code is easier to understand, modify, and debug. Unused complexity
wastes development time and increases maintenance burden.

### III. Type Safety

All code MUST be strictly typed:

- TypeScript strict mode MUST be enabled
- `any` type is prohibited except when interfacing with untyped external libraries
- API boundaries (RPC endpoints) MUST have explicit type definitions
- Database schemas MUST be typed (D1 with typed queries)
- Runtime validation MUST occur at system boundaries (user input, external APIs)

**Rationale**: Strong typing catches bugs at compile time, improves IDE support, and
serves as living documentation for data structures.

### IV. Mobile-First Design

All UI/UX decisions MUST prioritize mobile experience:

- Touch interactions MUST be the primary input method
- Responsive design MUST work on screens 320px and wider
- Performance budgets MUST target 3G network speeds for initial load
- PWA capabilities SHOULD be implemented for offline drawing support
- Map interactions MUST be optimized for touch gestures (pinch, pan, draw)

**Rationale**: Users will primarily access the drawing map on mobile devices. Desktop
is a secondary consideration.

## Technology Stack

This project MUST use the following technologies:

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React + Vite | UI framework and build tooling |
| Backend | Hono | Lightweight API framework |
| API | Hono RPC | Type-safe client-server communication |
| Language | TypeScript (strict) | End-to-end type safety |
| Database | Cloudflare D1 | SQLite-compatible edge database |
| Storage | Cloudflare R2 | Object storage for drawing assets |
| Maps | To be determined | Map rendering (Google Maps, Mapbox, etc.) |

**Constraints**:
- No user accounts required - sharing via URL only
- Drawings MUST be shareable via URL without authentication
- All data MUST be stored on Cloudflare edge infrastructure

## Development Workflow

### Code Review Requirements

- All changes MUST be submitted via pull request
- PRs MUST include tests for new functionality (per Principle I)
- PRs MUST pass type checking (per Principle III)
- Self-merging is permitted for solo development

### Quality Gates

1. **Pre-commit**: TypeScript compilation MUST succeed
2. **Pre-merge**: All tests MUST pass
3. **Pre-deploy**: Build MUST complete without errors

### Branching Strategy

- `main` branch is always deployable
- Feature branches use format: `feature/[description]`
- Bug fix branches use format: `fix/[description]`

## Governance

This constitution supersedes all other development practices for this project.

### Amendment Procedure

1. Proposed changes MUST be documented with rationale
2. Changes affecting core principles require explicit justification
3. All amendments MUST be reflected in dependent templates if affected
4. Version MUST be incremented according to semantic versioning:
   - MAJOR: Principle removal or fundamental redefinition
   - MINOR: New principle or section added
   - PATCH: Clarifications and wording improvements

### Compliance Review

- All PRs MUST verify compliance with core principles
- Complexity additions MUST be justified against Principle II (Simplicity)
- Type safety violations MUST be documented if unavoidable

**Version**: 1.0.0 | **Ratified**: 2026-01-02 | **Last Amended**: 2026-01-02
