---
name: Standalone package upgrades
description: Preserve independently installable app downloads when updating workspace dependencies.
---

After pnpm updates in this workspace, check that independently downloadable app manifests still use explicit versions rather than `catalog:` references before regenerating their standalone lockfiles.

**Why:** pnpm can rewrite an explicitly versioned dependency to the workspace catalog during an update. The standalone lockfile operation then fails because the isolated app has no catalog.

**How to apply:** Keep the app's standalone overrides and workspace overrides aligned, restore explicit app dependency versions when needed, and check both dependency lockfiles rather than only the workspace audit.
