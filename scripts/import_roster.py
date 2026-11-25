#!/usr/bin/env python3
"""Import the teacher workbook into SQLite and publish teachers.js."""

import argparse
import sqlite3
import sys
from collections import Counter
from contextlib import closing
from pathlib import Path
from typing import NamedTuple
from xml.etree import ElementTree as ET
from zipfile import ZipFile

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = PROJECT_ROOT / "data" / "roster.sqlite"
DEFAULT_JS = PROJECT_ROOT / "public" / "teachers.js"
SHEET_NAME = "进群信息表"
STATS_SHEET = "统计"
HEADERS = ("序号", "学校", "姓名", "电话号码后6位", "加入群")
KNOWN_GROUPS = frozenset({
    "",
    "单元设计组",
    "探究实验组",
    "做中学组",
    "待沟通",
    "待定",
    "未分组",
    "暂不分组",
})
_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_REL_ID = (
    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
)


class Teacher(NamedTuple):
    """One row from the roster sheet."""

    seq: int
    school: str
    name: str
    phone_tail: str
    join_group: str


def column_index(cell_ref):
    """Return a zero-based column index for a cell reference such as B12."""
    index = 0
    for char in cell_ref:
        if not char.isalpha():
            break
        index = index * 26 + ord(char.upper()) - ord("A") + 1
    return index - 1


def node_text(element):
    """Join text nodes, skipping phonetic runs."""
    parts = []

    def walk(node):
        if node.tag == f"{_MAIN}rPh":
            return
        if node.tag == f"{_MAIN}t" and node.text:
            parts.append(node.text)
        for child in list(node):
            walk(child)

    walk(element)
    return "".join(parts)


def load_shared_strings(archive):
    """Return the shared-string table, or an empty list when the file has none."""
    name = "xl/sharedStrings.xml"
    if name not in archive.namelist():
        return []
    root = ET.fromstring(archive.read(name))
    return [node_text(item) for item in root.findall(f"{_MAIN}si")]


def cell_value(cell, shared):
    """Return the displayed text of one cell."""
    kind = cell.attrib.get("t", "")
    if kind == "inlineStr":
        inline = cell.find(f"{_MAIN}is")
        if inline is None:
            return ""
        return node_text(inline)
    node = cell.find(f"{_MAIN}v")
    raw = ""
    if node is not None and node.text:
        raw = node.text
    if kind == "s":
        return shared[int(raw)]
    return raw


def worksheet_table(root, shared):
    """Return a sheet as a list of rows of strings."""
    rows = []
    for row in root.findall(f"{_MAIN}sheetData/{_MAIN}row"):
        values = {}
        for cell in row.findall(f"{_MAIN}c"):
            ref = cell.attrib.get("r", "")
            if not ref:
                continue
            values[column_index(ref)] = cell_value(cell, shared)
        if not values:
            rows.append([])
            continue
        width = max(values) + 1
        rows.append([values.get(index, "") for index in range(width)])
    return rows


def sheet_targets(archive):
    """Map worksheet names to zip paths."""
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {}
    for rel in rels:
        if not rel.tag.endswith("Relationship"):
            continue
        target = rel.attrib["Target"].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        targets[rel.attrib["Id"]] = target
    found = {}
    for sheet in workbook.findall(f"{_MAIN}sheets/{_MAIN}sheet"):
        found[sheet.attrib["name"]] = targets[sheet.attrib[_REL_ID]]
    return found


def read_workbook(path):
    """Read every worksheet into a table of strings."""
    with ZipFile(path) as archive:
        shared = load_shared_strings(archive)
        sheets = {}
        for name, target in sheet_targets(archive).items():
            root = ET.fromstring(archive.read(target))
            sheets[name] = worksheet_table(root, shared)
    return sheets


def parse_teachers(table):
    """Turn the roster sheet into Teacher rows."""
    if not table:
        raise ValueError("roster sheet is empty")
    header = tuple(cell.strip() for cell in table[0][:len(HEADERS)])
    if header != HEADERS:
        raise ValueError(f"unexpected header {header!r}")
    teachers = []
    seen_seq = set()
    for raw in table[1:]:
        padded = list(raw) + [""] * len(HEADERS)
        cells = [cell.strip() for cell in padded[:len(HEADERS)]]
        if not any(cells):
            continue
        seq_text, school, name, phone_tail, join_group = cells
        if not seq_text.isdigit():
            raise ValueError(f"bad 序号 {seq_text!r} for {name!r}")
        seq = int(seq_text)
        if seq in seen_seq:
            raise ValueError(f"duplicate 序号 {seq}")
        seen_seq.add(seq)
        if not name:
            raise ValueError(f"empty name at 序号 {seq}")
        teachers.append(Teacher(seq, school, name, phone_tail, join_group))
    return teachers


def parse_stats(table):
    """Return group counts from the summary sheet."""
    counts = {}
    for raw in table[1:]:
        cells = list(raw) + ["", ""]
        label = cells[0].strip()
        if label in ("", "合计"):
            continue
        try:
            counts[label] = int(cells[1].strip())
        except ValueError as exc:
            raise ValueError(f"bad count for {label!r}") from exc
    return counts


def publishable(teacher):
    """Return whether the phone tail can identify this teacher."""
    return len(teacher.phone_tail) == 6 and teacher.phone_tail.isdigit()


def collect_warnings(teachers, stats):
    """Describe rows without a usable phone and disagreements with the summary."""
    warnings = []
    for teacher in teachers:
        if not publishable(teacher):
            warnings.append(
                "no phone tail, page asks them to contact 董老师: "
                f"seq {teacher.seq} {teacher.name} ({teacher.school}) "
                f"phone {teacher.phone_tail!r}"
            )
        if teacher.join_group not in KNOWN_GROUPS:
            warnings.append(
                "unknown group: "
                f"seq {teacher.seq} {teacher.name} {teacher.join_group!r}"
            )
    seen = {}
    for teacher in teachers:
        key = (
            teacher.name,
            teacher.phone_tail,
            teacher.join_group,
            teacher.school,
        )
        if key in seen:
            warnings.append(
                "duplicate row: "
                f"{teacher.name} {teacher.phone_tail} {teacher.join_group} "
                f"(seq {seen[key]} and {teacher.seq})"
            )
        else:
            seen[key] = teacher.seq
    if stats is not None:
        actual = Counter(teacher.join_group for teacher in teachers)
        if actual != stats:
            imported = dict(actual)
            warnings.append(
                "stats sheet does not match imported groups: "
                f"imported {imported}, stats {stats}"
            )
    return warnings


def write_database(path, teachers):
    """Replace the roster table with this import."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path)) as conn:
        conn.executescript(
            """
            DROP TABLE IF EXISTS teachers;
            CREATE TABLE teachers (
                seq INTEGER PRIMARY KEY,
                school TEXT NOT NULL,
                name TEXT NOT NULL,
                phone_tail TEXT NOT NULL,
                join_group TEXT NOT NULL
            );
            """
        )
        conn.executemany(
            """
            INSERT INTO teachers (
                seq, school, name, phone_tail, join_group
            ) VALUES (?, ?, ?, ?, ?)
            """,
            teachers,
        )
        conn.commit()


def js_string(value):
    """Quote a value for the generated script."""
    escaped = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\r", "\\r")
        .replace("\n", "\\n")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )
    return f'"{escaped}"'


def roster_line(teacher):
    """Return one teachers.js row."""
    name = js_string(teacher.name)
    phone = js_string(teacher.phone_tail)
    group = js_string(teacher.join_group)
    return f"    {{ name: {name}, phone6: {phone}, group: {group} }},"


def write_teachers_js(path, teachers):
    """Rewrite the static roster the page reads."""
    lines = [
        "/* 研修小组名册。由 scripts/import_roster.py 写入，重新导入会覆盖本文件。",
        " * phone6 必须带引号，避免前导 0 丢失。",
        " * 电话不是六位，或 group 为待沟通时，页面提示联系董老师。",
        " * group：单元设计组、探究实验组、做中学组、待沟通、待定。",
        " */",
        "window.ROSTER = [",
    ]
    lines.extend(roster_line(teacher) for teacher in teachers)
    lines.append("];")
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8", newline="\n")


def report(teachers, warnings, db_path, js_path):
    """Print the import summary. Warnings go to stderr."""
    counts = Counter(teacher.join_group for teacher in teachers)
    missing_phone = sum(1 for teacher in teachers if not publishable(teacher))
    print(f"imported {len(teachers)} rows into {db_path}")
    print(f"published {len(teachers)} rows into {js_path}")
    if missing_phone:
        print(f"  without a phone tail: {missing_phone}")
    for name, count in counts.most_common():
        print(f"  {name}: {count}")
    for warning in warnings:
        print(warning, file=sys.stderr)


def parse_args(argv):
    """Return the command-line arguments."""
    parser = argparse.ArgumentParser(
        description=(
            "Import the teacher workbook into SQLite and publish teachers.js."
        ),
    )
    parser.add_argument("workbook", type=Path, help="Path to the .xlsx roster.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--js", type=Path, default=DEFAULT_JS)
    return parser.parse_args(argv)


def main(argv=None):
    """Load the workbook, replace the database, and publish the page roster."""
    args = parse_args(argv)
    try:
        sheets = read_workbook(args.workbook)
    except FileNotFoundError:
        print(f"workbook not found: {args.workbook}", file=sys.stderr)
        return 1
    if SHEET_NAME not in sheets:
        names = ", ".join(sheets)
        print(
            f"workbook has no sheet {SHEET_NAME!r} ({names})",
            file=sys.stderr,
        )
        return 1
    try:
        teachers = parse_teachers(sheets[SHEET_NAME])
        stats = None
        if STATS_SHEET in sheets:
            stats = parse_stats(sheets[STATS_SHEET])
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    warnings = collect_warnings(teachers, stats)
    write_database(args.db, teachers)
    write_teachers_js(args.js, teachers)
    report(teachers, warnings, args.db, args.js)
    return 0


if __name__ == "__main__":
    sys.exit(main())
