# chang-auth-api

Register / login ด้วย Express + MySQL + JWT พร้อมหน้า login / register

## วิธีรัน

```bash
npm install
cp .env.example .env          # ใส่ DATABASE_URL และ JWT_SECRET (อย่างน้อย 32 ตัวอักษร)
npm run db:up                 # (ถ้าไม่มี MySQL) เปิด MySQL ใน Docker: สร้าง chang_db และ chang_test ให้
npm start                     # สร้าง/อัปเดตตารางให้อัตโนมัติ (migration) แล้วเปิด server
npm run make-admin -- you@example.com   # ตั้ง admin คนแรก (ต้องสมัครสมาชิกก่อน)
```

เปิด http://localhost:4000/login

- `npm run dev`: รันแบบ restart อัตโนมัติ และแสดง log แบบอ่านง่าย
- ถ้ายังไม่ได้ตั้ง `SMTP_URL` อีเมล (ยืนยันอีเมล / ลืมรหัสผ่าน) จะไม่ถูกส่งจริง แต่พิมพ์ลิงก์ไว้ใน log แทน

## โครงสร้าง

```
server.js                     รัน migration แล้วเปิด server
app.js                        Express app (เทสต์โหลดไฟล์นี้ตรงๆ)
config/db.js                  MySQL pool (mysql2)
config/jwt.js                 JWT_SECRET (ไม่มีหรือสั้นเกินไป server จะไม่ start)
config/logger.js              log แบบ JSON (pino)
config/mailer.js              ส่งอีเมลผ่าน SMTP (nodemailer), APP_URL
controllers/authController.js register / login / me / logout / เปลี่ยนรหัส / ลืมรหัส / ยืนยันอีเมล
controllers/adminController.js ดูรายชื่อผู้ใช้ / เปลี่ยน role
routes/authRoutes.js          /api/auth/*
routes/adminRoutes.js         /api/admin/* (admin เท่านั้น)
middleware/authMiddleware.js  ตรวจ Bearer token + token_version, requireRole(...), requireVerifiedEmail
middleware/rateLimiters.js    rate limit ต่อ IP และต่ออีเมล
services/tokenService.js      JWT, ยกเลิก token, token ในลิงก์อีเมล (ใช้ครั้งเดียว)
services/emailService.js      เนื้อหาอีเมลยืนยัน / ตั้งรหัสใหม่
migrations/                   001_create_users.sql, 002_auth_features.sql
scripts/migrate.js            npm run migrate
scripts/make-admin.js         npm run make-admin -- <email>
test/                         เทสต์อัตโนมัติ (รันกับ MySQL จริง)
docker-compose.yml            MySQL สำหรับ dev และเทสต์
public/                       login, register, index, forgot-password, reset-password, verify-email, admin (.html) + css/, js/
deploy/Caddyfile              ตัวอย่าง HTTPS ด้วย Caddy (ขอ certificate ให้อัตโนมัติ)
deploy/nginx.conf             ตัวอย่าง HTTPS ด้วย Nginx + certbot
```

## API

| Method | Path | ผลลัพธ์ |
|---|---|---|
| POST | /api/auth/register | 201 สำเร็จ (ได้ token + ส่งอีเมลยืนยัน) · 400 ข้อมูลไม่ถูก · 409 มี email แล้ว (`redirectTo: '/login'`) |
| POST | /api/auth/login | 200 สำเร็จ · 404 ไม่มี email (`accountExists: false, redirectTo: '/register'`) · 401 รหัสผิด · 429 ผิดเกิน 5 ครั้ง |
| GET | /api/auth/me | 200 ข้อมูลผู้ใช้ (มี `emailVerified`) · 401 ไม่มี/หมดอายุ/ถูกยกเลิก token |
| POST | /api/auth/logout | 200 ยกเลิก token ทุกอันของผู้ใช้ (ออกจากระบบทุกอุปกรณ์) |
| POST | /api/auth/change-password | body `{ currentPassword, newPassword }` · 200 ได้ token ใหม่ (อุปกรณ์อื่นหลุด) · 401 รหัสเดิมผิด |
| POST | /api/auth/forgot-password | body `{ email }` · 200 เสมอ (ไม่บอกว่ามีบัญชีหรือไม่) · 429 ขอเกิน 3 ครั้ง/ชม. |
| POST | /api/auth/reset-password | body `{ token, password }` · 200 สำเร็จ · 400 ลิงก์ผิด/ใช้แล้ว/หมดอายุ |
| POST | /api/auth/verify-email | body `{ token }` · 200 สำเร็จ · 400 ลิงก์ผิด/ใช้แล้ว/หมดอายุ |
| POST | /api/auth/resend-verification | ต้องมี token · 200 ส่งแล้ว · 400 ยืนยันแล้ว · 429 เกิน 3 ครั้ง/ชม. |
| GET | /api/admin/users?q=&page= | admin เท่านั้น · รายชื่อผู้ใช้ (หน้าละ 20) + ค้นหาอีเมล/ชื่อ |
| PATCH | /api/admin/users/:id/role | admin เท่านั้น · body `{ role }` · 400 role ผิด/เปลี่ยนของตัวเอง · 404 ไม่พบผู้ใช้ |

## การเด้งหน้า

- login ด้วย email ที่ไม่มีในระบบ → `/register?email=...&from=login` (กรอก email ไว้ให้ + แสดงข้อความแจ้ง)
- register ด้วย email ที่มีอยู่แล้ว → `/login?email=...&exists=1`
- เข้า `/` โดยไม่มี token → `/login` · token เสีย/หมดอายุ → `/login?expired=1`

## ขึ้น production

1. **HTTPS**: วาง Caddy หรือ Nginx ไว้หน้า Node ใช้ไฟล์ใน `deploy/` เป็นตัวอย่าง (เปลี่ยน `api.example.com` เป็นโดเมนของคุณ)
2. **`.env`**: ตั้ง `NODE_ENV=production` ค่า default จะเปลี่ยนตามนี้
   - `TRUST_PROXY=1`: rate limit ใช้ IP จริงของผู้ใช้ ไม่ใช่ IP ของ proxy
   - `HOST=127.0.0.1`: Node รับ request จาก proxy ในเครื่องเท่านั้น ยิงตรงจากข้างนอกไม่ได้
   - request ที่เข้ามาแบบ http จะถูก redirect ไป https และเปิด HSTS
3. **CORS**: ถ้าหน้าเว็บอยู่ใน `public/` ของแอปนี้ ปล่อย `CORS_ORIGIN` ว่างไว้ ถ้ามี frontend แยกโดเมน ให้ใส่โดเมนนั้น (คั่นด้วย `,`)
4. **helmet**: ใส่ security header ให้อัตโนมัติ CSP อนุญาตให้รัน JavaScript จากไฟล์ของเว็บเองเท่านั้น
   ห้ามเขียน `<script>...</script>` หรือ `onclick="..."` ลงใน HTML ให้เขียนไว้ใน `public/js/` แทน
5. **อีเมล**: ต้องตั้ง `APP_URL` (ไม่ตั้ง server จะไม่ start) และ `SMTP_URL` (ไม่ตั้ง อีเมลจะไม่ถูกส่ง และมี error ใน log)

> ถ้าตั้ง `NODE_ENV=production` แต่ไม่มี proxy อยู่หน้า Node หรือ proxy ไม่ส่ง `X-Forwarded-Proto` มา
> ทุก request จะถูก redirect ไป https วนไม่จบ

## หมายเหตุ

- สมัครใหม่ได้ role `user` เสมอ ส่วน `staff` / `agency` / `admin` ให้ admin เปลี่ยนที่หน้า `/admin`
  (ใช้ `requireRole('staff')` หลัง `authMiddleware` เพื่อกั้น route ตาม role)
- ถ้า UI อยู่คนละ origin กับ API ให้แก้ `API_BASE` ใน `public/js/auth.js`


------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
## ฝั่ง backend (API)

1. สมัครสมาชิก POST /api/auth/register: ตรวจอีเมลและรหัสผ่าน (อย่างน้อย 8 ตัว) และ hash รหัสผ่านด้วย bcrypt ผู้สมัครใหม่ได้ role user เสมอ ถ้าอีเมลมีบัญชีแล้วจะตอบ 409 และบอกให้ไปหน้า login
2. Login POST /api/auth/login: ถ้าไม่มีอีเมลนี้ในระบบจะตอบ 404 พร้อม redirectTo: '/register' ถ้ารหัสผิดจะตอบ 401 ถ้าถูกจะได้ token อายุ 7 วัน
3. ดูข้อมูลตัวเอง GET /api/auth/me: ต้องมี token
4. Middleware: ตรวจ token และมี requireRole(...) ไว้กั้น route ตาม role
5. จำกัดการลอง register/login ได้ 20 ครั้งต่อ 15 นาทีต่อ IP
6. ถ้าไม่ตั้ง JWT_SECRET server จะไม่ start
7. เรียก /api ที่ไม่มีอยู่ จะได้ 404 เป็น JSON

## ความปลอดภัยสำหรับขึ้นจริง (เพิ่มรอบนี้)

1. HTTPS: มีไฟล์ตั้งค่า deploy/Caddyfile และ deploy/nginx.conf พอตั้ง NODE_ENV=production request แบบ http จะถูก redirect ไป https และเปิด HSTS ให้
2. trust proxy: rate limit นับตาม IP จริงของผู้ใช้ และ Node รับ request จาก proxy ในเครื่องเท่านั้น
3. CORS: ปิดไว้เป็นค่าเริ่มต้น ถ้ามี frontend แยกโดเมน ให้เปิดผ่าน CORS_ORIGIN
4. helmet: ใส่ security header ให้ และจำกัดให้รัน JavaScript ได้จากไฟล์ของเว็บเองเท่านั้น

## ฝั่งหน้าเว็บ (ภาษาไทย)

1. /login: ถ้าอีเมลยังไม่มีบัญชี จะเด้งไปหน้า register พร้อมกรอกอีเมลไว้ให้
2. /register: ถ้าอีเมลมีบัญชีแล้ว จะเด้งไปหน้า login
3. / หน้าแรก: แสดงข้อมูลผู้ใช้และมีปุ่ม logout ถ้าไม่มี token หรือ token หมดอายุจะเด้งไปหน้า login
4. โค้ด JavaScript ของทุกหน้าอยู่ในไฟล์แยกใน public/js/ แล้ว

## ไฟล์ทั้งหมด

ดูหัวข้อ "โครงสร้าง" ด้านบน (`sql/users_table.sql` ย้ายไปเป็น `migrations/001_create_users.sql` แล้ว)


## สถานะการทดสอบ

1. ทดสอบแล้ว: `npm test` ผ่าน 24 เคส รันกับ MySQL 8.4 ตัวจริง (Docker) ผ่าน express, helmet และ rate limit ตัวจริง
2. ทดสอบด้วยมือแล้ว: `npm start` บนฐานข้อมูลว่าง (migration สร้างตารางให้), สมัคร, `make-admin`, เรียก `/api/admin/users`, ดู log
3. ยังไม่ได้ทดสอบ: หน้าเว็บในเบราว์เซอร์ (ผ่านแค่การตรวจ syntax และเช็กว่าทุกหน้าเปิดได้) และการส่งอีเมลผ่าน SMTP จริง

## เพิ่มแล้วรอบนี้ (จากรายการ "ยังไม่ได้เพิ่ม" เดิม)

### 1. ลืมรหัสผ่าน / ตั้งรหัสใหม่

- หน้า `/login` มีลิงก์ "ลืมรหัสผ่าน?" → `/forgot-password` กรอกอีเมล → ได้อีเมลที่มีลิงก์ `/reset-password?token=...`
- ลิงก์ใช้ได้ **1 ชั่วโมง** และ **ครั้งเดียว** ขอลิงก์ใหม่แล้วลิงก์เก่าใช้ไม่ได้ทันที
- ในฐานข้อมูลเก็บแค่ SHA-256 ของ token (ตาราง `email_tokens`) ถ้าฐานข้อมูลหลุด ก็เอาไปรีเซ็ตรหัสใครไม่ได้
- `forgot-password` ตอบข้อความเดียวกันเสมอ ไม่ว่าอีเมลนั้นจะมีบัญชีหรือไม่
- ตั้งรหัสใหม่สำเร็จ = ทุกอุปกรณ์ที่ login อยู่ถูกออกจากระบบ (ใช้กลไกข้อ 3)
- ลิงก์ในอีเมลสร้างจาก `APP_URL` ไม่ใช่จาก Host header ของ request (กันคนปลอม Host ให้ลิงก์ชี้ไปเว็บตัวเอง)
- ไฟล์: `controllers/authController.js` (forgotPassword, resetPassword), `services/tokenService.js`, `services/emailService.js`, `config/mailer.js`, `public/forgot-password.html`, `public/reset-password.html`

### 2. ยืนยันอีเมล

- สมัครเสร็จ ระบบส่งอีเมลยืนยันให้ (ลิงก์ใช้ได้ 24 ชั่วโมง) ถ้าส่งไม่สำเร็จ การสมัครยังสำเร็จอยู่ (`verificationEmailSent: false`)
- ยังไม่ยืนยันก็ login ได้ หน้าแรกจะมีแถบแจ้งและปุ่ม "ส่งอีเมลยืนยันอีกครั้ง" (ส่งได้ 3 ครั้ง/ชั่วโมง)
- route ไหนต้องการเฉพาะคนที่ยืนยันอีเมลแล้ว ให้ใส่ `requireVerifiedEmail` หลัง `authMiddleware`
- ลิงก์เปิดหน้า `/verify-email` ซึ่งค่อย POST token ไปที่ API (ไม่ยืนยันแค่เพราะเปิดลิงก์) โปรแกรมสแกนลิงก์ในอีเมลจะได้ไม่ใช้ token ไปก่อน
- ไฟล์: `controllers/authController.js` (verifyEmail, resendVerification), `middleware/authMiddleware.js`, `public/verify-email.html`, `public/js/home.js`

### 3. ยกเลิก token ตอน logout หรือเปลี่ยนรหัสผ่าน

- ตาราง `users` มีคอลัมน์ `token_version` และ JWT ทุกอันเก็บเลข version ตอนที่ออก token
- `authMiddleware` อ่านผู้ใช้จากฐานข้อมูลทุก request ถ้าเลขไม่ตรง → 401 (หน้าเว็บเด้งไป `/login?expired=1`)
- `POST /api/auth/logout` เพิ่มเลข version → token **ทุกอัน** ของผู้ใช้ใช้ไม่ได้ (= ออกจากระบบทุกอุปกรณ์)
- `POST /api/auth/change-password` (ฟอร์มในหน้าแรก) และ reset-password ก็เพิ่มเลข version เหมือนกัน เปลี่ยนรหัสแล้วอุปกรณ์นี้ได้ token ใหม่ อุปกรณ์อื่นหลุด
- ผลพลอยได้: role ที่ admin เปลี่ยน หรือบัญชีที่ถูกลบ มีผลทันที ไม่ต้องรอ token หมดอายุ (แลกกับ query เพิ่ม 1 ครั้งต่อ request)
- ไฟล์: `migrations/002_auth_features.sql`, `services/tokenService.js`, `middleware/authMiddleware.js`

### 4. rate limit ต่ออีเมล

| อะไร | จำกัด | นับตาม |
|---|---|---|
| login ผิด | 5 ครั้ง / 15 นาที (login สำเร็จไม่นับ) | อีเมล |
| ขอลิงก์ลืมรหัสผ่าน | 3 ครั้ง / ชั่วโมง | อีเมล |
| ส่งอีเมลยืนยันซ้ำ | 3 ครั้ง / ชั่วโมง | ผู้ใช้ |
| register / login / reset | 20 ครั้ง / 15 นาที (เดิม, ปรับได้ด้วย `RATE_LIMIT_IP_MAX`) | IP |

- ต่อ IP กันเครื่องเดียวลองหลายบัญชี ต่ออีเมลกันการเดารหัสบัญชีเดียวจากหลาย IP
- ตัวนับเก็บในหน่วยความจำของ process: restart แล้วเริ่มนับใหม่ และถ้ารัน Node หลาย process ต้องเปลี่ยนไปใช้ store กลาง เช่น `rate-limit-redis`
- ไฟล์: `middleware/rateLimiters.js`, `routes/authRoutes.js`

### 5. หน้า admin สำหรับเปลี่ยน role

- เพิ่ม role `admin` ตั้ง admin คนแรกด้วย `npm run make-admin -- email@example.com`
- หน้า `/admin` (มีลิงก์ในหน้าแรกเมื่อเป็น admin): ตารางผู้ใช้ ค้นหาอีเมล/ชื่อ แบ่งหน้าละ 20 เลือก role จาก dropdown แล้วบันทึกทันที
- API `/api/admin/*` กั้นด้วย `authMiddleware` + `requireRole('admin')` ทั้งหมด
- เปลี่ยน role ของตัวเองไม่ได้ (กัน admin คนสุดท้ายลดสิทธิ์ตัวเองจนไม่มีใครเข้าหน้านี้ได้)
- การเปลี่ยน role ทุกครั้งถูกบันทึกใน log (`event: "role_changed"`, admin คนไหน, จาก role อะไรเป็นอะไร)
- ไฟล์: `controllers/adminController.js`, `routes/adminRoutes.js`, `scripts/make-admin.js`, `public/admin.html`, `public/js/admin.js`

### 6. เทสต์อัตโนมัติ ที่รันกับฐานข้อมูลจริง

```bash
npm run db:up        # MySQL ใน Docker (สร้างฐานข้อมูล chang_test ให้)
# ใส่ใน .env:  TEST_DATABASE_URL=mysql://chang_app:password@localhost:3306/chang_test
npm test
```

- ใช้ `node:test` ที่มากับ Node + `supertest` ยิง request เข้า `app.js` ตรงๆ ไม่ต้องเปิด port
- ก่อนรัน: รัน migration แล้วล้างตารางทั้งหมด ชื่อฐานข้อมูลต้องมีคำว่า `test` ไม่อย่างนั้นเทสต์จะไม่ยอมรัน (กันลบข้อมูลจริง)
- อีเมลไม่ถูกส่งจริง แต่เก็บไว้ใน `outbox` ให้เทสต์ดึง token จากลิงก์ไปใช้ต่อ
- ครอบคลุม: register/login/me, ยืนยันอีเมล, logout และเปลี่ยนรหัสแล้ว token เก่าใช้ไม่ได้, ลืมรหัส (ใช้ซ้ำ/หมดอายุ), rate limit ต่ออีเมล, สิทธิ์ admin
- ไฟล์: `test/helpers.js`, `test/auth.test.js`, `test/admin.test.js`, `docker-compose.yml`, `test/create-test-db.sql`

### 7. ระบบ migration

- ไฟล์ SQL อยู่ใน `migrations/` ตั้งชื่อ `NNN_ชื่อ.sql` รันเรียงตามเลข
- ตาราง `schema_migrations` จำว่าไฟล์ไหนรันไปแล้ว `npm start` รันไฟล์ที่ยังไม่ได้รันให้เอง (ปิดได้ด้วย `MIGRATE_ON_START=false` แล้วรัน `npm run migrate` เอง)
- ใช้ `GET_LOCK` ของ MySQL กันเปิด server หลายตัวพร้อมกันแล้วรัน migration ซ้ำ
- ฐานข้อมูลเดิมที่สร้างจาก `sql/users_table.sql` ใช้ต่อได้เลย (001 ใช้ `CREATE TABLE IF NOT EXISTS`)
- **กฎ**: ห้ามแก้ไฟล์ที่เคยรันไปแล้ว จะเปลี่ยนตารางให้สร้างไฟล์ใหม่ เช่น `003_add_phone.sql`
- MySQL commit คำสั่ง `ALTER`/`CREATE` ทันที ถ้าไฟล์พังกลางทาง จะ rollback ไม่ได้ ให้แยกไฟล์เล็กๆ
- ไฟล์: `scripts/migrate.js`, `migrations/001_create_users.sql`, `migrations/002_auth_features.sql`

### 8. log แบบมีโครงสร้าง

- ใช้ `pino` เขียน log เป็น JSON บรรทัดละ 1 เหตุการณ์ ส่งเข้า Loki / CloudWatch / ELK แล้วค้นตาม field ได้

  ```json
  {"level":"warn","time":"2026-09-27T09:36:40.202Z","service":"chang-auth-api","req":{"id":"779af1ba-...","method":"POST","url":"/api/auth/login","ip":"203.0.113.5"},"event":"login_failed","userId":1,"msg":"wrong password"}
  ```

- ทุก request มี `reqId` (ส่ง header `X-Request-Id` มาเองได้ และตอบกลับใน header เดียวกัน) log ทุกบรรทัดของ request เดียวกันจะมี id เดียวกัน
- เหตุการณ์สำคัญมี field `event`: `user_registered`, `login`, `login_failed`, `logout`, `password_changed`, `password_reset_requested`, `password_reset`, `email_verified`, `role_changed`, `rate_limited`, `mail_failed`
- ไม่เขียนรหัสผ่าน / token / header `Authorization` ลง log
- `LOG_LEVEL` ปรับระดับได้ `npm run dev` แสดงผลแบบอ่านง่ายด้วย `pino-pretty`
- ไฟล์: `config/logger.js`, `app.js` (pino-http)

## ยังไม่ได้เพิ่ม

1. rate limit แบบใช้ store กลาง (Redis) สำหรับรันหลาย process
2. logout เฉพาะอุปกรณ์เดียว (ตอนนี้ logout = ออกทุกอุปกรณ์)
3. CI ที่รัน `npm test` อัตโนมัติ (เช่น GitHub Actions พร้อม MySQL service)
