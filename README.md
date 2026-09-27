# chang-auth-api

Register / login ด้วย Express + MySQL + JWT พร้อมหน้า login / register

## วิธีรัน

```bash
npm install
cp .env.example .env          # ใส่ DATABASE_URL และ JWT_SECRET (อย่างน้อย 32 ตัวอักษร)
mysql -u root -p chang_db < sql/users_table.sql
npm start
```

เปิด http://localhost:4000/login

## โครงสร้าง

```
server.js
config/db.js                  MySQL pool (mysql2)
config/jwt.js                 JWT_SECRET (ไม่มีหรือสั้นเกินไป server จะไม่ start)
controllers/authController.js register / login / me
routes/authRoutes.js          /api/auth/* + rate limit
middleware/authMiddleware.js  ตรวจ Bearer token, requireRole(...)
sql/users_table.sql
public/                       login.html, register.html, index.html, css/, js/
deploy/Caddyfile              ตัวอย่าง HTTPS ด้วย Caddy (ขอ certificate ให้อัตโนมัติ)
deploy/nginx.conf             ตัวอย่าง HTTPS ด้วย Nginx + certbot
```

## API

| Method | Path | ผลลัพธ์ |
|---|---|---|
| POST | /api/auth/register | 201 สำเร็จ (ได้ token) · 400 ข้อมูลไม่ถูก · 409 มี email แล้ว (`redirectTo: '/login'`) |
| POST | /api/auth/login | 200 สำเร็จ · 404 ไม่มี email (`accountExists: false, redirectTo: '/register'`) · 401 รหัสผิด |
| GET | /api/auth/me | 200 ข้อมูลผู้ใช้ · 401 ไม่มี/หมดอายุ token |

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

> ถ้าตั้ง `NODE_ENV=production` แต่ไม่มี proxy อยู่หน้า Node หรือ proxy ไม่ส่ง `X-Forwarded-Proto` มา
> ทุก request จะถูก redirect ไป https วนไม่จบ

## หมายเหตุ

- สมัครใหม่ได้ role `user` เสมอ ส่วน `staff` / `agency` ต้องให้ admin อัปเดตใน DB
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

## ไฟล์ทั้งหมด (อยู่ใน chang-auth-api.zip ตัวล่าสุด)

server.js
config/db.js, config/jwt.js
controllers/authController.js
routes/authRoutes.js
middleware/authMiddleware.js
sql/users_table.sql
public/  login.html, register.html, index.html
         js/auth.js, login.js, register.js, home.js
         css/style.css
deploy/  Caddyfile, nginx.conf
package.json, .env.example, .gitignore, README.md


## สถานะการทดสอบ

1. ทดสอบแล้ว: logic ของ API และการเด้งหน้า ผ่าน 13 เคสด้วยฐานข้อมูลจำลอง ภายใต้การตั้งค่าความปลอดภัยแบบเดียวกับที่ helmet ใส่
2. ยังไม่ได้ทดสอบ: การรันกับ MySQL, express และ helmet ตัวจริง รวมถึงส่วนที่เพิ่มใน server.js รอบนี้ซึ่งผ่านแค่การตรวจ syntax

## ยังไม่ได้เพิ่ม

1. ลืมรหัสผ่าน / ตั้งรหัสใหม่
2. ยืนยันอีเมล
3. ยกเลิก token ตอน logout หรือเปลี่ยนรหัสผ่าน
4. rate limit ต่ออีเมล
5. หน้า admin สำหรับเปลี่ยน role
6. เทสต์อัตโนมัติ ที่รันกับฐานข้อมูลจริง
7. ระบบ migration
8. log แบบมีโครงสร้าง
