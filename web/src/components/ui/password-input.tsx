"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

/**
 * ช่องรหัสผ่านพร้อมปุ่มดวงตาสลับให้เห็นตัวอักษร ซ่อนปุ่ม reveal ของ Edge
 * ด้วย (::-ms-reveal) ไม่งั้นจะมีรูปตาสองอันซ้อนกัน
 */
function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-11 [&::-ms-reveal]:hidden", className)}
        {...props}
      />
      <button
        type="button"
        // กด Tab ให้ข้ามไปช่องถัดไปเลย ไม่แวะปุ่มดวงตา (แบบเดียวกับ Google/Microsoft)
        // screen reader ยังเจอปุ่มนี้ได้ตามปกติเพราะไม่ได้ซ่อนจาก accessibility tree
        tabIndex={-1}
        // คลิกแล้วเคอร์เซอร์ยังอยู่ในช่องรหัสผ่าน พิมพ์ต่อได้ทันที
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export { PasswordInput };
