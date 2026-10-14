"use client";

import { Button } from "@/components/ui/button";
import { updateUserStatusAction } from "@/lib/actions/admin.action";
import type { UserStatus } from "@/lib/api/api.type";
import { useState, useTransition } from "react";

export default function UserStatusButton({
  userId,
  status,
  disabled = false,
}: {
  userId: string;
  status: UserStatus;
  /** แถวของตัวเอง: API ไม่ยอมให้เปลี่ยนสถานะตัวเองอยู่แล้ว ปิดปุ่มไว้เลย */
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next: UserStatus = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      // สำเร็จ = action revalidate หน้า admin ตารางจะได้สถานะใหม่เอง
      const result = await updateUserStatusAction(userId, next);
      if (!result.success) setError(result.message);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={next === "SUSPENDED" ? "destructive" : "outline"}
        disabled={disabled || isPending}
        onClick={onClick}
      >
        {next === "SUSPENDED" ? "Suspend" : "Activate"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
