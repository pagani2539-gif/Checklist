# Checklist Operations Hub — Route Map

| Route | หน้าที่ | สิ่งที่อนุญาตให้แก้ |
|---|---|---|
| `#/dashboard` | ภาพรวมสถานีและรอบล่าสุด | ตัวกรองสถานีเท่านั้น |
| `#/contracts` | เปลี่ยนเส้นทางไป `#/dashboard`; ไม่มีหน้าศูนย์สัญญาแล้ว | — |
| `#/contracts/new` | สร้าง Contract และเลือก Region ได้หลายภาค | ข้อมูลสัญญาและพื้นที่ครอบคลุม |
| `#/contracts/:contractId` | Contract Detail: ภาพรวม งาน/งวด สถานี รายงาน เอกสาร | เพิ่มงวดงาน; ข้อมูลสถานีมาจาก assignment |
| `#/contracts/:contractId/edit` | แก้ข้อมูลหลักของ Contract | ข้อมูลสัญญาก่อนจัดทำหน้าปก |
| `#/contracts/:contractId/cover` | จัดทำหน้าปกสัญญาหลัก | ข้อมูลคู่สัญญา ขอบเขตงาน และเงื่อนไขตามเอกสารจริง |
| `#/contracts/:contractId/work-packages/:workPackageId` | เลือกหลายสถานีในงวดและเริ่มรอบตรวจจาก context เดียวกัน | Contract Station Assignment; ย้ายสถานีเก็บประวัติเดิม |
| `#/contracts/:contractId/work-packages/:workPackageId/reports/new` | สร้าง/preview Contract Work Report | หน้าปกงานตามสัญญาและงวด |
| `#/reference-data` | จัดการข้อมูลมาตรฐานผู้รับจ้างและหน่วยงาน | Master Data คู่สัญญา |
| `#/stations` | ทะเบียนสถานีและอุปกรณ์จริง | ค้นหา/เปิดรายละเอียดสถานี; สถานีปิดใช้งานยังแสดงอยู่ |
| `#/stations/:stationId` | รายละเอียดข้อมูลประจำสถานี (Station Profile) และทะเบียนอุปกรณ์จริง | แก้ข้อมูลปัจจุบัน; ปิดใช้งาน/เปิดใช้งานแทนการลบเมื่อมีประวัติ |
| `#/stations/new` | Wizard สร้างข้อมูลประจำสถานี (Station Profile) ใหม่ | ฉบับร่างใน Wizard จนกว่าจะยืนยัน |
| `#/inspections` | รายการรอบการตรวจ | ตัวกรองและการเปิดรอบการตรวจ |
| `#/inspections/new` | Wizard 3 ขั้น: เลือก Contract/Work Package/Station และข้อมูลรอบ → ตรวจข้อมูล ณ วันที่เริ่มรอบ → ยืนยัน | ยังไม่แก้ผลตรวจ |
| `#/inspections/new?mode=quick` | สร้างรอบตรวจหน้างานเฉพาะกิจโดยไม่ผูกสัญญา | ข้อมูลรอบและสถานีที่เลือก |
| `#/inspections/:roundId` | รายการตรวจและหลักฐานทีละรายการ | ข้อมูลประจำรอบ, value, status, note และ evidence ของฉบับร่างรอบนั้น |
| `#/inspections/:roundId/vehicle-api/:context` | พื้นที่ตรวจผล Vehicle API ของรอบเปิด (`plate` หรือ `classification`) | ผล review และ evidence ของรอบนั้น; round ที่ปิดแล้วอ่านอย่างเดียว |
| `#/history` | ประวัติรอบการตรวจที่ปิดแล้ว | ตัวกรองและการเปิดดูแบบอ่านอย่างเดียว |
| `#/history/:roundId` | ข้อมูล ณ วันที่เริ่มรอบการตรวจแบบอ่านอย่างเดียว | ไม่มี field แก้ไข |
| `#/history/:roundId/vehicle-api/:context` | พื้นที่อ่านผล Vehicle API จาก Snapshot เดิม | ไม่มี field แก้ไข |
| `#/history/:roundId/revise` | จัดทำฉบับแก้ไขจากรอบการตรวจที่ปิดแล้ว | reason และฉบับร่างใหม่; ไม่เขียนทับรอบเดิม |
| `#/admin/users` | จัดการบัญชีผู้ใช้ | สร้างบัญชี กำหนด role/station หรือระงับบัญชี |

กติกา: `contractId` และ `workPackageId` เป็น context ของงาน/งวด ส่วน `roundId` เป็น context หลักของรายการตรวจและหลักฐาน; หน้า Checklist ห้ามแก้ข้อมูลประจำสถานี และหน้าประวัติห้าม mutate หรือลบรอบการตรวจที่ปิดแล้ว ข้อมูลฉบับแก้ไขต้องคัดลอกข้อมูล ณ วันที่เริ่มรอบการตรวจ (Snapshot) และผลตรวจเดิมเสมอ `context=plate` ตรวจป้ายทะเบียน ส่วน `context=classification` ตรวจประเภท/เพลา/น้ำหนักแยกตาม scope กลางวัน-กลางคืน ลิงก์ legacy `?edit=1` redirect ไป `history/:roundId/revise` และ custom hash router รองรับ deep link, refresh และ back/forward ตามชุดตรวจ navigation ปัจจุบัน.
