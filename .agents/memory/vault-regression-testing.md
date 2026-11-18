---
name: Vault regression testing
description: Security boundary for testing encrypted device storage and lock races.
---

Keep storage fault injection entirely in isolated browser-test contexts. Use synthetic
profiles and passphrases with native IndexedDB and WebCrypto; never add a production
unlock bypass or use real Meta credentials.

**Why:** The vault's locking and encryption are the product's security boundary.
Mock databases and application test shortcuts can hide the browser timing failures
the regression suite is intended to catch.

**How to apply:** For new persistence regressions, control browser API timing in
the test runner and assert both the visible UI result and the persisted encrypted
record. Keep installation/offline testing separate from device-vault regressions.
