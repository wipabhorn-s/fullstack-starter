import { ApiError } from "@/lib/api/api-error";
import { env } from "@/lib/env";
import { headers as requestHeaders } from "next/headers";
import { redirect } from "next/navigation";

/** route handler ที่ล้าง session แล้วพาไปหน้า login (app/session-expired) */
const SESSION_EXPIRED_PATH = "/session-expired";

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: Record<string, unknown> | FormData;
  token?: string;
  /** IP ของผู้ใช้ ส่งเองได้ในที่ที่อ่าน header ของคำขอไม่ได้ (เช่น proxy.ts) */
  clientIp?: string;
  /**
   * ลองใหม่เองเมื่อ API ยังไม่พร้อม (ดู fetchWhenAwake) ค่าเริ่มต้น: เฉพาะ GET
   * คำขอที่เปลี่ยนข้อมูลต้องเปิดเองเมื่อส่งซ้ำแล้วไม่เสียหาย (เช่น ล็อกอิน)
   * ห้ามเปิดกับการจ่ายเงิน/สร้างข้อมูล เพราะส่งซ้ำอาจเกิดรายการซ้ำ
   */
  retry?: boolean;
};

/** hosting (เช่น Render) ตอบแบบนี้ตอน API กำลังตื่นจากหลับ / กำลัง deploy (คำขอยังไม่ถึงโค้ดเรา) */
const API_NOT_READY = new Set([502, 503, 504]);

/**
 * รอก่อนลองใหม่แต่ละรอบ (ms) รวม 60 วินาที: API บนแพ็กเกจฟรีใช้เวลาตื่นราว 50 วินาที
 * ถี่ช่วงแรกเผื่อเป็นแค่สะดุดชั่วครู่ แล้วค่อยห่างขึ้น
 */
export const RETRY_DELAYS_MS = [
  1_000, 2_000, 4_000, 8_000, 15_000, 15_000, 15_000,
];

/**
 * เรียก API แล้วรอให้มันตื่นถ้ายังไม่พร้อม แทนที่จะปล่อยให้ผู้ใช้เจอ error
 * (แพ็กเกจฟรีหลับเมื่อไม่มีคนใช้สักพัก คนแรกที่เข้ามาจะเจอหน้าว่าง
 * หรือล็อกอินด้วย Google ไม่ผ่านเพราะ "Bad Gateway" ทั้งที่รออีกครู่ก็ใช้ได้)
 */
async function fetchWhenAwake(
  url: string,
  init: RequestInit,
  retry: boolean,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const delay = retry ? RETRY_DELAYS_MS[attempt] : undefined;

    try {
      // ระหว่าง render หน้าเดียว React จำผล fetch แบบ GET ที่หน้าตาเหมือนกันไว้
      // รอบลองใหม่จึงได้ผลล้มเหลวเดิมกลับมาโดยไม่ได้ยิงจริง ใส่ signal = ไม่ให้จำ
      const response = await fetch(
        url,
        attempt === 0 || init.signal
          ? init
          : { ...init, signal: new AbortController().signal },
      );
      if (delay === undefined || !API_NOT_READY.has(response.status)) {
        return response;
      }
    } catch (error) {
      // ต่อไม่ติดเลย (API ยังไม่เปิดรับคำขอ) หมดรอบแล้วค่อยโยน error จริงออกไป
      if (delay === undefined) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/** IP แรกใน X-Forwarded-For = เครื่องของผู้ใช้ (ตัวถัดไปคือ proxy ระหว่างทาง) */
export function clientIpFrom(source: Headers): string | undefined {
  return (
    source.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    source.get("x-real-ip") ||
    undefined
  );
}

/**
 * IP ของผู้ใช้ที่กำลังเปิดหน้าเว็บอยู่ API ใช้นับ rate limit ต่อคน
 * ไม่ส่ง = API เห็นทุกคนเป็น IP ของ server เว็บ แล้วใช้โควตาร่วมกันทั้งเว็บ
 * นอกคำขอ (เช่นตอน build) อ่าน header ไม่ได้ ก็ไม่ส่ง
 */
async function currentClientIp(): Promise<string | undefined> {
  try {
    return clientIpFrom(await requestHeaders());
  } catch {
    return undefined;
  }
}

const API_URL = env.API_URL;

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, headers, token, clientIp, retry, ...init } = options;

  const newHeaders = new Headers(headers);
  if (token) {
    newHeaders.set("Authorization", `Bearer ${token}`);
  }

  const ip = clientIp ?? (await currentClientIp());
  if (ip && env.INTERNAL_API_SECRET) {
    // production: พิสูจน์ด้วยรหัสลับว่ามาจาก server เว็บของเรา API จึงเชื่อ IP นี้
    newHeaders.set("X-Client-IP", ip);
    newHeaders.set("X-Internal-Secret", env.INTERNAL_API_SECRET);
  } else if (ip) {
    // dev (เว็บกับ API เครื่องเดียวกัน): API เชื่อ X-Forwarded-For จาก loopback
    newHeaders.set("X-Forwarded-For", ip);
  }

  if (body !== undefined && !(body instanceof FormData)) {
    newHeaders.set("Content-Type", "application/json");
  }

  const newBody = body instanceof FormData ? body : JSON.stringify(body);

  const method = (init.method ?? "GET").toUpperCase();
  const response = await fetchWhenAwake(
    `${API_URL}${path}`,
    { ...init, body: newBody, headers: newHeaders },
    retry ?? (method === "GET" || method === "HEAD"),
  );

  // ส่ง token ไปแล้วโดน 401 = session ที่ถืออยู่ใช้ไม่ได้แล้ว (token หมดอายุ
  // บัญชีถูกลบ หรือโดนระงับ) ล็อกเอาต์ให้เลยแทนที่จะปล่อยให้หน้าพังเป็น error
  // redirect() ทำงานด้วยการ throw จึงหยุดทั้ง server component และ action ตรงนี้
  if (token && response.status === 401) {
    redirect(SESSION_EXPIRED_PATH);
  }

  if (!response.ok) {
    // body ของ Nest เป็น { message, statusCode } ปกติ แต่ endpoint ที่ต้องให้
    // ฝั่งเว็บแยกเคสได้จะแนบ code มาด้วย และบาง error (เช่น validation)
    // ส่ง message มาเป็น array
    const errorBody: unknown = await response.json().catch(() => null);
    const { message, code } = (errorBody ?? {}) as {
      message?: string | string[];
      code?: string;
    };

    // บัญชีถูกระงับระหว่างที่ล็อกอินอยู่ (AuthGuard ตอบ 403 ACCOUNT_SUSPENDED)
    // ล็อกเอาต์แล้วบอกเหตุผลที่หน้า login แทนที่จะปล่อยให้ทุกหน้าพังเป็น 403
    if (token && response.status === 403 && code === "ACCOUNT_SUSPENDED") {
      redirect(`${SESSION_EXPIRED_PATH}?reason=suspended`);
    }

    throw new ApiError(
      response.status,
      Array.isArray(message)
        ? message.join(", ")
        : (message ?? response.statusText),
      code,
    );
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}
