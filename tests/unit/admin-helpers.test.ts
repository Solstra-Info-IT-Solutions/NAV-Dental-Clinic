import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "@/lib/csv";

// guards.ts is server-only; the vitest alias makes it importable for this pure helper.
import { hasRole } from "@/lib/auth/guards";

describe("CSV export safety", () => {
  it("neutralises spreadsheet formulas and quotes every cell", () => {
    for (const dangerous of ["=1+1", "+cmd", "-2", "@SUM(A1)", "\tx", "\rx"]) expect(csvCell(dangerous).startsWith(`"'`)).toBe(true);
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell(null)).toBe('""');
    expect(toCsv(["A", "B"], [["1", "2"]])).toBe('"A","B"\r\n"1","2"\r\n');
  });
});

describe("role hierarchy", () => {
  const staff = { id: "1", email: "s@x", name: "S", role: "staff" as const };
  const owner = { ...staff, role: "owner" as const };
  it("owners can do everything staff can, not the reverse", () => {
    expect(hasRole(owner, "staff")).toBe(true);
    expect(hasRole(owner, "owner")).toBe(true);
    expect(hasRole(staff, "staff")).toBe(true);
    expect(hasRole(staff, "owner")).toBe(false);
  });
});
