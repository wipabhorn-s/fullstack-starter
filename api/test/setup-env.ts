// ConfigModule.forRoot() ตรวจ env ตั้งแต่ตอน import AppModule (ก่อน beforeAll)
// จึงต้องตั้งค่าหลอกไว้ที่นี่ ซึ่ง jest รันก่อนโหลดไฟล์ test ทุกไฟล์
// ค่าจริงใน .env ไม่ถูกโหลดใน test (ConfigModule อ่าน .env แต่ค่าที่มีอยู่แล้วชนะ)
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://e2e:e2e@localhost:5432/e2e';
process.env.ACCESS_TOKEN_SECRET = 'e2e-secret-'.padEnd(40, 'x');
