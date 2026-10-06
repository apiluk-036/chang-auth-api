/**
 * ข้อความภาษาอังกฤษของกิจกรรม สำหรับหน้าเว็บที่แสดงเป็นภาษาอังกฤษ
 * - description_en: คำอธิบาย
 * - duration_label_en: ระยะเวลาที่แสดงบนการ์ด เช่น "1.5 hours"
 *
 * เว้นว่างได้ หน้าเว็บจะถอยกลับไปใช้ description_th / duration_label
 */

export async function up(knex) {
  await knex.schema.alterTable('activities', (table) => {
    table.text('description_en');
    table.string('duration_label_en', 60);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('activities', (table) => {
    table.dropColumn('duration_label_en');
    table.dropColumn('description_en');
  });
}
