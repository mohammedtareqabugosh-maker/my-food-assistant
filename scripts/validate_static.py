#!/usr/bin/env python3
"""Static safety checks for the standalone Sahn PWA."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
errors = []

class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.inline_scripts = []
        self.current_script = None
        self.ids = []
        self.refs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "script":
            if attrs.get("src"):
                self.refs.append(attrs["src"])
            else:
                self.current_script = []
        for attr in ("src", "href"):
            value = attrs.get(attr, "")
            if value:
                self.refs.append(value)

    def handle_data(self, data):
        if self.current_script is not None:
            self.current_script.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.current_script is not None:
            self.inline_scripts.append("".join(self.current_script))
            self.current_script = None

parser = AuditParser()
parser.feed(HTML.read_text(encoding="utf-8"))
parser.close()

duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
if duplicates:
    errors.append("Duplicate HTML IDs: " + ", ".join(duplicates))

for ref in parser.refs:
    if ref.startswith(("./",)):
        path = (ROOT / ref[2:].split("#", 1)[0].split("?", 1)[0]).resolve()
        if not path.exists():
            errors.append(f"Missing local HTML asset: {ref}")

css = HTML.read_text(encoding="utf-8")
for ref in re.findall(r"url\((?:['\"])?(\./[^)'\"]+)", css):
    path = (ROOT / ref[2:]).resolve()
    if not path.exists():
        errors.append(f"Missing local CSS asset: {ref}")

for name in ("food-supabase-sync.js", "sw.js"):
    path = ROOT / name
    result = subprocess.run(["node", "--check", str(path)], text=True, capture_output=True)
    if result.returncode:
        errors.append(f"JavaScript syntax error in {name}: {result.stderr.strip()}")

with tempfile.TemporaryDirectory() as temp:
    for i, source in enumerate(parser.inline_scripts):
        path = Path(temp) / f"inline-{i}.js"
        path.write_text(source, encoding="utf-8")
        result = subprocess.run(["node", "--check", str(path)], text=True, capture_output=True)
        if result.returncode:
            errors.append(f"JavaScript syntax error in inline script {i + 1}: {result.stderr.strip()}")

try:
    manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    for icon in manifest.get("icons", []):
        icon_path = ROOT / icon.get("src", "")
        if not icon_path.exists():
            errors.append(f"Missing PWA icon: {icon.get('src')}")
except Exception as exc:
    errors.append(f"Invalid manifest.webmanifest: {exc}")

try:
    ET.parse(ROOT / "icons" / "icon.svg")
except Exception as exc:
    errors.append(f"Invalid SVG icon: {exc}")

if "id=\"weeklySchedule\"" not in css:
    errors.append("Missing weeklySchedule container")
if "nassq.svg" in css:
    errors.append("Temporary NASSQ logo reference remains")

if errors:
    print("\n".join("FAIL: " + item for item in errors))
    raise SystemExit(1)

print(f"Static checks passed: {len(parser.inline_scripts)} inline scripts, manifest, SVG, assets, and JavaScript syntax.")
