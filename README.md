# NAV Dental Clinic website

Website and appointment system for NAV Dental Clinic (Dr. Ratan Raghav), Pahasu, Uttar Pradesh.
Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · MongoDB (from Phase 3).

## Getting started

```bash
npm install
npm run dev
```

Without `MONGODB_URI`, `npm run dev`, `npm run build` and `npm run start` automatically start a **temporary in-memory MongoDB** (port 27027), create indexes and seed the clinic data. It also creates a development owner account for `/admin` and prints its password (or uses `DEV_ADMIN_EMAIL`/`DEV_ADMIN_PASSWORD`). To use MongoDB Atlas, copy `.env.example` to `.env.local`, set `MONGODB_URI`, `BETTER_AUTH_SECRET` and `RATE_LIMIT_SALT`, run `npm run db:init` once, then create the first owner with `npm run admin:create -- --email you@example.com --name "Your Name"`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run test` | Unit and integration tests (Vitest) |
| `npm run db:init` | Create collections/indexes and seed settings + services (idempotent; needs `MONGODB_URI`) |
| `npm run admin:create -- --email … --name "…" [--role owner/staff]` | Create an admin account (password typed hidden, or generated and shown once) |
| `npm run db:check` | Read-only health check of the configured database (collections, indexes, seed data, transactions, admin accounts) |
| `npm run dev:memory` | Development server on the throwaway in-memory database, even if `.env.local` points at Atlas |
| `npm run build:test` | Production build on the in-memory database (used by E2E tests and CI) |
| `npm run db:purge [-- --apply]` | Show (or delete) records older than the clinic's retention periods |
| `npm run test:e2e` | End-to-end tests (Playwright) against a test build (run `npm run build:test` first); never touches a real database |

## Documentation

Project documentation lives in [`docs/`](docs). Start with [`IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md). Clinic staff: see [`ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md).
