import { signupSchema } from "@/lib/schemas/auth.schema";
import { describe, expect, it } from "vitest";

const valid = {
  name: "Ann",
  email: "ann@example.com",
  password: "Passw0rd!",
  confirmPassword: "Passw0rd!",
};

/** กฎรหัสผ่านต้องตรงกับ @StrongPassword() ฝั่ง API ไม่งั้นฟอร์มผ่านแต่ API ตอบ 400 */
describe("signupSchema", () => {
  it("accepts a valid signup", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["too short", "Pa0!"],
    ["no uppercase", "passw0rd!"],
    ["no lowercase", "PASSW0RD!"],
    ["no number", "Password!"],
    ["no symbol", "Passw0rdx"],
    ["contains a space", "Passw0rd !"],
    ["over 72 characters (bcrypt limit)", `Aa1!${"x".repeat(69)}`],
  ])("rejects a password that is %s", (_case, password) => {
    expect(
      signupSchema.safeParse({ ...valid, password, confirmPassword: password })
        .success,
    ).toBe(false);
  });

  it("reports mismatched confirmation on the confirm field", () => {
    const result = signupSchema.safeParse({
      ...valid,
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["confirmPassword"]);
  });
});
