/** ข้อความที่ผู้ใช้เห็นเมื่อล็อกอิน/สมัครไม่ผ่าน แยกตาม code จริงที่ API ส่งมา */
export const LOGIN_ERRORS: Record<string, string> = {
  // API ไม่บอกว่าเป็นบัญชี Google (กันไล่เช็กอีเมล) จึงใบ้ไว้ในข้อความเดียวกันเลย
  INVALID_CREDENTIALS:
    "Email or password is invalid. If you signed up with Google, use Continue with Google.",
  ACCOUNT_SUSPENDED: "Your account has been suspended. Please contact support.",
  EMAIL_TAKEN: "This email is already registered. Try logging in instead.",
  VALIDATION_ERROR: "Please check the form and try again.",
  SERVICE_UNAVAILABLE:
    "We could not reach the server. Please try again in a moment.",
  TOO_MANY_REQUESTS:
    "Too many requests from your network. Please wait a minute and try again.",
};

export function loginErrorMessage(code: string): string {
  return LOGIN_ERRORS[code] ?? LOGIN_ERRORS.INVALID_CREDENTIALS;
}

/**
 * next-auth ส่งกลับมาหน้า /login พร้อม ?error= เมื่อล็อกอินด้วย Google ไม่ผ่าน
 * (เช่น API ล่ม, บัญชีโดนระงับ, กดยกเลิกที่หน้า Google)
 * AccountSuspended มาจาก /session-expired?reason=suspended (ดู api-fetch.ts)
 */
const REDIRECT_ERRORS: Record<string, string> = {
  AccessDenied: "Google sign-in was cancelled. Please try again.",
  AccountSuspended: LOGIN_ERRORS.ACCOUNT_SUSPENDED,
};

export function redirectErrorMessage(error: string | undefined) {
  if (!error) return null;
  return (
    REDIRECT_ERRORS[error] ??
    "We couldn't sign you in. Please try again in a moment."
  );
}
