import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

/** error ระดับฟอร์ม (ไม่ผูกกับช่องใดช่องหนึ่ง) เช่น รหัสผ่านผิด, API ล่ม */
export default function FormAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="border-destructive/50">
      <AlertCircle />
      <AlertTitle>{message}</AlertTitle>
    </Alert>
  );
}
