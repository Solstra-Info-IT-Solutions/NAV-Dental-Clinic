# Project Audit — NAV Dental Clinic Website

**Date:** 2026-10-22
**Phase:** 0 (Discovery)
**Auditor:** Claude Code (engineering agent)

## 1. Repository state

| Item | Finding |
|---|---|
| Project folder | `D:\NAV Dental Clinic` |
| Contents at audit time | **Empty.** No `package.json`, source files, routes, env files or assets. |
| Classification | **New project** (greenfield). Nothing to preserve or migrate. |
| Git | The folder has **no repository of its own**. Git resolves it to a repository rooted at **`D:\` (the whole drive)**, whose last commits (`107bd71 Initial Push`, PR merges from another author) belong to unrelated projects (e.g. *Aayesha Fashion*). The drive-level `.gitignore` contains rules for those projects. |
| Risk | Committing from this folder would add clinic code to the unrelated drive-level repository, and a stray `git add -A` from `D:\` could pick up keystores (`*.jks`), `.env` files and other projects. |
| Recommendation | Run `git init` **inside `D:\NAV Dental Clinic`** so the clinic site gets its own isolated repository and its own GitHub remote. |
| Resolution | **Done in Phase 1 (2026-10-22)** with owner approval: `git init -b main`; the repository root is now `D:/NAV Dental Clinic`. |

## 2. Toolchain available on this machine

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24.15.0 | Meets Next.js 16 requirement (`>= 20.9.0`). |
| npm | 11.12.1 | Package manager of record (no lockfile yet). |
| Python | 3.14 (with Pillow) | Used only for logo colour analysis; not a project dependency. |
| OS | Windows 10 (Git Bash + PowerShell) | Scripts must be cross-platform (no bash-only npm scripts). |

## 3. Current stable package versions (checked with `npm view` on 2026-10-22)

| Package | Latest stable | Role |
|---|---|---|
| next | 16.4.2 | Framework (App Router) |
| react / react-dom | 19.3.1 | UI |
| tailwindcss | 4.3.3 | Styling (CSS-first `@theme` tokens) |
| mongoose | 9.11.3 | MongoDB ODM |
| better-auth | 1.7.12 | Admin authentication (see ARCHITECTURE.md §5 for the decision) |
| zod | 4.6.7 | Shared validation (client + server) |
| react-hook-form | 7.90.0 | Form state |
| resend | 6.34.1 | Transactional email |
| lucide-react | 1.61.0 | Icons |
| vitest | 5.0.5 | Unit / integration tests |
| @testing-library/react | 16.3.3 | Component tests |
| @playwright/test | 1.64.1 | End-to-end tests |
| mongodb-memory-server | 11.3.0 | Real MongoDB for integration tests (replica set for transactions) |

Exact versions are re-verified and locked at Phase 2 setup (`package-lock.json`). Peer-compatibility (Next 16 ↔ React 19.x ↔ Playwright ≥ 1.51) was checked against `next@latest` peerDependencies.

## 4. Assets

| Asset | Status |
|---|---|
| Logo | Supplied as a **1080×1080 WebP render** (`brand-assets/logo-original.webp`). It is a 3D brushed-metal mock-up on a textured charcoal wall, **not** a production logo file. See BRAND_ANALYSIS.md §6. |
| Vector logo (SVG/AI/PDF/EPS) | **Not supplied.** Required for crisp header, favicon, social cards and email. |
| Clinic / doctor photography | **Not supplied.** |
| Credentials, qualifications, registration number | **Not supplied.** |

## 5. Environment configuration

None exists. `.env.example` (placeholders only) will be created in Phase 2. No secrets were found or created.

## 6. Conclusion

Greenfield build. No existing functionality to preserve. The only structural action needed before code is isolating the project in its own git repository.
