---
name: Replit artifact workflow conflict
description: Two workflows fight over port 8080 — only the artifact-managed one should run.
---

The Replit artifact system auto-creates `artifacts/api-server: API Server` which builds and starts the Express backend on port 8080.

The custom `Backend API` workflow (also configured to run on port 8080) conflicts with it and always fails with `EADDRINUSE`.

**Why:** Replit's artifact system manages its own workflow for each artifact. The custom workflow is redundant.

**How to apply:** Always restart `artifacts/api-server: API Server` (NOT `Backend API`) when backend changes need to be picked up. Never try to fix the `Backend API` failure — it is expected.
