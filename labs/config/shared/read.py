from pypdf import PdfReader
from pathlib import Path

def read_pdf(path: Path) -> str:
    reader = PdfReader(path)
    content = ""

    for page in reader.pages:
        text = page.extract_text()
        if text:
            content += text + "\n"

    return content.strip()


def read_text_file(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as file:
        return file.read().strip()