from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import argparse
import json

root = Path(__file__).resolve().parents[1]
extension = root / "dist" / "extension"
manifest = json.loads((extension / "manifest.json").read_text(encoding="utf-8"))

parser = argparse.ArgumentParser(description="Crea il pacchetto XPI di Fattura PEC.")
parser.add_argument("--output-dir", type=Path, default=root / "dist")
output_dir = parser.parse_args().output_dir
output_dir.mkdir(parents=True, exist_ok=True)
package = output_dir / f"fattura-pec-{manifest['version']}.xpi"

with ZipFile(package, "w") as archive:
    for path in sorted(extension.rglob("*")):
        if path.is_file():
            entry = ZipInfo(path.relative_to(extension).as_posix())
            archive.writestr(entry, path.read_bytes(), compress_type=ZIP_DEFLATED)
    archive.writestr(ZipInfo("LICENSE"), (root / "LICENSE").read_bytes(), compress_type=ZIP_DEFLATED)

print(package)
