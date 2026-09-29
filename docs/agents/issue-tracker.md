# Issue tracker: Local Markdown

Issues และ specs ของโปรเจกต์นี้เก็บเป็นไฟล์ Markdown ภายใต้ `.scratch/`

## Conventions

- หนึ่ง feature ต่อหนึ่ง directory: `.scratch/<feature-slug>/`
- Spec ใช้ชื่อ `.scratch/<feature-slug>/spec.md`
- Implementation issues แยกหนึ่งไฟล์ต่อหนึ่ง ticket ที่ `.scratch/<feature-slug>/issues/<NN>-<slug>.md`
- Ticket เรียงหมายเลขจาก `01` ตามลำดับ dependency โดย blocker อยู่ก่อน
- สถานะ triage บันทึกด้วยบรรทัด `Status:` ใกล้ส่วนต้นของไฟล์
- Comments และประวัติการสนทนาเพิ่มต่อท้ายภายใต้หัวข้อ `## Comments`

## Publishing

เมื่อ skill ระบุให้ publish ไปยัง issue tracker ให้สร้างไฟล์ใหม่ใต้ `.scratch/<feature-slug>/` ตามโครงสร้างข้างต้น

## Fetching

เมื่อ skill ระบุให้ดึง ticket ที่เกี่ยวข้อง ให้อ่านไฟล์จาก path หรือหมายเลข issue ที่ผู้ใช้ระบุ

## Wayfinding operations

- Map: `.scratch/<effort>/map.md`
- Child ticket: `.scratch/<effort>/issues/NN-<slug>.md`
- Ticket ระบุชนิดด้วย `Type:` และสถานะด้วย `Status:`
- Blocking ระบุด้วย `Blocked by: NN, NN`; ticket จะเริ่มได้เมื่อ blocker ทุกใบเป็น `resolved`
- Frontier คือ ticket ที่ยังเปิด ไม่มี blocker ค้าง และยังไม่มีผู้รับงาน โดยหมายเลขน้อยกว่ามีลำดับก่อน
- Claim โดยเปลี่ยน `Status:` เป็น `claimed`
- Resolve โดยเพิ่มคำตอบใต้ `## Answer`, เปลี่ยนสถานะเป็น `resolved` และเพิ่ม context pointer ใน map
