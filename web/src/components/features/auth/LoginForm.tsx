"use client";

import FormAlert from "@/components/features/auth/FormAlert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { loginAction } from "@/lib/actions/auth.action";
import { LoginInput, loginSchema } from "@/lib/schemas/auth.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

export default function LoginForm({
  initialError = null,
}: {
  /** error จาก ?error= (เช่นล็อกอิน Google ไม่ผ่าน, บัญชีถูกระงับ) */
  initialError?: string | null;
}) {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const [isPending, startTransition] = useTransition();
  // แสดงจนกว่าจะลองล็อกอินใหม่
  const [redirectError, setRedirectError] = useState(initialError);

  // ลบ ?error= ออกจาก URL กด refresh หรือแชร์ลิงก์แล้วจะได้ไม่เห็นข้อความเก่าซ้ำ
  useEffect(() => {
    if (initialError) window.history.replaceState(null, "", "/login");
  }, [initialError]);

  const rootError = errors.root?.message ?? redirectError;

  const onSubmit = (data: LoginInput) => {
    setRedirectError(null);
    startTransition(async () => {
      // สำเร็จ = server action redirect ไปเอง ไม่คืนค่า
      const result = await loginAction(data);
      if (result) setError("root", { message: result.message });
    });
  };

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {rootError && <FormAlert message={rootError} />}

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-1" data-invalid={fieldState.invalid}>
              <FieldLabel required htmlFor={field.name}>
                Email
              </FieldLabel>
              <Input
                id={field.name}
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                {...field}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1" data-invalid={fieldState.invalid}>
              <FieldLabel required htmlFor={field.name}>
                Password
              </FieldLabel>
              <PasswordInput
                id={field.name}
                autoComplete="current-password"
                {...field}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Logging in..." : "Log in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
