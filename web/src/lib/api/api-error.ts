export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly message: string,
    /**
     * โค้ดสาเหตุที่ API ส่งมาด้วยในบางกรณี (เช่น ACCOUNT_SUSPENDED,
     * EMAIL_NOT_VERIFIED) ใช้แยกเคสโดยไม่ต้องไปจับคู่กับข้อความที่อาจเปลี่ยน
     */
    readonly code?: string,
  ) {
    super(message);
  }
}
