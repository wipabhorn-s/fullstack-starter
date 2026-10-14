import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// ล้าง DOM หลังแต่ละ test ไม่ให้คอมโพเนนต์ของ test ก่อนหน้าค้างอยู่
afterEach(() => {
  cleanup();
});
