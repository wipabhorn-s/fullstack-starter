"use client";

import { cn } from "@/lib/utils";
import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

function Input({
  className,
  type,
  noAutofill = false,
  readOnly,
  onPointerDown,
  onFocus,
  ...props
}: React.ComponentProps<"input"> & {
  /**
   * ไม่ให้เบราว์เซอร์เติมอีเมล/รหัสที่บันทึกไว้ให้เองตอนเปิดหน้า
   * Chrome ไม่สน autocomplete="off" ในช่องรหัสผ่าน แต่ไม่เติมช่องที่เป็น readOnly
   * จึงล็อกไว้ก่อน แล้วปลดทันทีที่ผู้ใช้แตะ/คลิก/กด Tab เข้ามา (ยังเลือกจากรายการที่บันทึกไว้เองได้)
   */
  noAutofill?: boolean;
}) {
  const [locked, setLocked] = React.useState(noAutofill);

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      readOnly={locked || readOnly}
      // ปลดตอนกดก่อนโฟกัส: มือถือบางรุ่นไม่เปิดคีย์บอร์ดถ้าช่องยัง readOnly ตอนแตะ
      onPointerDown={(event) => {
        setLocked(false);
        onPointerDown?.(event);
      }}
      onFocus={(event) => {
        setLocked(false);
        onFocus?.(event);
      }}
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-border bg-muted px-4 py-2.5 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
