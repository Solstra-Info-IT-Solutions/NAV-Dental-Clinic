# NAV Dental Clinic website

Website and appointment system for NAV Dental Clinic (Dr. Ratan Raghav), Pahasu, Uttar Pradesh.
Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · MongoDB (from Phase 3).

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run test` | Unit and integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) against a production build (run `npm run build` first) |

## Documentation

Project documentation lives in [`docs/`](docs). Start with [`IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).
