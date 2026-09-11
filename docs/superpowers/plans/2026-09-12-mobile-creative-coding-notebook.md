# Mobile Creative Coding Notebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an offline-capable iPhone-first PWA that collects, runs, captures, stores, exports, and searches GLSL, p5.js, and three.js experiments.

**Architecture:** React owns the interface while framework-free domain modules own records, detection, persistence, runner messages, and sync contracts. Dexie stores local data, a sandboxed iframe executes untrusted snippets, and Supabase is isolated behind an optional adapter.

**Tech Stack:** React, TypeScript, Vite, CodeMirror 6, Dexie, JSZip, p5.js, three.js, Supabase JS, Vitest, Testing Library, Playwright, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-09-12-mobile-creative-coding-notebook-design.md`

## Global Constraints

- Target iOS 26+ iPhone and retain responsive iPad/desktop behavior.
- Preserve collected source byte-for-byte and never execute with app credentials.
- Bundle runtime dependencies and block runner network access.
- Complete the local MVP without requiring a Supabase account.
- Use tests first for every behavior-bearing module.

---

### Task 1: Foundation and domain behavior

**Files:** `package.json`, configuration files, `src/domain/*`, `src/domain/*.test.ts`

**Interfaces:** Produces record types, `detectProfiles(code)`, `createProject(input)`, `createRevision(project, reason)`, and search normalization.

- [ ] Write tests that expect immutable originals, deterministic profile ranking, searchable text, and revision lineage.
- [ ] Run focused tests and confirm failure because the domain modules do not exist.
- [ ] Add the minimum TypeScript implementations and run the tests to green.
- [ ] Refactor shared ID/date/hash dependencies behind injectable helpers and run the full suite.

### Task 2: IndexedDB repository and portable archives

**Files:** `src/storage/*`, `src/storage/*.test.ts`

**Interfaces:** Consumes domain records. Produces `DexieProjectRepository`, `exportProjectArchive(id)`, and `importProjectArchive(file)`.

- [ ] Write fake-indexeddb tests for CRUD, original immutability, search, soft delete, revision recovery, and archive round trips.
- [ ] Verify the tests fail for missing persistence behavior.
- [ ] Implement the Dexie schema and JSZip manifest format, then make focused tests pass.
- [ ] Run the complete suite before continuing.

### Task 3: Runtime profiles and sandbox protocol

**Files:** `src/runtime/*`, `public/runner.html`, `src/runtime/*.test.ts`

**Interfaces:** Produces typed runner commands/events, nonce validation, wrapper builders, GLSL compilation, and canvas capture.

- [ ] Write tests for GLSL entry-point adaptation, error-line normalization, nonce/run rejection, and profile runner configuration.
- [ ] Confirm red, implement the pure builders and validator, and confirm green.
- [ ] Implement the opaque-origin runner with bundled p5 and three globals, restrictive CSP, heartbeats, errors, and PNG capture.
- [ ] Add host lifecycle tests proving stop/reset replaces the runner and stale events are ignored.

### Task 4: Touch-first application UI

**Files:** `src/components/*`, `src/App.tsx`, `src/styles.css`, component tests.

**Interfaces:** Consumes repository and runner controller. Produces inbox, editor/preview, library, settings, metadata, diagnostics, and capture flows.

- [ ] Write component tests for creating a project, switching profiles, flushing before run, search, favorite, duplicate, restore, and persistence status.
- [ ] Verify red, implement the smallest accessible flows, and verify green.
- [ ] Add CodeMirror, keyboard symbol row, responsive tabs, capture thumbnails, error panels, and the field-notebook visual system.
- [ ] Re-run component and domain tests.

### Task 5: PWA and offline behavior

**Files:** `vite.config.ts`, `public/*`, `src/pwa/*`, Playwright tests.

**Interfaces:** Produces installable manifest, service worker precache, update notification, and storage persistence reporting.

- [ ] Add end-to-end tests for the initial loop and cached reload behavior.
- [ ] Configure the PWA manifest, runtime bundle precache, and persistence request.
- [ ] Build and exercise the production preview in Chromium and WebKit.

### Task 6: Optional Supabase sync adapter

**Files:** `src/sync/*`, `supabase/migrations/*`, `supabase/tests/*`, unit tests.

**Interfaces:** Implements `SyncAdapter` using magic-link auth, mutation IDs, optimistic revision checks, conflict branches, and separate media queues.

- [ ] Write adapter tests for disabled configuration, upload separation, conflict preservation, and retryable queue errors.
- [ ] Implement browser-safe configuration and the adapter without service keys.
- [ ] Add schema, RLS policies, optimistic-update RPC, and SQL policy tests.

### Task 7: Verification and handoff

**Files:** `README.md`, `docs/ios-device-validation.md`, test fixtures.

**Interfaces:** Documents setup, architecture, archive format, Supabase enablement, iOS hard-reset gate, and deferred WebGPU/native work.

- [ ] Run formatting checks, TypeScript, unit/component tests, production build, and Playwright.
- [ ] Inspect the application at iPhone dimensions and correct visible regressions.
- [ ] Record the actual automated evidence and clearly mark real-device iOS checks as pending when no device is attached.
