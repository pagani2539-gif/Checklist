from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "onsite-inspection-handbook-a4.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = A4
MARGIN = 15 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

INK = colors.HexColor("#152238")
INK_SOFT = colors.HexColor("#30415A")
MUTED = colors.HexColor("#63738A")
BLUE = colors.HexColor("#2563EB")
BLUE_DARK = colors.HexColor("#1D4ED8")
BLUE_PALE = colors.HexColor("#EFF6FF")
GREEN = colors.HexColor("#0F9F80")
GREEN_PALE = colors.HexColor("#ECFDF5")
AMBER = colors.HexColor("#B45309")
AMBER_PALE = colors.HexColor("#FFF7ED")
RED = colors.HexColor("#B91C1C")
LINE = colors.HexColor("#D7E0EC")
PAPER = colors.HexColor("#F7F9FC")
WHITE = colors.white

FONT_REG = "TahomaGuide"
FONT_BOLD = "TahomaGuide-Bold"
pdfmetrics.registerFont(TTFont(FONT_REG, r"C:\Windows\Fonts\tahoma.ttf"))
pdfmetrics.registerFont(TTFont(FONT_BOLD, r"C:\Windows\Fonts\tahomabd.ttf"))

BODY = ParagraphStyle(
    "body",
    fontName=FONT_REG,
    fontSize=8.6,
    leading=11.5,
    textColor=INK_SOFT,
    alignment=TA_LEFT,
)
BODY_SMALL = ParagraphStyle("body-small", parent=BODY, fontSize=7.4, leading=9.4)
HEAD = ParagraphStyle(
    "head",
    fontName=FONT_BOLD,
    fontSize=13,
    leading=16,
    textColor=INK,
)
TITLE = ParagraphStyle(
    "title",
    fontName=FONT_BOLD,
    fontSize=20,
    leading=24,
    textColor=INK,
)
LABEL = ParagraphStyle(
    "label",
    fontName=FONT_BOLD,
    fontSize=8.2,
    leading=10.5,
    textColor=BLUE_DARK,
)
TABLE_ITEM = ParagraphStyle(
    "table-item",
    fontName=FONT_REG,
    fontSize=8.2,
    leading=10.6,
    textColor=INK_SOFT,
)
TABLE_HEADER = ParagraphStyle(
    "table-header",
    fontName=FONT_BOLD,
    fontSize=7.1,
    leading=8.8,
    textColor=BLUE_DARK,
    alignment=TA_CENTER,
)


# This is intentionally a short field guide, not the 170-row Evidence Catalog.
# Each row represents a field task and is repeated by the contractor for every
# real Asset or Lane where the row applies.
CHECKLIST_GROUPS = [
    {
        "code": "1.1",
        "title": "ความพร้อมและความปลอดภัย",
        "scope": "SC / IMPS",
        "rows": [
            ("ตรวจพนักงานผู้ปฏิบัติงานพร้อมเข้าหน้างาน", "มีผู้ปฏิบัติงานครบตามแผน และใช้อุปกรณ์ป้องกันส่วนบุคคล"),
            ("ตรวจยานพาหนะและรถเครนที่ใช้ทำงาน", "สภาพพร้อมใช้งาน และระบุคันที่ใช้ในงานนี้"),
            ("ตรวจเครื่องมือช่างและเครื่องมือวัด", "พร้อมใช้งาน และเหมาะกับงานที่จะดำเนินการ"),
            ("ตรวจการกั้นพื้นที่และความปลอดภัยจราจร", "กรวย ป้ายไฟ และแนวปิดพื้นที่พร้อมก่อนเริ่มงาน"),
        ],
    },
    {
        "code": "2.1",
        "title": "ระบบตรวจจับ WIM (Sensor และ Loop)",
        "scope": "ตามอุปกรณ์ / Lane จริง",
        "rows": [
            ("ตรวจพื้นที่ติดตั้ง WIM และสภาพหน้างาน", "ตรวจทุกจุดที่ติดตั้งจริง และบันทึก Lane ที่เกี่ยวข้อง"),
            ("ตรวจ Sensor WIM รายตัวและบันทึกค่าที่วัดได้", "ทำซ้ำทุก Sensor ที่มีจริง พร้อมผูกกับ Lane ให้ถูกต้อง"),
            ("ตรวจ Loop WIM รายตัวและบันทึกค่าที่วัดได้", "ทำซ้ำทุก Loop ที่มีจริง พร้อมผูกกับ Lane ให้ถูกต้อง"),
            ("ตรวจการรับสัญญาณและการทำงานของระบบ WIM", "ทดสอบตามขั้นตอนงาน และบันทึกผลที่พบจริง"),
        ],
    },
    {
        "code": "2.2 - 2.3",
        "title": "WIM Control และ WIM Electronics",
        "scope": "ตามอุปกรณ์จริง",
        "rows": [
            ("ตรวจ Computer ควบคุม WIM รายเครื่อง", "ตรวจสภาพ รุ่น Serial No. และการเชื่อมต่อ LAN"),
            ("ตรวจสายและจุด LAN ของระบบควบคุม WIM", "ป้ายสายและการเชื่อมต่อถูกต้องตามอุปกรณ์จริง"),
            ("ตรวจตู้ WIM Electronics ภายนอกและภายใน", "ทำซ้ำทุกตู้ ตรวจความเรียบร้อยและอุปกรณ์ภายใน"),
            ("ตรวจอุปกรณ์ AC/DC, Network และ Controller", "ตรวจป้าย อุปกรณ์จริง และสภาพพร้อมใช้งาน"),
            ("ตรวจ WIM Controller และค่า Cal Factor", "ข้อมูลตรงกับอุปกรณ์และการตั้งค่าที่ใช้งานจริง"),
            ("วัดไฟฟ้าหลักและแรงดันขาออกในตู้", "บันทึกค่าจริงพร้อมหน่วย โดยไม่ใช้คำว่า ปกติ แทนค่า"),
        ],
    },
    {
        "code": "3.1 - 3.2",
        "title": "ระบบควบคุม LPR และกล้องอ่านป้ายทะเบียน",
        "scope": "ตาม Lane / อุปกรณ์จริง",
        "rows": [
            ("ทดสอบอ่านป้ายทะเบียนร่วมกับ WIM ราย Lane", "ทดสอบช่วงกลางวัน และบันทึกผลแยกทีละ Lane"),
            ("ทดสอบค้นหาผลป้ายทะเบียนกลับราย Lane", "ค้นผลที่บันทึกไว้ และยืนยันว่าเชื่อมกับ Lane ถูกต้อง"),
            ("ตรวจกล้อง LPR รายตัว", "ตรวจตำแหน่ง ทิศทาง รุ่น Serial No. และสภาพกล้อง"),
            ("ตรวจทำความสะอาดและแรงดันกล้อง LPR รายตัว", "ทำซ้ำทุกกล้องที่มีจริง และบันทึกค่าที่วัดได้"),
        ],
    },
    {
        "code": "4.1 - 4.2",
        "title": "กล้อง CCTV และเครื่องบันทึกภาพ NVR",
        "scope": "ตามอุปกรณ์จริง",
        "rows": [
            ("ตรวจกล้อง CCTV แบบ Fixed / PTZ รายตัว", "ตรวจตำแหน่ง รุ่น Serial No. ภาพ และสภาพพร้อมใช้งาน"),
            ("ตรวจภาพสดและการควบคุม PTZ", "ใช้เมื่อสถานีมี PTZ และทดสอบการปรับมุมมองได้จริง [SC]"),
            ("ตรวจ SD Card ของกล้อง Fixed", "ใช้เมื่อมีอุปกรณ์หรือมีการกำหนดให้ตรวจในสถานี"),
            ("ตรวจ NVR รายเครื่องและสาย LAN", "ตรวจรุ่น Serial No. สาย LAN และสถานะพร้อมบันทึก"),
            ("ตรวจ HDD และสถานะการบันทึกภาพ", "ตรวจว่าพื้นที่จัดเก็บและการบันทึกทำงานตามจริง"),
            ("ทดสอบเรียกดูภาพย้อนหลัง", "ทดสอบจาก NVR และบันทึกระยะเวลาที่เรียกดูได้"),
        ],
    },
    {
        "code": "5.1 - 5.2 - 6.1",
        "title": "Database ระบบแสดงผล และโปรแกรมรายงาน",
        "scope": "ตามระบบ / อุปกรณ์จริง",
        "rows": [
            ("ตรวจ Database Server รายเครื่อง", "ตรวจสภาพ รุ่น Serial No. และการเชื่อมต่อ LAN"),
            ("ตรวจการบันทึกข้อมูลรถและป้ายทะเบียน", "ยืนยันว่าข้อมูลถูกบันทึกและค้นกลับได้"),
            ("ตรวจระบบแสดงผลและประมวลผลข้อมูล", "ตรวจเฉพาะระบบหรืออุปกรณ์ที่มีในสถานี ไม่เดาจำนวน [ตามจริง]"),
            ("ทดสอบสร้างและพิมพ์รายงาน", "ตรวจรูปแบบรายงานและผลลัพธ์ที่พิมพ์ออกมา"),
            ("ทดสอบค้นข้อมูลรถรายคันและดูหน้ารายงาน", "ค้นผลรายคันและตรวจว่าข้อมูลสัมพันธ์กัน"),
            ("ตรวจการเชื่อมต่อส่วนกลางและประวัติย้อนหลัง", "ทดสอบการเชื่อมต่อและบันทึกผลที่พบจริง"),
            ("บันทึกระยะเวลาย้อนหลังที่ค้นได้", "ระบุจำนวนเดือนที่ค้นได้จริงในช่องค่า / รหัส / หมายเหตุ"),
            ("จัดเก็บไฟล์การตั้งค่าหน้างาน SAVE FIELD CONFIG", "ตรวจว่ามีไฟล์และจัดเก็บตามขั้นตอนส่งมอบ"),
        ],
    },
    {
        "code": "6.2 - 6.3",
        "title": "ทำความสะอาดห้องและตู้ควบคุม",
        "scope": "ตามจุด / อุปกรณ์จริง",
        "rows": [
            ("ตรวจป้ายชื่อและ Asset No. ของอุปกรณ์ทุกตัว", "ป้ายอ่านได้ และตรงกับอุปกรณ์จริงในสถานี"),
            ("ทำความสะอาดห้องควบคุมตามจุดที่กำหนด", "บันทึกจุดที่ทำจริง ไม่ระบุเพียงจำนวนรวม"),
            ("จัดระเบียบสายและพื้นที่ทำงาน", "สายและพื้นที่เรียบร้อย ปลอดภัย และเข้าถึงได้"),
            ("ทำความสะอาดตู้ควบคุมภายในและภายนอก", "ทำซ้ำทุกตู้ และระบุรหัสตู้ที่ตรวจ"),
            ("ทำความสะอาดพื้นที่โดยรอบตู้ควบคุม", "ตรวจพื้นที่รอบตู้และจุดที่ดำเนินการจริง"),
            ("ตรวจความเรียบร้อยหลังงานเสร็จ", "ไม่มีวัสดุ เครื่องมือ หรือสิ่งกีดขวางตกค้าง"),
        ],
    },
    {
        "code": "7.1",
        "title": "ป้ายข้อความเปลี่ยนแปลงได้ (VMS)",
        "scope": "SC เท่านั้น / ถ้ามีติดตั้ง",
        "rows": [
            ("ตรวจภาพรวมและสภาพป้าย VMS", "ตรวจเฉพาะสถานี SC หรือจุดที่มี VMS ติดตั้งจริง"),
            ("ทดสอบการแสดงข้อความบนป้าย", "ตรวจว่าข้อความแสดงผลครบและอ่านได้"),
            ("ทดสอบเซนเซอร์วัดแสง VMS", "ตรวจการทำงานของเซนเซอร์วัดแสงตามจริง"),
            ("ตรวจการเรียงลำดับจอแสดงผล VMS", "ตรวจลำดับจอและการแสดงผลต่อเนื่อง"),
            ("จัดเก็บไฟล์การตั้งค่าหน้างาน SAVE FIELD CONFIG", "ใช้เมื่อ VMS มีการตั้งค่าหน้างาน"),
        ],
    },
]


def paragraph(text, style=BODY):
    safe = escape(str(text))
    return Paragraph(safe.replace("\n", "<br/>"), style)


def draw_paragraph(c, text, x, y_top, width, style=BODY):
    p = paragraph(text, style)
    _, height = p.wrap(width, PAGE_H)
    p.drawOn(c, x, y_top - height)
    return height


def draw_round_rect(c, x, y, width, height, fill=WHITE, stroke=LINE, radius=5, line_width=0.7):
    c.setLineWidth(line_width)
    c.setStrokeColor(stroke)
    c.setFillColor(fill)
    c.roundRect(x, y, width, height, radius, fill=1, stroke=1)


def draw_footer(c, page_no):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(MARGIN, 18 * mm, PAGE_W - MARGIN, 18 * mm)
    c.setFont(FONT_REG, 7.1)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 12.5 * mm, "คู่มือตรวจงานสำหรับผู้รับเหมา - Checklist Operations - v1.1")
    c.drawRightString(PAGE_W - MARGIN, 12.5 * mm, f"หน้า {page_no:02d}")


def draw_page_header(c, eyebrow, title, subtitle, page_no):
    c.setFillColor(BLUE)
    c.rect(0, PAGE_H - 8 * mm, PAGE_W, 8 * mm, fill=1, stroke=0)
    c.setFillColor(BLUE_DARK)
    c.setFont(FONT_BOLD, 8.5)
    c.drawString(MARGIN, PAGE_H - 22 * mm, eyebrow)
    title_top = PAGE_H - 28 * mm
    title_height = draw_paragraph(c, title, MARGIN, title_top, CONTENT_W, TITLE)
    draw_paragraph(c, subtitle, MARGIN, title_top - title_height - 6 * mm, CONTENT_W, BODY)
    draw_footer(c, page_no)


def draw_section_bar(c, x, y_top, width, code, title, scope):
    height = 11 * mm
    draw_round_rect(c, x, y_top - height, width, height, fill=INK, stroke=INK, radius=4)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 9.2)
    c.drawString(x + 5 * mm, y_top - 7.1 * mm, f"{code}  -  {title}")
    c.setFont(FONT_REG, 7.2)
    c.drawRightString(x + width - 5 * mm, y_top - 7.1 * mm, f"[{scope}]")
    return y_top - height


def draw_checkbox(c, x, y, width, height):
    size = min(5.5 * mm, height - 7 * mm)
    c.setLineWidth(0.9)
    c.setStrokeColor(MUTED)
    c.setFillColor(WHITE)
    c.rect(x + (width - size) / 2, y + (height - size) / 2, size, size, fill=1, stroke=1)


def table_row_height(row, widths):
    item = paragraph(f"{row[0]}\n{row[1]}", TABLE_ITEM)
    _, item_height = item.wrap(widths[1] - 6 * mm, PAGE_H)
    return max(14 * mm, item_height + 7 * mm)


def draw_check_table(c, x, y_top, width, rows, start_index=1):
    widths = [10 * mm, 78 * mm, 38 * mm, 16 * mm, 22 * mm, 16 * mm]
    headers = ["ลำดับ", "รายการที่ต้องตรวจ", "ค่า / รหัส / หมายเหตุ", "ผ่าน", "พบปัญหา", "N/A"]
    header_height = 12 * mm
    c.setFillColor(BLUE_PALE)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.roundRect(x, y_top - header_height, width, header_height, 4, fill=1, stroke=1)
    cx = x
    for header, col_width in zip(headers, widths):
        p = paragraph(header, TABLE_HEADER)
        _, height = p.wrap(col_width - 3 * mm, header_height - 3 * mm)
        p.drawOn(c, cx + 1.5 * mm, y_top - (header_height + height) / 2)
        cx += col_width

    y = y_top - header_height
    for offset, row in enumerate(rows):
        height = table_row_height(row, widths)
        fill = WHITE if offset % 2 == 0 else colors.HexColor("#FBFCFE")
        c.setFillColor(fill)
        c.setStrokeColor(LINE)
        c.rect(x, y - height, width, height, fill=1, stroke=1)

        c.setFont(FONT_BOLD, 8)
        c.setFillColor(BLUE_DARK)
        c.drawCentredString(x + widths[0] / 2, y - height / 2 - 2.7, str(start_index + offset))

        item = paragraph(f"{row[0]}\n{row[1]}", TABLE_ITEM)
        _, item_height = item.wrap(widths[1] - 6 * mm, height - 4 * mm)
        item.drawOn(c, x + widths[0] + 3 * mm, y - 2 * mm - item_height)

        cx = x + widths[0] + widths[1] + widths[2]
        for col_width in widths[3:]:
            draw_checkbox(c, cx, y - height, col_width, height)
            cx += col_width
        y -= height
    return y


def draw_note_box(c, x, y_top, width, text, fill=BLUE_PALE, stroke=colors.HexColor("#BFDBFE")):
    height = 22 * mm
    draw_round_rect(c, x, y_top - height, width, height, fill=fill, stroke=stroke, radius=5)
    draw_paragraph(c, text, x + 6 * mm, y_top - 6.5 * mm, width - 12 * mm, BODY_SMALL)
    return y_top - height


def cover(c, page_no):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.rect(0, PAGE_H - 10 * mm, PAGE_W, 10 * mm, fill=1, stroke=0)

    x = MARGIN
    y = PAGE_H - 38 * mm
    draw_round_rect(c, x, y - 63 * mm, CONTENT_W, 63 * mm, fill=INK, stroke=INK, radius=10)
    c.setFillColor(colors.HexColor("#93C5FD"))
    c.setFont(FONT_BOLD, 9)
    c.drawString(x + 12 * mm, y - 17 * mm, "FIELD GUIDE - CHECKLIST OPERATIONS")
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 25)
    c.drawString(x + 12 * mm, y - 34 * mm, "คู่มือตรวจงานสำหรับผู้รับเหมา")
    c.setFillColor(colors.HexColor("#DBEAFE"))
    c.setFont(FONT_BOLD, 14.5)
    c.drawString(x + 12 * mm, y - 47 * mm, "ตรวจอะไรบ้าง - ติ๊กผลหน้างาน")

    info_y = 535
    draw_round_rect(c, x, info_y - 62 * mm, CONTENT_W, 62 * mm, fill=WHITE, stroke=LINE, radius=6)
    draw_paragraph(c, "ข้อมูลหน้างาน", x + 7 * mm, info_y - 8 * mm, CONTENT_W - 14 * mm, HEAD)
    fields = [
        "โครงการ / สถานี: ........................................................................................................",
        "วันที่ตรวจ: ..............................................    รูปแบบสถานี:  [  ] SC    [  ] IMPS",
        "บริษัทผู้รับจ้าง: ...........................................................................................................",
        "เลขที่สัญญา: ................................................................................................................",
        "ผู้ตรวจ: ........................................................................................................................",
    ]
    fy = info_y - 20 * mm
    for field in fields:
        draw_paragraph(c, field, x + 8 * mm, fy, CONTENT_W - 16 * mm, BODY)
        fy -= 11 * mm

    rules_y = 337
    draw_round_rect(c, x, rules_y - 70 * mm, CONTENT_W, 70 * mm, fill=BLUE_PALE, stroke=colors.HexColor("#BFDBFE"), radius=6)
    draw_paragraph(c, "วิธีใช้แบบฟอร์ม", x + 7 * mm, rules_y - 8 * mm, CONTENT_W - 14 * mm, HEAD)
    rules = [
        "ติ๊กผลทีละรายการ และทำซ้ำสำหรับอุปกรณ์จริงหรือ Lane ทุกจุดที่เกี่ยวข้อง",
        "ช่องค่า / รหัส / หมายเหตุ ใช้เขียนค่าที่วัด, Asset No., Lane หรือรายละเอียดปัญหา",
        "พบปัญหาให้เขียนอาการและการติดตาม เช่น ชำรุด หรือรอเปลี่ยน ในช่องหมายเหตุ",
        "ใช้ N/A เฉพาะรายการที่ไม่ได้ติดตั้งหรือไม่เกี่ยวข้องกับสถานีจริง",
        "คู่มือนี้ไม่มีเกณฑ์ตัวเลขทางวิศวกรรม ให้ยึดเกณฑ์งานและ Snapshot ของรอบตรวจจริง",
    ]
    ry = rules_y - 20 * mm
    for rule in rules:
        c.setFillColor(BLUE)
        c.circle(x + 9 * mm, ry + 1.3 * mm, 1.3 * mm, fill=1, stroke=0)
        draw_paragraph(c, rule, x + 15 * mm, ry + 4 * mm, CONTENT_W - 22 * mm, BODY_SMALL)
        ry -= 10 * mm

    status_y = 117
    draw_round_rect(c, x, status_y - 18 * mm, CONTENT_W, 18 * mm, fill=WHITE, stroke=LINE, radius=5)
    draw_paragraph(c, "ผลที่ใช้ติ๊ก", x + 7 * mm, status_y - 7 * mm, 34 * mm, LABEL)
    statuses = [("ผ่าน", GREEN), ("พบปัญหา", RED), ("N/A", MUTED)]
    sx = x + 44 * mm
    for label, color in statuses:
        c.setFillColor(color)
        c.setStrokeColor(color)
        c.rect(sx, status_y - 15 * mm, 5 * mm, 5 * mm, fill=0, stroke=1)
        draw_paragraph(c, label, sx + 8 * mm, status_y - 10.5 * mm, 27 * mm, BODY_SMALL)
        sx += 40 * mm

    draw_footer(c, page_no)
    c.showPage()


def checklist_page(c, group, page_no):
    draw_page_header(
        c,
        group["code"],
        group["title"],
        f"รายการตรวจระดับงานหน้างาน - ติ๊กผลตามอุปกรณ์และขอบเขตที่มีจริง [{group['scope']}]",
        page_no,
    )
    x = MARGIN
    y = PAGE_H - 61 * mm
    y = draw_section_bar(c, x, y, CONTENT_W, group["code"], group["title"], group["scope"])
    y -= 4 * mm
    table_bottom = draw_check_table(c, x, y, CONTENT_W, group["rows"])
    note = "ถ้ามีหลาย Asset หรือหลาย Lane ให้ทำซ้ำรายการนี้ทุกตัว/ทุก Lane และเขียนรหัสอ้างอิงในช่องค่า / รหัส / หมายเหตุ"
    if group["code"] == "7.1":
        note = "VMS เป็นรายการของสถานี SC หรือจุดที่ติดตั้งจริงเท่านั้น หากไม่มี VMS ให้ติ๊ก N/A และไม่ต้องสร้างรายการแทน"
    note_y = max(table_bottom - 7 * mm, 46 * mm)
    draw_note_box(c, x, note_y, CONTENT_W, note, fill=AMBER_PALE, stroke=colors.HexColor("#FED7AA"))
    c.showPage()


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_total_pages(total)
            super().showPage()
        super().save()

    def _draw_total_pages(self, total):
        self.setStrokeColor(LINE)
        self.setLineWidth(0.6)
        self.line(MARGIN, 18 * mm, PAGE_W - MARGIN, 18 * mm)
        self.setFont(FONT_REG, 7.1)
        self.setFillColor(MUTED)
        self.drawString(MARGIN, 12.5 * mm, "คู่มือตรวจงานสำหรับผู้รับเหมา - Checklist Operations - v1.1")
        self.drawRightString(PAGE_W - MARGIN, 12.5 * mm, f"หน้า {self._pageNumber:02d} / {total:02d}")


def build():
    c = NumberedCanvas(str(OUT), pagesize=A4)
    c.setTitle("คู่มือตรวจงานสำหรับผู้รับเหมา - Checklist Operations")
    c.setAuthor("Checklist Operations")
    cover(c, 1)
    for page_no, group in enumerate(CHECKLIST_GROUPS, start=2):
        checklist_page(c, group, page_no)
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
