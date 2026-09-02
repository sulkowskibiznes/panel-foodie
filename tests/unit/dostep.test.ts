import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { assertClientAccess } from "@/lib/dostep";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("assertClientAccess", () => {
  it("przepuszcza własny zasób", () => {
    expect(() => assertClientAccess(A, A)).not.toThrow();
  });
  it("cudzy zasób → 404", () => {
    expect(() => assertClientAccess(A, B)).toThrow("NEXT_NOT_FOUND");
  });
  it("brak właściciela zasobu → 404", () => {
    expect(() => assertClientAccess(A, null)).toThrow("NEXT_NOT_FOUND");
    expect(() => assertClientAccess(A, undefined)).toThrow("NEXT_NOT_FOUND");
  });
  it("brak sesji → 404", () => {
    expect(() => assertClientAccess(null, A)).toThrow("NEXT_NOT_FOUND");
    expect(() => assertClientAccess("", A)).toThrow("NEXT_NOT_FOUND");
  });
});
