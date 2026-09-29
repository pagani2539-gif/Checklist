"""Create a normalized, non-destructive BOQ attachment package.

The source PDFs stay unchanged. The package normalizes the 1.1 filename and
repairs the embedded section number in 6.1.pdf while retaining all other page
content and metadata.
"""

from __future__ import annotations

import argparse
import io
import re
import shutil
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas


SOURCE_NAMES = (
    ("1.pdf", "1.1.pdf"),
    ("2.1.pdf", "2.1.pdf"),
    ("2.2.pdf", "2.2.pdf"),
    ("2.3.pdf", "2.3.pdf"),
    ("3.1.pdf", "3.1.pdf"),
    ("3.2.pdf", "3.2.pdf"),
    ("4.1.pdf", "4.1.pdf"),
    ("4.2.pdf", "4.2.pdf"),
    ("5.1.pdf", "5.1.pdf"),
    ("6.1.pdf", "6.1.pdf"),
    ("6.2.pdf", "6.2.pdf"),
    ("6.3.pdf", "6.3.pdf"),
    ("7.1.pdf", "7.1.pdf"),
)


def repair_61_header(source: Path, destination: Path) -> None:
    reader = PdfReader(str(source))
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    page = writer.pages[0]
    original = page.get_contents().get_data()
    title_pattern = re.compile(
        rb"q\n1\.000000 1\.000000 1\.000000 rg\n"
        rb"BT\n0 Tr\n/F1 12\.824300 Tf\n"
        rb"1 0 0\.000000 -1 433\.760010 97\.279999 Tm\n"
        rb"\[.*?\] TJ\nET\nQ\n",
        re.DOTALL,
    )
    matches = list(title_pattern.finditer(original))
    if len(matches) != 1:
        raise RuntimeError(
            "6.1.pdf header pattern was not uniquely identified; refusing to edit"
        )
    # Remove the old embedded-font title so the corrected title is not layered
    # on top of the incorrect 5.1 text or left behind in text extraction.
    match = matches[0]
    updated = original[: match.start()] + original[match.end() :]
    stream = DecodedStreamObject()
    stream.set_data(updated)
    page[NameObject("/Contents")] = writer._add_object(stream)

    # The source's embedded subset does not contain a glyph for the digit 6.
    # Draw the corrected English title with a standard PDF font at the original
    # visible coordinates, keeping the rest of the source page untouched.
    overlay_buffer = io.BytesIO()
    overlay_canvas = canvas.Canvas(overlay_buffer, pagesize=(792, 612))
    overlay_canvas.setFillColor(Color(1, 1, 1))
    overlay_canvas.setFont("Times-Bold", 9.6182)
    overlay_canvas.drawString(325.32, 539.04, "6.1 | DATABASE MANAGEMENT AND REPORT")
    overlay_canvas.save()
    overlay_buffer.seek(0)
    overlay_page = PdfReader(overlay_buffer).pages[0]
    page.merge_page(overlay_page)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        writer.write(handle)


def validate_pdf(path: Path, expected_code: str) -> None:
    reader = PdfReader(str(path))
    if len(reader.pages) != 1:
        raise RuntimeError(f"{path.name}: expected one page, got {len(reader.pages)}")
    text = reader.pages[0].extract_text() or ""
    if expected_code not in text:
        raise RuntimeError(f"{path.name}: expected code {expected_code!r} not found")
    if path.name == "6.1.pdf" and "5.1 | DATABASE" in text:
        raise RuntimeError("6.1.pdf: old 5.1 header remains in extracted text")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for source_name, output_name in SOURCE_NAMES:
        source = args.source_dir / source_name
        destination = args.output_dir / output_name
        if not source.is_file():
            raise FileNotFoundError(source)
        if output_name == "6.1.pdf":
            repair_61_header(source, destination)
        else:
            shutil.copy2(source, destination)
        # The source heading for the normalized 1.1 attachment is intentionally
        # retained as `1`; the package filename and manifest provide the full
        # BOQ mapping without rewriting the source page content.
        expected_code = "1" if output_name == "1.1.pdf" else output_name.removesuffix(".pdf")
        validate_pdf(destination, expected_code)
        print(f"validated {destination.name}")


if __name__ == "__main__":
    main()
