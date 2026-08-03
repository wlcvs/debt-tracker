import { describe, it, expect } from "vitest";
import { generateAccessCode, ACCESS_CODE_ALPHABET, ACCESS_CODE_LENGTH } from "@/lib/access-code";

describe("generateAccessCode", () => {
  it("returns a code of exactly ACCESS_CODE_LENGTH characters", () => {
    expect(ACCESS_CODE_LENGTH).toBe(12);
    for (let i = 0; i < 100; i++) {
      expect(generateAccessCode()).toHaveLength(12);
    }
  });

  it("only uses characters from the alphabet", () => {
    for (let i = 0; i < 100; i++) {
      for (const char of generateAccessCode()) {
        expect(ACCESS_CODE_ALPHABET).toContain(char);
      }
    }
  });

  it("never emits the visually ambiguous characters", () => {
    // 0/O and 1/I/L are excluded so a code can be read aloud or typed by hand.
    const codes = Array.from({ length: 200 }, generateAccessCode).join("");
    for (const char of ["0", "O", "1", "I", "L"]) {
      expect(codes).not.toContain(char);
    }
  });

  it("does not repeat across many generations", () => {
    const codes = new Set(Array.from({ length: 10_000 }, generateAccessCode));
    expect(codes.size).toBe(10_000);
  });
});
