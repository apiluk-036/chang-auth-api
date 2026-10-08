import ExcelJS from 'exceljs';

const BOOKING_STATUS = { pending: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก' };
const PAYMENT_STATUS = {
  unpaid: 'ยังไม่ชำระ',
  reviewing: 'แจ้งโอนแล้ว รอตรวจสอบ',
  paid: 'ชำระแล้ว',
  refunded: 'คืนเงินแล้ว',
};
const PICKUP_TYPES = {
  hotel: 'โรงแรม',
  meeting_point: 'จุดนัดพบ',
  airbnb: 'Airbnb / ที่พักส่วนตัว',
  undecided: 'ยังไม่ตัดสินใจ',
};
const PICKUP_ROUNDS = { morning: 'รอบเช้า', afternoon: 'รอบกลางวัน' };

/**
 * วันเวลาใน Excel ไม่มีเขตเวลา และ exceljs เขียนค่าตามเวลา UTC
 * จึงเลื่อนค่าตามเขตเวลาของเซิร์ฟเวอร์ (TZ=Asia/Bangkok) ให้เซลล์แสดงเวลาไทยตรงกับหน้าหลังบ้าน
 */
const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
};

/** คอลัมน์ของชีตการจอง — value รับการจอง 1 รายการ คืนค่าที่จะใส่ในเซลล์ */
const BOOKING_COLUMNS = [
  { header: 'รหัสการจอง', width: 14, value: (b) => b.booking_ref },
  { header: 'จองเมื่อ', width: 18, numFmt: 'yyyy-mm-dd hh:mm', value: (b) => toDate(b.created_at) },
  { header: 'วันที่เข้าร่วม', width: 14, value: (b) => b.booking_date },
  { header: 'รอบรับ', width: 12, value: (b) => PICKUP_ROUNDS[b.pickup_round] ?? b.pickup_round },
  { header: 'กิจกรรม', width: 22, value: (b) => b.activity?.name_th ?? '' },
  { header: 'Activity', width: 28, value: (b) => b.activity?.name ?? '' },
  { header: 'ชื่อ', width: 16, value: (b) => b.first_name },
  { header: 'นามสกุล', width: 16, value: (b) => b.last_name },
  // เบอร์โทรเก็บเป็นข้อความ ไม่งั้น Excel จะตัดเลข 0 ตัวหน้าทิ้ง
  { header: 'เบอร์โทร', width: 16, numFmt: '@', value: (b) => String(b.phone ?? '') },
  { header: 'อีเมล', width: 28, value: (b) => b.email },
  { header: 'แอปติดต่อ', width: 12, value: (b) => b.contact_app },
  { header: 'ไอดีติดต่อ', width: 18, numFmt: '@', value: (b) => String(b.contact_id ?? '') },
  { header: 'ผู้ใหญ่', width: 8, value: (b) => b.adults },
  { header: 'เด็ก', width: 8, value: (b) => b.children },
  { header: 'ทารก', width: 8, value: (b) => b.infants },
  { header: 'ยอดรวม (บาท)', width: 14, numFmt: '#,##0.00', value: (b) => Number(b.total_amount) },
  { header: 'สถานะ', width: 12, value: (b) => BOOKING_STATUS[b.status] ?? b.status },
  { header: 'การชำระเงิน', width: 22, value: (b) => PAYMENT_STATUS[b.payment_status] ?? b.payment_status },
  { header: 'วิธีชำระ', width: 12, value: (b) => b.payment_method ?? '' },
  { header: 'ชำระเมื่อ', width: 18, numFmt: 'yyyy-mm-dd hh:mm', value: (b) => toDate(b.paid_at) },
  { header: 'รายละเอียดการโอน', width: 26, value: (b) => b.payment_ref ?? '' },
  { header: 'จุดรับ', width: 20, value: (b) => PICKUP_TYPES[b.pickup_type] ?? b.pickup_type },
  { header: 'ชื่อที่พัก / จุดรับ', width: 26, value: (b) => b.pickup_detail ?? '' },
  { header: 'หมายเหตุจากลูกค้า', width: 30, value: (b) => b.note ?? '' },
  { header: 'เหตุผลที่ยกเลิก', width: 24, value: (b) => b.cancel_reason ?? '' },
];

/**
 * สร้างไฟล์ Excel (.xlsx) ของรายการจอง คืนเป็น Buffer
 * ค่าทุกเซลล์ถูกใส่เป็นข้อความ/ตัวเลข/วันที่ ไม่ใช่สูตร ข้อความจากลูกค้าที่ขึ้นต้นด้วย "=" จึงไม่ถูก Excel รันเป็นสูตร
 */
export async function buildBookingsWorkbook(bookings) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Chokchai Elephant Camp';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('การจอง', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = BOOKING_COLUMNS.map((column) => ({
    header: column.header,
    width: column.width,
    style: column.numFmt ? { numFmt: column.numFmt } : {},
  }));

  for (const booking of bookings) {
    sheet.addRow(BOOKING_COLUMNS.map((column) => column.value(booking)));
  }

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF183420' } };
  header.alignment = { vertical: 'middle' };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: BOOKING_COLUMNS.length } };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
