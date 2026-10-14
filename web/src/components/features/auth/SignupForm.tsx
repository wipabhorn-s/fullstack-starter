"use client";

import FormAlert from "@/components/features/auth/FormAlert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { registerAction } from "@/lib/actions/auth.action";
import { SignupInput, signupSchema } from "@/lib/schemas/auth.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

type FieldName = keyof SignupInput;

const FIELDS: {
  name: FieldName;
  label: string;
  type?: "email";
  autoComplete: string;
  description?: string;
}[] = [
  { name: "name", label: "Name", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  {
    name: "password",
    label: "Password",
    autoComplete: "new-password",
    description:
      "8-72 characters with uppercase, lowercase, a number and a symbol.",
  },
  {
    name: "confirmPassword",
    label: "Confirm password",
    autoComplete: "new-password",
  },
];

export default function SignupForm() {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const [isPending, startTransition] = useTransition();

  const onSubmit = ({ confirmPassword: _confirm, ...data }: SignupInput) => {
    startTransition(async () => {
      const result = await registerAction(data);
      if (!result) return;

      // อีเมลซ้ำ: ชี้ไปที่ช่องอีเมลตรง ๆ แทน error ลอย ๆ บนฟอร์ม
      if (result.code === "EMAIL_TAKEN") {
        setError("email", { message: result.message });
        return;
      }
      setError("root", { message: result.message });
    });
  };

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {errors.root?.message && <FormAlert message={errors.root.message} />}

        {FIELDS.map((config) => (
          <Controller
            key={config.name}
            control={control}
            name={config.name}
            render={({ field, fieldState }) => {
              const InputComponent =
                config.name === "password" || config.name === "confirmPassword"
                  ? PasswordInput
                  : Input;
              return (
                <Field className="gap-1" data-invalid={fieldState.invalid}>
                  <FieldLabel required htmlFor={field.name}>
                    {config.label}
                  </FieldLabel>
                  <InputComponent
                    id={field.name}
                    type={config.type}
                    autoComplete={config.autoComplete}
                    {...field}
                    aria-invalid={fieldState.invalid}
                  />
                  {config.description && !fieldState.invalid && (
                    <FieldDescription>{config.description}</FieldDescription>
                  )}
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              );
            }}
          />
        ))}

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Creating account..." : "Create account"}
        </Button>
      </FieldGroup>
    </form>
  );
}
