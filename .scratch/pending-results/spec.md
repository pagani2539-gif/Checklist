# แจ้งผลตรวจที่ยังไม่ครบ
Status: ready-for-human

เพิ่มคำเตือนและลิงก์ไปผลตรวจที่ค้างบน RoundCard และ ChecklistPage; แสดงรายการให้เลือกเมื่อค้างหลายข้อ ใช้นโยบายการนับเดิม ไม่เปลี่ยนผลตรวจ หลักฐาน หรือประวัติ

ตรวจผ่าน: test_pending_checklist_results, test_progress_policy, test_navigation_router; build โดย Vite โดยตรง; เบราว์เซอร์บริการ 5220 ตรวจลิงก์บนการ์ด ปุ่มไปข้อค้าง รายการหลายข้อ และมือถือ 390px ไม่ล้นแนวนอน; health/ready และ HTML/assets ตรง release/public

npm run build ยังติดข้อเดิมใน test_shared_select_usage ที่ ImageAnnotationEditor.jsx; ไม่แก้งานอื่นในรอบนี้
