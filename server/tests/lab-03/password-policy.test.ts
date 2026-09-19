import { describe, expect, it } from "vitest";
import { validateInitialPassword } from "../../src/validateAdminUser.js";

// UNIT-01: exercise the existing validator, rather than extract/refactor production.
describe("BR-05 password-policy unit contract", () => {
  it.each([
    ["minimum", "Ab1!aaaaaa"], ["maximum", `Ab1!${"a".repeat(68)}`], ["spaces", " Ab1!aaaa "],
  ])("accepts %s without trimming", (_label, password) => {
    expect(validateInitialPassword({ initialPassword: password, confirmPassword: password }, true)).toBe(password);
  });
  it.each([
    ["below minimum", "Ab1!aaaaa"], ["above maximum", `Ab1!${"a".repeat(69)}`],
    ["no uppercase", "lowercase1!"], ["no lowercase", "UPPERCASE1!"],
    ["no digit", "NoDigitsHere!"], ["no symbol", "NoSymbols123"], ["non-string", 123],
  ])("rejects %s", (_label, password) => {
    expect(() => validateInitialPassword({ initialPassword: password }, false)).toThrow();
  });
  it("requires matching confirmation only when requested", () => {
    const initialPassword = "ValidPassword!123";
    expect(validateInitialPassword({ initialPassword }, false)).toBe(initialPassword);
    expect(() => validateInitialPassword({ initialPassword }, true)).toThrow();
    expect(() => validateInitialPassword({ initialPassword, confirmPassword: "Different!456" }, true)).toThrow();
  });
});
