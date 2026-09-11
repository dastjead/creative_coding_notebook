# Mobile Creative Coding Notebook Design

## Product contract

Build a private, iPhone-first PWA for collecting short creative-code snippets, running them safely, preserving the untouched source, and rediscovering experiments through captures and metadata. The first usable release targets iOS 26+ and supports GLSL/Shadertoy fragments, p5.js global-mode WebGL sketches, and three.js WebGL snippets.

The primary loop is: collect code and an optional source URL, confirm the detected profile, edit a working copy, run it, capture a PNG, save it locally, and find it later. The local release works offline. Supabase sync is an optional second-stage adapter rather than a prerequisite for local editing.

## Architecture

The application is a React/TypeScript/Vite PWA. Domain types, profile detection, persistence, sandbox messaging, and sync contracts do not depend on React. IndexedDB is accessed through Dexie. CodeMirror 6 provides mobile editing.

Untrusted code runs in a fresh iframe with `sandbox="allow-scripts"`. The iframe has an opaque origin, a restrictive CSP, and no access to app state, IndexedDB, authentication, or arbitrary network requests. Messages include a per-run nonce and run ID. Stop and reset replace the iframe rather than trusting user code to cooperate.

The visual direction is an editorial field notebook crossed with a graphics laboratory: warm paper, ink-black panels, vermilion controls, electric chartreuse status marks, monospaced technical labels, and image-contact-sheet browsing. Motion is restrained and functional. The interface remains touch-first and accessible.

## Data and runtime contracts

- `ProjectRecord` owns title, notes, tags, favorite state, profile choice, current draft, revision pointers, and lifecycle timestamps.
- `OriginalSource` is immutable and stores exact collected code, provenance metadata, and a content hash.
- `Revision` stores executable code, parent revision, runtime and wrapper versions, creation reason, and run result.
- `CaptureRecord` stores a PNG Blob and the revision and render settings that produced it.
- `AssetRecord` stores user-imported files. MVP runners receive only explicit local assets.
- `RuntimeProfile` detects a snippet, validates browser capability, and supplies runner configuration and error mapping.
- `ProjectRepository` is the local persistence boundary. `SyncAdapter` is a no-op by default and a Supabase implementation when configured.

GLSL accepts `main()` or Shadertoy `mainImage()` and supplies `iResolution`, `iTime`, `iFrame`, and `iMouse`. p5.js accepts one global-mode script. three.js exposes a pinned `THREE` global in an otherwise empty runner document and captures the first canvas.

## Safety, recovery, and storage

Drafts autosave after 750 ms. A run first flushes the draft, then creates a revision. A successful runner event updates the last-known-good revision. A failure never modifies the original source.

The host treats missing heartbeats as an unresponsive run and offers a hard reset. External fetches, popups, forms, top navigation, and same-origin access are blocked. Authentication material is never serialized into runner messages.

The PWA requests persistent storage and displays whether persistence was granted. Project ZIP export is a required safety path and contains a readable manifest, original source, revisions, assets, and captures. Import preserves provenance and remaps colliding IDs.

## Cloud stage

Supabase email magic-link authentication is enabled only when public environment variables are configured. PostgreSQL tables use `user_id`, explicit grants, and RLS. Asset and capture objects live in a private bucket. Mutations carry `clientMutationId` and `baseServerRevision`; a conflict creates an explicit conflict revision rather than silently overwriting either side.

## Acceptance

All three profiles have success and failure fixtures. A failed run, shader error, or hard reset must leave the draft and original source intact. Existing projects remain editable and executable offline after the app has been loaded once. Exported projects can be imported into an empty database. Local search covers title, source, code, tags, notes, profile, and source hostname.

