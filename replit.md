# Social Watch

Private, serverless social moderation PWA, targeting GitHub Pages. Replit is development only.

## Standing product constraints

- No backend, server database, analytics, telemetry or third-party CDN dependencies.
- Vite, TypeScript, Preact and plain CSS. Bundle runtime dependencies and use local assets.
- User supplies their own Meta App ID in Settings; never put an app secret in this client.
- LinkedIn and TikTok are launch links only. No native iOS/Android binaries.
- All persisted user data must remain encrypted in IndexedDB. OAuth nonce/timestamp are temporary security state, not tokens.
- Profile files transfer settings only; no tokens or account content. Each device connects separately.
- Deploy static output to GitHub Pages, not a Replit server. Never add author-specific contacts or credentials.
- The user explicitly chose to keep it fully static when offered a notification backend. Only best-effort inactive-tab refresh and local notifications are permitted, never promise push after suspension/closure.
- Background refresh is opt-in and must stop at auto-lock; per-account notification choices stay device-local and are never enabled by profile import.

## Run

- Managed workflow: `artifacts/social-watch: web`.
- `pnpm --filter @workspace/social-watch typecheck`
- `pnpm --filter @workspace/social-watch test`
- `pnpm --filter @workspace/social-watch build`
- Production files: `artifacts/social-watch/dist/public`.

The API server and mockup sandbox are unused starter services. Do not provision a database or add API routes for Social Watch.

See `artifacts/social-watch/README.md` for deployment, Meta setup, cryptography and known limitations.
