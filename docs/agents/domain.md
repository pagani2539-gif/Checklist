# Domain docs

แนวทางสำหรับ Engineering Skills เมื่ออ่านเอกสารโดเมนของโปรเจกต์นี้

## Before exploring

- อ่าน `CONTEXT.md` ที่ root เมื่อไฟล์มีอยู่
- อ่าน ADR ที่เกี่ยวข้องใน `docs/adr/`
- หากไฟล์ยังไม่มี ให้ดำเนินงานต่อโดยไม่สร้างคำศัพท์หรือการตัดสินใจใหม่โดยไม่จำเป็น

## Layout

โปรเจกต์นี้ใช้รูปแบบ single-context:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Vocabulary

ใช้คำศัพท์ตาม `docs/glossary.md` จนกว่าจะมี `CONTEXT.md` โดยเฉพาะคำว่า Station Profile, Inspection Snapshot, Mapping 3 ชั้น, Lane topology, อุปกรณ์จริง (Asset), รายการตรวจ และช่องหลักฐานประกอบการตรวจ (Evidence Slot)

## ADR conflicts

หากข้อเสนอขัดกับ ADR ที่ยอมรับแล้ว ต้องระบุความขัดแย้งอย่างชัดเจน ห้ามเปลี่ยนสถาปัตยกรรมโดยเงียบ ๆ
