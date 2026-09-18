from pathlib import Path
import fitz

INPUTS = [
    Path("attached_assets/(ราคาขายแผ่น)_BY_knight_Furnich__1789295808441.pdf"),
    Path("attached_assets/(ราคารวมติดตั้ง)_BY_knight_Furnich_(1)_1789295808439.pdf"),
]
OUTPUT = Path(".agents/outputs/price-pdf-pages")
OUTPUT.mkdir(parents=True, exist_ok=True)

for source in INPUTS:
    document = fitz.open(source)
    print(f"{source.name}: {document.page_count} pages")
    for page_number, page in enumerate(document, start=1):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        target = OUTPUT / f"{source.stem}-page-{page_number:02d}.png"
        pixmap.save(target)
        print(f"  rendered {target}")