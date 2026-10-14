import { Transform } from 'class-transformer';

/**
 * ตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็กก่อนถึง service เสมอ
 *
 * โดเมนของอีเมลไม่สนตัวพิมพ์อยู่แล้ว และผู้ให้บริการรายใหญ่ทุกเจ้าก็ไม่แยกตัวพิมพ์
 * ของ local part ด้วย ถ้าเก็บตามที่ผู้ใช้พิมพ์มาดิบๆ จะได้ทั้ง Earthty@gmail.com
 * และ earthty@gmail.com เป็นคนละบัญชี ทั้งที่เป็นกล่องจดหมายใบเดียวกัน
 *
 * และเพราะทุกจุดที่ "อ่าน" อีเมลใน users.service.ts เรียก .toLowerCase() อยู่แล้ว
 * แถวที่เผลอเก็บตัวใหญ่ไว้จะค้นไม่เจอเลย — เช็คอีเมลซ้ำไม่ทำงาน และเจ้าของบัญชี
 * นั้นก็ล็อกอินด้วยอีเมลไม่ได้ด้วย
 */
export function NormalizeEmail() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
}
