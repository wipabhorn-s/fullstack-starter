import GoogleButton from "@/components/features/auth/GoogleButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { googleEnabled } from "@/lib/env";

/** กรอบร่วมของหน้า login / signup: หัวข้อ + ปุ่ม Google (ถ้าเปิดไว้) + ฟอร์ม */
export default function AuthCard({
  title,
  description,
  googleLabel,
  children,
}: {
  title: string;
  description: React.ReactNode;
  googleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {googleEnabled && (
          <>
            <GoogleButton label={googleLabel} />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>or continue with email</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
