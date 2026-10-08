/**
 * highlights_en: จุดเด่นของกิจกรรมภาษาอังกฤษ บรรทัดละ 1 ข้อ สำหรับหน้ารายละเอียดกิจกรรม
 * เว้นว่างได้ หน้าเว็บจะถอยกลับไปใช้ highlights
 */

export async function up(knex) {
  await knex.schema.alterTable('activities', (table) => {
    table.text('highlights_en');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('activities', (table) => {
    table.dropColumn('highlights_en');
  });
}
