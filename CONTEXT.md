# Checklist Operations

ระบบจัดการข้อมูลสถานี อุปกรณ์ และรอบตรวจบำรุงรักษา โดยแยกข้อกำหนดตาม TOR ออกจากทะเบียนอุปกรณ์จริงและ Snapshot ของรอบตรวจ

## Language

**แม่แบบสถานี (Station Template)**:
ชุดค่าเริ่มต้นสำหรับสร้าง Station Profile มีเพียง SC และ IMPS และไม่ใช่ทะเบียนอุปกรณ์ของสถานีใดสถานีหนึ่ง
_Avoid_: TOR สถานี, รายการอุปกรณ์จริง

**รายการมาตรฐาน (Canonical Item)**:
ความหมายกลางที่มีรหัสคงที่ ใช้รวมชื่อ TOR ที่เขียนต่างกันแต่หมายถึงสิ่งเดียวกัน
_Avoid_: ชื่อ TOR, Asset

**ชื่อแสดงผล (Display Name)**:
ชื่อภาษาไทยแบบสั้นและสม่ำเสมอที่เจ้าหน้าที่เห็นในระบบ
_Avoid_: ชื่อตาม TOR

**ชื่อตาม TOR (TOR Source Name)**:
ข้อความต้นฉบับจากเอกสาร TOR ซึ่งเก็บไว้เพื่อการตรวจสอบย้อนกลับโดยไม่ใช้เป็นตัวตนหลักของรายการ
_Avoid_: ชื่อมาตรฐาน

**ชื่อหมวด BOQ/Checklist (BOQ/Checklist Category Name)**:
ชื่อหมวดที่ผู้ปฏิบัติงานเห็น เช่น `WIM SORTING SYSTEM (SENSOR)`, `WIM CONTROL SYSTEM` และ `WIM Electronics System for IMPS` ให้คงชื่อเดิมตาม BOQ/TOR พร้อมรหัสหมวด เช่น `2.1`, `2.2`, `2.3`; การใช้ภาษาไทยให้จำกัดอยู่ที่คำอธิบาย ปุ่ม และป้ายช่องกรอก ไม่แปลชื่อหมวดแยกกันในแต่ละหน้า
_Avoid_: แปลหรือย่อชื่อหมวดไม่เหมือนกันระหว่าง Station, Checklist และ Report

**หมวดหลักอุปกรณ์/ระบบ (Equipment Main Category)**:
กลุ่มแม่สำหรับจัดทะเบียนอุปกรณ์และระบบ โดยใช้ลำดับกลางเดียวกันทุกหน้าคือ `WIM`, `LPR`, `CCTV`, `3D Dimension`, `Image Processing`, `VMS`, `Data/Control` และ `Station Infrastructure`; รหัสหมวด BOQ/Checklist เช่น `2.1`, `3.2`, `1.1.5` และ `1.1.11` เป็นหมวดย่อยภายในกลุ่มแม่ ไม่ใช่ชื่อกลุ่มแม่
_Avoid_: ใช้ชุดระบบแสดงผล `SC-01` ถึง `SC-06` แทนหมวดหลักอุปกรณ์ หรือจัด `1.1 การแสดงความพร้อม` เป็น Asset category

**รายการ TOR ประจำสถานี (Station TOR Item)**:
ข้อกำหนดหนึ่งบรรทัดของสถานี ระบุหมวด ขอบเขต ปริมาณ และหน่วยตามเอกสาร และอาจอ้างถึง Asset, System หรือ Service
_Avoid_: Asset

**รายการ TOR แสดงผล (Station TOR Presentation Item)**:
รูปแบบที่ผู้ใช้เห็นจากรายการ TOR ซึ่งอาจรวม Source Row ที่มีความหมายเดียวกันภายใต้ Scope เดียวกัน เช่น ป้าย VMS ของ High Speed หรือ Low Speed ให้แสดงเป็น `VMS Sign` เพียงหนึ่งรายการต่อ Scope และรวมจำนวนไว้ในแถวนั้น โดยเก็บ Source Row ID และชื่อ TOR ต้นฉบับแยกไว้สำหรับตรวจสอบย้อนหลัง
_Avoid_: ใช้ชื่อหรือขนาดจาก Source Row เป็นชื่อมาตรฐาน หรือรวมป้าย VMS ข้าม High Speed กับ Low Speed

**Asset**:
อุปกรณ์กายภาพที่ขึ้นทะเบียนแยกรายตัวหรือรายชุด และอาจมี Asset No. หรือ Serial No.
_Avoid_: ระบบ, งานบริการ

**System**:
ระบบควบคุม ซอฟต์แวร์ หรือความสามารถที่ TOR นับเป็นระบบ แต่ไม่จำเป็นต้องมีทะเบียนรายเครื่อง
_Avoid_: Asset

**LPR relationship**:
`License Plate Recognition Control System` เป็น System เดียวที่ควบคุม LPR Camera ทุก Scope ที่ติดตั้งจริง ได้แก่ SC High Speed, SC Low Speed, SC 3D, IMPS และ IMPS 3D; `LPR Camera` เป็น Asset ปลายทางเพียงรายการเดียวในทะเบียน LPR รุ่นปัจจุบัน ส่วน `LPR Control System Equipment` เป็นชื่อ Asset รุ่นเก่าที่อ่านได้เฉพาะข้อมูลเดิมและไม่ใช้สร้างรายการใหม่
_Avoid_: สร้าง `LPR Control System Equipment` เป็น Asset แยกใน Station Profile หรือ Checklist รอบใหม่

**WIM Electronics System**:
ระบบแม่ในหมวด 2.3 ที่รวม Cabinet และอุปกรณ์อิเล็กทรอนิกส์ของระบบ WIM โดยตัวระบบไม่ใช่ Asset รายเครื่อง
_Avoid_: การนับแรงดันภายใน Switching DC เป็น System แยก

**อุปกรณ์ย่อย WIM Electronics**:
อุปกรณ์กายภาพภายใต้ WIM Electronics System ที่ขึ้นทะเบียนแยกรายตัวได้ เช่น WIM Controller, AC/DC, Network และ Switching DC
_Avoid_: การใช้ช่องตรวจตายตัวแทนจำนวนติดตั้งจริง

**จุดตรวจไฟฟ้า (Electrical Inspection Point)**:
ค่าหรือจุดตรวจภายใน Asset เช่น Main Current, Breaker Output, Cal Factor และแรงดัน Output ของ Switching DC ซึ่งไม่จำเป็นต้องมี Asset No. แยก
_Avoid_: การสร้างจุดวัดทุกจุดเป็น Asset จริง

**Switching DC Output**:
แรงดัน Output ภายใน Switching DC ที่เลือกได้ตามหน้างาน ได้แก่ 12VDC, 24VDC และ 48VDC โดย 24VDC ต้องแยกจาก 24VAC
_Avoid_: การตีความลำดับเดิม `switching-dc-01` ว่าเป็นแรงดันใดโดยอัตโนมัติ

**Service**:
งานติดตั้ง เชื่อมต่อ หรือส่งมอบผลลัพธ์ที่ตรวจสถานะงาน แต่ไม่สร้างทะเบียนอุปกรณ์
_Avoid_: Asset, System

**ปริมาณตาม TOR (TOR Quantity)**:
จำนวนที่อ่านจากเอกสารและต้องตีความร่วมกับหน่วยตาม TOR เสมอ
_Avoid_: จำนวน Asset จริง

**จำนวนติดตั้งจริง (Installed Quantity)**:
จำนวน Asset หรือระบบที่ยืนยันว่ามีอยู่ใน Station Profile ปัจจุบัน
_Avoid_: ปริมาณตาม TOR

**ขอบเขตการใช้งาน (Operational Scope)**:
บริบทที่รายการทำงาน ได้แก่ High Speed, Low Speed, 3D, Image Processing, ImPS, Central หรือ Station-wide โดยไม่สร้างชนิดรายการซ้ำเพราะคำต่อท้าย; Image Processing ใช้กับระบบประมวลผลภาพและกล้องที่ทำหน้าที่เป็น image input ส่วน ImPS ยังคงรองรับงาน CCTV ทั่วไปและข้อมูลเดิม

**ชุดระบบ Checklist (Checklist System Group)**:
กลุ่มแสดงผลที่รวบรวมอุปกรณ์และซอฟต์แวร์ตามระบบที่ใช้งานจริง เช่น WIM High Speed, 3D หรือ VMS for Low Speed; ขนาดอุปกรณ์ไม่ใช่ชื่อชุด
_Avoid_: การใช้รหัส BOQ หรือชนิดอุปกรณ์เป็นตัวแทนชุดที่ติดตั้งจริง

**ภาค/พื้นที่ (Region)**:
พื้นที่ภูมิศาสตร์ที่ใช้กรองและจัดกลุ่มสถานีตามข้อมูลสัญญาและการรายงาน ภาคไม่ใช่คุณสมบัติเดี่ยวของสัญญา และสัญญาหนึ่งฉบับครอบคลุมได้หลายภาค
_Avoid_: บังคับให้หนึ่ง Contract อยู่ได้เพียงภาคเดียว

**สัญญา (Contract)**:
บริบทหลักของงานที่เก็บเลขที่สัญญา โครงการ วันที่สัญญา ผู้รับจ้าง หน่วยงาน และภาคที่ครอบคลุม สถานีเดิมย้ายไปสัญญาใหม่ได้โดยไม่แก้ประวัติเดิม
_Avoid_: เก็บ `contractNo` เป็น metadata ของรอบตรวจอย่างเดียว

**ข้อมูลกลางคู่สัญญา (Contract Party Master Data)**:
รายการมาตรฐานของผู้รับจ้างตามชื่อบริษัทตามกฎหมายและหน่วยงานเจ้าของงานที่ใช้ร่วมกันหลายสัญญา โดย Contract เลือกจากรายการกลางนี้ ผู้รับจ้างไม่ใช่รูปแบบหัวรายงาน เช่น NTR, LTP หรือ iSMART
_Avoid_: สร้างชื่อคู่สัญญาใหม่ซ้ำในฟอร์ม Contract หรือใช้ชื่อรูปแบบหัวรายงานแทนชื่อบริษัทตามกฎหมาย

**งวดงาน (Work Package)**:
ช่วงงานหรือครั้งที่รายงานภายใต้ Contract ซึ่งหนึ่งงวดผูกได้หลายสถานี ใช้จัดกลุ่มและค้นหางานได้ แต่ไม่จำเป็นต้องเลือกก่อนเริ่ม Inspection Round
_Avoid_: บังคับเลือก Contract และงวดก่อนเริ่ม Checklist

**Contract Station Assignment**:
ความสัมพันธ์ตามช่วงเวลาระหว่าง Contract/Work Package กับ Station Profile โดย assignment เดิมเปลี่ยนเป็น inactive ได้ แต่ไม่ลบเพื่อรักษาประวัติการย้ายสัญญา
_Avoid_: เขียนทับสัญญาเดิมของสถานีโดยไม่มีช่วงเวลาและประวัติ

**Contract Work Report**:
รายงานหน้าปกงานตาม Contract และ Work Package แยกจาก Station Inspection Report โดย Snapshot ของรายงานต้องเก็บเลขสัญญา งวด ภาค สถานี และจังหวัด ณ เวลาที่จัดทำ
_Avoid_: ใช้หน้าปก NTR/LTP/IS8 แทนหน้าปกงานสัญญา

**Station Inspection Report**:
รายงานผลตรวจสถานีของ NTR/LTP/IS8 ที่อ้างถึง Inspection Round และ Snapshot เดิม เริ่มรอบด้วยสถานีและวันที่ตรวจได้โดยไม่เลือกสัญญา ระหว่างตรวจพิมพ์ฉบับร่างจากข้อมูลปัจจุบันได้โดยไม่ปิดรอบและไม่บันทึกเป็นรายงานฉบับสมบูรณ์ หลังปิดรอบจึงกรอกหน้าปกแยกใน `stationInspectionReports`; การเชื่อม Contract/Work Package ภายหลังใช้ค้นหาและจัดกลุ่มเท่านั้น ไม่เติมหรือแก้หน้าปก ผลตรวจ หลักฐาน หรือ Snapshot และฉบับรายงานที่สร้างแล้วเก็บเป็นประวัติ
_Avoid_: รวมหน้าปกงานสัญญากับผลตรวจสถานี หรือดึงเลขสัญญาที่เชื่อมมาเติมหน้าปกเอง

**เลขหมวดแสดงผล (Checklist Display Number)**:
เลขลำดับของชุดและรายการตรวจที่ใช้จัดหน้า Checklist โดยไม่ใช่ตัวตนของรายการตรวจหรือรหัสอ้างอิง BOQ
_Avoid_: Checklist Item ID, BOQ Source Reference

**Snapshot**:
สำเนาข้อมูลสถานีและรายการตรวจ ณ เวลาเริ่มรอบ ซึ่งไม่เปลี่ยนตามการแก้แม่แบบหรือ Station Profile ภายหลัง
_Avoid_: Station Profile ปัจจุบัน

**WIM Sorting System Instance**:
ระบบ `WIM Sorting System` ที่ติดตั้งจริงหนึ่งระบบต่อหนึ่ง Lane ที่เป็นช่องชั่ง WIM โดยเก็บเป็น System record แยกราย instance และมี `quantity: 1`
_Avoid_: การใช้จำนวน Sensor หรือ Loop เป็นจำนวน WIM Sorting System
รอบใหม่เก็บภาพติดตั้ง Sensor จริงและภาพผลประมวลค่าน้ำหนักแยกตามระบบ/Scope; ภาพหน้างานของ Loop เก็บแยกตาม Loop

**WIM-enabled Lane**:
Lane ในโครงสร้างช่องจราจรที่มี WIM Sorting System ติดตั้งอยู่จริง โดย Lane topology ยังคงเก็บทุกช่องจราจร แม้บางช่องจะไม่มีระบบ WIM
หมายเลข Lane แยกนับภายใน Operational Scope เดียวกันได้ เช่น High Speed Lane 1 และ Low Speed Lane 1 เป็นคนละ Lane record; ID ของ Lane เป็นตัวตนอ้างอิงหลัก
_Avoid_: การสร้าง Lane เพิ่มเพื่อให้จำนวนตรงกับระบบ WIM

**Parent WIM System**:
ความสัมพันธ์ที่ WIM Sensor หรือ WIM Loop ต้องเก็บ `parentSystemId` ไปยัง WIM Sorting System Instance และรับ Lane จากระบบแม่
_Avoid_: การผูก Sensor หรือ Loop กับ Lane โดยตรงเป็นความสัมพันธ์หลัก

**Vehicle API Review Scope**:
ขอบเขตการตรวจผลรถจาก API ที่แยกผลและสถานะออกจากกันภายในรายการตรวจเดียว เช่น กลางวันและกลางคืน โดยไม่สร้างหน้าตรวจซ้ำ
_Avoid_: การรวมผลต่างช่วงเวลาเป็นสถานะหรือ accuracy เดียวโดยไม่ระบุขอบเขต

**Daypart**:
การจัดกลุ่มเหตุการณ์รถเป็นกลางวันหรือกลางคืนจาก `eventAt`/`occurredAt` ในเวลา `Asia/Bangkok` ตาม policy version ที่ถูกบันทึกไว้กับ Snapshot
_Avoid_: การใช้เวลาที่ผู้ตรวจเปิดหน้า หรือเวลาที่กดดึง API เป็นตัวแทนเวลาเหตุการณ์

**ข้อมูลส่วนกลาง (Central Persistence)**:
แหล่งข้อมูลร่วมที่เก็บ Station Profile ปัจจุบัน รอบการตรวจ Snapshot และหลักฐาน/ประวัติที่ผู้มีสิทธิ์ตามขอบเขตสถานีต้องเห็นเป็นชุดเดียวกัน
_Avoid_: ถือ local draft ของ browser เครื่องหนึ่งเป็นประวัติส่วนกลาง

**ฉบับร่างออฟไลน์ (Offline Draft)**:
ข้อมูลการแก้ไขที่ยังส่งเข้า Central Persistence ไม่สำเร็จและรอการส่งซ้ำ ฉบับร่างออฟไลน์ไม่ใช่ Snapshot ที่ปิดรอบแล้ว
_Avoid_: เรียกข้อมูลที่ยังไม่ sync ว่าเป็นประวัติที่ยืนยันแล้ว
