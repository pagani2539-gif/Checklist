# 01: กำหนดค่าเริ่มต้นสองเลนสำหรับรูปแบบสถานี SC และ IMPS

**What to build:** เมื่อผู้ใช้สร้างสถานีใหม่และเลือกรูปแบบสถานี SC หรือ IMPS ระบบต้องสร้าง Lane topology เริ่มต้นสองเลน ผู้ใช้ยังเพิ่ม ลด และแก้ชื่อเลนก่อนบันทึก Station Profile ได้

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] การเลือก SC สร้าง Lane topology เริ่มต้น 2 เลน
- [x] การเลือก IMPS สร้าง Lane topology เริ่มต้น 2 เลน
- [x] ผู้ใช้เปลี่ยนจำนวนหรือชื่อเลนก่อนบันทึกได้
- [x] อุปกรณ์ WIM ที่สร้างอัตโนมัติผูกกับเลนที่มีอยู่เท่านั้น
- [x] การเปลี่ยนค่าเริ่มต้นไม่แก้ Station Profile หรือ Inspection Snapshot ที่บันทึกไว้แล้ว
- [x] การทดสอบระดับ station creation ยืนยันพฤติกรรมทั้ง SC และ IMPS

## Result

ค่าเริ่มต้นของ SC และ IMPS เปลี่ยนเป็นสองเลนแล้ว แต่ละเลนเริ่มต้นด้วย WIM Sensor 4 แท่งและ Loop 2 ชุด รวมเป็น Sensor 8 และ Loop 4 ต่อสถานี อุปกรณ์กระจายแบบวนรอบเฉพาะ Lane topology ที่สร้างขึ้น การทดสอบ station creation, station lifecycle, checklist coverage และ evidence checklist ผ่าน รวมถึง production build
