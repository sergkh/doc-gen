import { describe, expect, it } from "bun:test";
import {
  ATTESTATION_COLORS,
  getAttestationColor,
} from "@/client/courses";

describe("attestation colors", () => {
  it("provides eight distinct colors", () => {
    expect(ATTESTATION_COLORS).toHaveLength(8);
    expect(new Set(ATTESTATION_COLORS).size).toBe(8);
  });

  it("maps one-based attestation indexes to the shared palette", () => {
    expect(getAttestationColor(1)).toBe(ATTESTATION_COLORS[0]);
    expect(getAttestationColor(4)).toBe(ATTESTATION_COLORS[3]);
    expect(getAttestationColor(8)).toBe(ATTESTATION_COLORS[7]);
  });

  it("falls back safely and cycles indexes beyond the palette", () => {
    expect(getAttestationColor(0)).toBe(ATTESTATION_COLORS[0]);
    expect(getAttestationColor(Number.NaN)).toBe(ATTESTATION_COLORS[0]);
    expect(getAttestationColor(9)).toBe(ATTESTATION_COLORS[0]);
  });
});
