---
name: shadcn Separator not installed
description: The Separator shadcn component is absent; use a plain div instead.
---

`artifacts/vitalguide/src/components/ui/separator.tsx` does not exist.

Importing `Separator` from `@/components/ui/separator` causes a runtime "Separator is not defined" error.

**Why:** shadcn components are installed on demand; Separator was never added to this project.

**How to apply:** Use `<div className="border-t border-slate-100" />` (or similar) as a divider. If Separator is truly needed, install with `pnpm dlx shadcn@latest add separator` inside `artifacts/vitalguide/`.
