# ADR 0002: WIM Sorting System Instance per Installed Lane

สถานะ: ยอมรับ

## Context

Station Profile ต้องแยก `Lane` ซึ่งเป็นโครงสร้างช่องจราจรจริง ออกจาก `WIM Sorting System` ซึ่งเป็นจำนวนระบบชั่งที่ติดตั้งจริงตาม BOQ/หน้างาน จำนวน Sensor และ Loop ของแต่ละระบบไม่ตายตัว และไม่ควรใช้จำนวนอุปกรณ์ลูกเพื่อคำนวณจำนวนระบบแม่

## Decision

- เก็บ WIM Sorting System ที่ติดตั้งจริงเป็น System record แยกราย instance โดยหนึ่ง instance ผูกกับหนึ่ง physical Lane และมี `quantity: 1`
- WIM Sensor และ WIM Loop ต้องผูกด้วย `parentSystemId` ไปยัง WIM Sorting System Instance; Lane ของลูก derive จากระบบแม่
- เก็บ physical Lane ทุกช่องไว้ใน topology ต่อให้ไม่มี WIM Sorting System เช่น ถนนมี 3 Lane แต่ติดตั้ง WIM 2 ระบบ ให้มี WIM instance แค่ 2 รายการ
- หมายเลข Lane ไม่ซ้ำภายใน Scope เดียวกัน แต่ซ้ำข้าม Scope ได้; ID ของ Lane เป็นตัวอ้างอิงหลักสำหรับความสัมพันธ์และรายการตรวจ
- จำนวน Sensor/Loop ใต้แต่ละระบบเป็นข้อมูลจริงที่ปรับได้อิสระ ไม่บังคับสูตรหรือจำนวนขั้นต่ำ
- Present MA/TOR quantity ยังคงเป็น reference แยกจาก Installed Quantity
- การสร้าง Snapshot ใหม่เก็บ parent relationship และ Lane ที่ derive แล้ว แต่ Snapshot/ประวัติเดิมต้องไม่ถูกเขียนทับหรือ migrate แบบตีความย้อนหลัง

## Consequences

ผู้ใช้ต้องเพิ่ม WIM Sorting System และเลือก Lane ก่อน จึงจะเพิ่ม Sensor/Loop ได้ ระบบตรวจ duplicate WIM system ต่อ Lane และแจ้ง parent ที่หายหรือไม่ถูกต้องก่อนเริ่มรอบตรวจ Checklist 2.1 ของรอบใหม่จะแสดงเฉพาะ Sensor/Loop ที่มี parent ที่ถูกต้อง พร้อมบริบท Instance/Lane ส่วน Lane ที่ไม่มี WIM ยังคงใช้กับ Checklist ของระบบอื่นได้ตามปกติ
