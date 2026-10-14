import { passwordSchema } from "@/lib/schemas/password.schema";
import z from "zod";

/** ต้องตรงกับ RegisterDto ฝั่ง API (api/src/auth/dto/register.dto.ts) */
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Invalid email address"),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** ฟอร์มหน้าสมัคร: เพิ่มช่องยืนยันรหัสผ่าน (ไม่ส่งไป API) */
export const signupSchema = registerSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
