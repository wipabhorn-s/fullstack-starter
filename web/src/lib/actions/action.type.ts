export type ErrorActionResult = {
  success: false;
  message: string;
  errors?: Record<string, unknown>;
  code: string;
};
