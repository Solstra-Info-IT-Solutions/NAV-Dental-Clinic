# NAV Dental Clinic website

Website and appointment system for NAV Dental Clinic (Dr. Ratan Raghav), Pahasu, Uttar Pradesh.
Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · MongoDB (from Phase 3).

## Getting started

```bash
npm install
npm run dev
```

Without `MONGODB_URI`, `npm run dev`, `npm run build` and `npm run start` automatically start a **temporary in-memory MongoDB** (port 27027), create indexes and seed the clinic data. To use MongoDB Atlas, copy `.env.example` to `.env.local` and set `MONGODB_URI`, then run `npm run db:init` once.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run test` | Unit and integration tests (Vitest) |
| `npm run db:init` | Create collections/indexes and seed settings + services (idempotent; needs `MONGODB_URI`) |
| `npm run test:e2e` | End-to-end tests (Playwright) against a production build (run `npm run build` first) |

## Documentation

Project documentation lives in [`docs/`](docs). Start with [`IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).
