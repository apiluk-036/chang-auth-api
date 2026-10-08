/**
 * เข้าสู่ระบบด้วยเบอร์โทร
 *
 * phone_normalized: เบอร์โทรที่ตัดช่องว่าง/ขีด/วงเล็บออกแล้ว และแปลง +66 เป็น 0 นำหน้า
 * ใช้ค้นหาตอนล็อกอิน เพราะคอลัมน์ phone เก็บตามที่ลูกค้าพิมพ์ (เช่น "081-234 5678" หรือ "+66 81 234 5678")
 *
 * ไม่ตั้ง unique ที่ฐานข้อมูล เพราะบัญชีเดิมอาจใช้เบอร์ซ้ำกันอยู่แล้ว — โค้ดกันเบอร์ซ้ำตอนสมัคร/แก้โปรไฟล์
 * และบัญชีที่เบอร์ซ้ำกันจะล็อกอินด้วยเบอร์ไม่ได้ ต้องใช้อีเมล
 */
import { normalizePhone } from '../../utils/helpers.js';

export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('phone_normalized', 20);
    table.index(['phone_normalized'], 'users_phone_normalized_idx');
  });

  const rows = await knex('users').select('id', 'phone').whereNotNull('phone');
  for (const row of rows) {
    const normalized = normalizePhone(row.phone);
    if (normalized) await knex('users').where({ id: row.id }).update({ phone_normalized: normalized });
  }
}

export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex(['phone_normalized'], 'users_phone_normalized_idx');
    table.dropColumn('phone_normalized');
  });
}
