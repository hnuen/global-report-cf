import assert from "node:assert/strict";
import test from "node:test";

import { classifyOfacProgramStatus, reconcileRemovedOfacPrograms } from "../.github/scripts/ofac-program-status.mjs";
import { syncProgramStatus } from "../.github/scripts/sync-programs-library.mjs";
import { SANCTIONS_PROGRAMS, getAllActiveGeneralLicenses } from "../src/lib/sanctions-programs-library.ts";

test("OFAC inactive/archive wording deactivates a program", () => {
  assert.deepEqual(
    classifyOfacProgramStatus("Ethiopia-Related Sanctions - Inactive and Archived"),
    { status: "inactive", statusLabel: "Inactive and Archived" },
  );
});

test("PAARSS remains a residual program rather than becoming inactive", () => {
  assert.deepEqual(
    classifyOfacProgramStatus("Promoting Accountability for Assad and Regional Stabilization Sanctions (PAARSS)"),
    { status: "residual", statusLabel: "Residual" },
  );
});

test("a program removed from a complete active index is retained but deactivated", () => {
  const programs: Record<string, any> = {
    ethiopia: { name: "Ethiopia-Related Sanctions", url: "https://ofac.treasury.gov/example", executiveOrders: [{ number: "14046" }] },
    iran: { name: "Iran Sanctions", url: "https://ofac.treasury.gov/iran" },
  };
  const index = Array.from({ length: 20 }, (_, indexNumber) => ({ slug: indexNumber === 0 ? "iran" : `active-${indexNumber}` }));
  assert.deepEqual(reconcileRemovedOfacPrograms(programs, index, "October 11, 2026"), ["ethiopia"]);
  assert.equal(programs.ethiopia.status, "inactive");
  assert.equal(programs.ethiopia.executiveOrders.length, 1, "history is retained");
  assert.equal(programs.iran.status, undefined);
});

test("a partial OFAC index cannot mass-deactivate cached programs", () => {
  const programs: Record<string, any> = { ethiopia: { name: "Ethiopia", url: "https://ofac.treasury.gov/example" } };
  assert.deepEqual(reconcileRemovedOfacPrograms(programs, [{ slug: "iran" }], "October 11, 2026"), []);
  assert.equal(programs.ethiopia.status, undefined);
});

test("library sync persists inactive status and its provenance", () => {
  const block = `{ id: "example", status: "active", executiveOrders: [] }`;
  const result = syncProgramStatus(block, {
    status: "inactive",
    inactiveDate: "October 11, 2026",
    statusReason: "Removed from the active index",
    statusSourceUrl: "https://ofac.treasury.gov/sanctions-programs-and-country-information",
  });
  assert.equal(result.changed, true);
  assert.match(result.text, /status: "inactive"/);
  assert.match(result.text, /inactiveDate: "October 11, 2026"/);
  assert.match(result.text, /statusSourceUrl:/);
});

test("Ethiopia has no active authorities after OFAC archived the program", () => {
  const ethiopia = SANCTIONS_PROGRAMS.find((program) => program.id === "ethiopia");
  assert.ok(ethiopia);
  assert.equal(ethiopia.status, "inactive");
  assert.equal(ethiopia.executiveOrders.length, 0);
  assert.ok(ethiopia.archive?.executiveOrders?.some((eo) => eo.number === "14046"));
  assert.equal(getAllActiveGeneralLicenses().some((gl) => gl.programId === "ethiopia"), false);
});

test("the current Syria residual PAARSS program stays enabled", () => {
  const paarss = SANCTIONS_PROGRAMS.find((program) => program.id === "paarss");
  assert.ok(paarss);
  assert.equal(paarss.status, "residual");
  assert.ok(paarss.executiveOrders.length > 0);
});

