#!/usr/bin/env python3
"""
Builds the downloadable board-prep files (CBSE, UP Board, ICSE, ISC) from the
pages' own data.

    python3 tooling/scripts/build-board-prep-sheet.py      (needs: pip install openpyxl)

Reads  apps/web/src/lib/board-prep/board-prep.json  (what the pages render)
Writes apps/web/public/downloads/
         board-exam-2027-prep-sheet.xlsx             a tab per guide, Official Papers, Exam Tips
         <guide>-important-chapters-2027.csv         one per guide (cbse-class-10, isc-class-12, …)
         board-exam-2027-official-papers.csv         every paper link (read by the public Google Sheet)
         board-exam-2027-exam-tips.csv               the 30-day plan and exam-day tips (same)

Re-run after every edit to the JSON, so the download never disagrees with the
page. Priority uses the same share-of-paper thresholds as lib/board-prep.
"""
import csv
import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Font, PatternFill

ROOT = Path(__file__).resolve().parents[2]
DATA = json.loads((ROOT / "apps/web/src/lib/board-prep/board-prep.json").read_text(encoding="utf-8"))
OUT = ROOT / "apps/web/public/downloads"
OUT.mkdir(parents=True, exist_ok=True)
SITE = "https://schooltocareer.in"


def priority(marks, out_of):
    if marks is None or not out_of:
        return "Whole paper"
    share = marks / out_of
    return "High" if share >= 0.18 else "Medium" if share >= 0.10 else "Low"


def unit_rows(guide):
    for subject in guide["subjects"]:
        out_of = subject.get("outOf") or guide["theoryOutOf"]
        for u in subject["units"]:
            yield [subject["name"], u["unit"], u["chapters"], u["marks"], out_of if u["marks"] is not None else None,
                   priority(u["marks"], out_of), u["answer"], u["prep"]]


UNIT_HEAD = ["Subject", "Unit", "Chapters", "Marks", "Out of", "Priority", "How to write the answer", "How to prepare fast"]
HEAD_FILL = PatternFill("solid", fgColor="E8EEFC")
WRAP = Alignment(wrap_text=True, vertical="top")

wb = Workbook()
for i, slug in enumerate(DATA["order"]):
    guide = DATA["guides"][slug]
    ws = wb.active if i == 0 else wb.create_sheet()
    ws.title = guide["label"][:31]
    ws.append(UNIT_HEAD)
    for row in unit_rows(guide):
        ws.append(row)
    for width, col in zip([22, 30, 40, 8, 8, 12, 55, 55], "ABCDEFGH"):
        ws.column_dimensions[col].width = width
    last = ws.max_row
    for name, color in (("High", "FDE2E2"), ("Medium", "FEF0DC"), ("Low", "DFF5E3")):
        ws.conditional_formatting.add(f"F2:F{last}", CellIsRule(operator="equal", formula=[f'"{name}"'], fill=PatternFill("solid", fgColor=color)))
    ws.append([])
    for note in guide["notes"]:
        ws.append([note])
    ws.append([f"Source: {guide['source']['name']}. Guide: {SITE}/{slug}-important-chapters"])

ws = wb.create_sheet("Official Papers")
ws.append(["Board / class", "Subject", "Paper", "Link"])
for slug in DATA["order"]:
    guide = DATA["guides"][slug]
    for paper in guide["papers"]:
        for link in paper["links"]:
            ws.append([guide["label"], paper["subject"], link["label"], link["url"]])
for row in ws.iter_rows(min_row=2, min_col=4, max_col=4):
    for cell in row:
        cell.hyperlink = cell.value
        cell.style = "Hyperlink"
for width, col in zip([20, 28, 40, 80], "ABCD"):
    ws.column_dimensions[col].width = width

ws = wb.create_sheet("Exam Tips")
ws.append(["When", "What to do", "Why it works"])
for tip in DATA["tips"]:
    ws.append(tip)
for width, col in zip([26, 70, 50], "ABC"):
    ws.column_dimensions[col].width = width

for ws in wb.worksheets:
    ws.freeze_panes = "A2"
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = HEAD_FILL
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            if cell.alignment.wrap_text is not True:
                cell.alignment = WRAP

wb.properties.title = f"Board Exam {DATA['exam']} Prep Sheet"
wb.properties.creator = "SchoolToCareer"
wb.save(OUT / Path(DATA["download"]["xlsx"]).name)

for slug in DATA["order"]:
    with open(OUT / Path(DATA["download"]["csv"][slug]).name, "w", newline="", encoding="utf-8-sig") as fh:  # BOM: Excel reads ₹, √
        writer = csv.writer(fh)
        writer.writerow(UNIT_HEAD)
        writer.writerows(unit_rows(DATA["guides"][slug]))

for name in ("Official Papers", "Exam Tips"):
    slug = name.lower().replace(" ", "-")
    with open(OUT / f"board-exam-{DATA['exam']}-{slug}.csv", "w", newline="", encoding="utf-8-sig") as fh:
        csv.writer(fh).writerows(wb[name].iter_rows(values_only=True))

print("wrote", *sorted(p.name for p in OUT.iterdir()))
