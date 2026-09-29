# ภาพหลักฐาน UX/UI

## ภาพชุดหลัก

ภาพ PNG 81 ภาพมาจาก 21 เส้นทางตาม `docs/design-system/route-map.md` ที่ความกว้าง 390, 768, 1440 CSS px และ 6 หน้าเพิ่มที่ความกว้าง 320, 375, 1024 CSS px

ก่อนบันทึกแต่ละภาพ ตั้งขนาดด้วย Playwright `page.setViewportSize()` และอ่าน `window.innerWidth`, `document.documentElement.scrollWidth`, `document.body.scrollWidth` ภาพทั้ง 81 ใบได้ความกว้าง CSS ตรงตามชื่อไฟล์ และไม่พบการล้นแนวนอนระดับทั้งหน้า

## ภาพเพิ่มของ Wizard

- `station-new-step2-390.png`: ขั้นระบบและอุปกรณ์ของ SC
- `station-new-step2-imps-320.png`, `station-new-step2-imps-390.png`: รายการหมวด IMPS ตอนเริ่มหน้า
- `station-new-step2-imps-selected-320.png`, `station-new-step2-imps-selected-390.png`: หลังเลือก IMPS-01 โดยยังอยู่ด้านบนของรายการ
- `station-new-step2-imps-detail-320.png`, `station-new-step2-imps-detail-390.png`: Work Spec ของ IMPS-04 หลังเลื่อนลงไปดูรายละเอียด

ร่าง SC/IMPS ใช้รหัสและชื่อสมมติ แล้วออกจาก Wizard โดยไม่กดยืนยันสร้างสถานี

## ภาพรวมย่อ

ไฟล์ใน `contact-sheets/` รวมภาพตามขนาดจอ: `routes-320.jpg`, `routes-375.jpg`, `routes-390.jpg`, `routes-768.jpg`, `routes-1024.jpg`, `routes-1440.jpg`

ภาพ contact sheet ใช้ดูภาพรวมเท่านั้น หากต้องอ่านตัวอักษรหรือยืนยันจุดใด ให้เปิด PNG ต้นฉบับที่มีชื่อเส้นทางและขนาดจอ

## ขอบเขต

เส้นทาง Checklist, Vehicle API, ประวัติ และรายงานที่ลงท้าย `no-round`/รายงานสัญญา ใช้รหัส placeholder ที่ไม่มีข้อมูลใน Local Storage จึงเห็นสถานะว่างหรือไม่พบรายการ ไม่ใช่หลักฐานว่าการสร้างรอบ รายงาน หรือ Snapshot ผ่าน

ไม่มีการเชื่อมฐานข้อมูลส่วนกลาง ไม่มีข้อมูลบุคคลจริง และไม่มีการบันทึกร่าง Wizard ลงทะเบียนสถานี
