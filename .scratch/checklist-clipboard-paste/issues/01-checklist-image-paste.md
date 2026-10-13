Type: implementation
Status: resolved

# เพิ่มการวางรูปในช่องหลักฐาน Checklist

**What to build:** เพิ่มจุดรับรูปจากคลิปบอร์ดในช่องรูปของ Checklist และบันทึกผ่านเส้นทางหลักฐานเดิม

## Answer

เพิ่มปุ่มโฟกัสสำหรับ `Ctrl+V` ในช่องรูปของ Checklist รองรับการแนบครั้งแรกและเปลี่ยนรูป การวางแบบข้อความไม่ถูกดัก และหน้าตรวจ Vehicle API ไม่ได้รับการเปลี่ยนแปลง

## Comments

- ตรวจ `tools/test_attachment_picker.mjs`, สร้าง Vite build และจำลองการวาง PNG ในเบราว์เซอร์กับรอบ Demo
- ลบรูปทดสอบหลังตรวจเสร็จ
