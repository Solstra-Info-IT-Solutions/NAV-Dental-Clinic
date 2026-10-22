/**
 * Test-only credentials for the owner account that scripts/with-db.ts creates
 * in the throwaway in-memory database during E2E runs. Never valid anywhere else.
 */
export const E2E_OWNER = { email: "e2e-owner@nav-dental.test", password: "e2e-only-owner-password-0001" } as const;
