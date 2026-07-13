import { describe, it, expect } from "vitest";
import { mergeRecord, mergeConflict } from "./cabinetMerge";

const S = (...ids: string[]) => new Set<string>(ids);

describe("mergeRecord (3-way field merge)", () => {
  it("returns local wholesale when there is no base", () => {
    expect(mergeRecord(undefined, { id: "1", a: 2 }, { id: "1", a: 9 }))
      .toEqual({ id: "1", a: 2 });
  });

  it("keeps each side's edit when doctor and secretary change DIFFERENT fields", () => {
    const base   = { id: "1", note: "", paid: 0 };
    const local  = { id: "1", note: "angine", paid: 0 };   // doctor wrote the note
    const server = { id: "1", note: "", paid: 200 };        // secretary recorded payment
    expect(mergeRecord(base, local, server)).toEqual({ id: "1", note: "angine", paid: 200 });
  });

  it("adopts the server value for a field we did not touch", () => {
    const base   = { id: "1", status: "scheduled" };
    const local  = { id: "1", status: "scheduled" };
    const server = { id: "1", status: "arrived" };
    expect(mergeRecord(base, local, server)).toEqual({ id: "1", status: "arrived" });
  });

  it("keeps our value for a field we changed, even if the server changed it too", () => {
    const base   = { id: "1", status: "scheduled" };
    const local  = { id: "1", status: "completed" };
    const server = { id: "1", status: "arrived" };
    expect(mergeRecord(base, local, server)).toEqual({ id: "1", status: "completed" });
  });

  it("compares array/object fields by value", () => {
    const base   = { id: "1", items: [] as unknown[], red: 0 };
    const local  = { id: "1", items: [{ label: "C", qty: 1 }], red: 0 };
    const server = { id: "1", items: [] as unknown[], red: 50 };
    expect(mergeRecord(base, local, server))
      .toEqual({ id: "1", items: [{ label: "C", qty: 1 }], red: 50 });
  });
});

describe("mergeConflict", () => {
  it("keeps locally-deleted records deleted (tombstone wins)", () => {
    expect(mergeConflict([{ id: "1", a: 1 }], [], S("1"), S())).toEqual([]);
  });

  it("adopts the server copy for untouched records", () => {
    expect(mergeConflict([{ id: "1", a: 9 }], [{ id: "1", a: 1 }], S(), S()))
      .toEqual([{ id: "1", a: 9 }]);
  });

  it("keeps records created locally (absent on the server)", () => {
    const out = mergeConflict(
      [{ id: "1", a: 1 }], [{ id: "1", a: 1 }, { id: "2", a: 2 }], S(), S("2"));
    expect(out).toContainEqual({ id: "2", a: 2 });
  });

  it("field-merges a touched record against its base", () => {
    const base = new Map([["1", { id: "1", note: "", paid: 0 }]]);
    const out = mergeConflict(
      [{ id: "1", note: "", paid: 200 }],       // server: secretary set payment
      [{ id: "1", note: "angine", paid: 0 }],   // local: doctor set note
      S(), S("1"), base);
    expect(out).toEqual([{ id: "1", note: "angine", paid: 200 }]);
  });

  it("without a base, a touched record keeps local wholesale (back-compat)", () => {
    expect(mergeConflict([{ id: "1", a: 9, b: 9 }], [{ id: "1", a: 1, b: 1 }], S(), S("1")))
      .toEqual([{ id: "1", a: 1, b: 1 }]);
  });
});
