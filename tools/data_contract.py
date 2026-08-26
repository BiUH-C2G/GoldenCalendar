"""Shared timetable data contract used by every parser."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTRACT_PATH = PROJECT_ROOT / "data-contract.json"


def load_contract(path: Path = DEFAULT_CONTRACT_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def format_file(contract: dict[str, Any], kind: str, **coordinates: str) -> str:
    try:
        return contract["files"][kind].format(**coordinates)
    except KeyError as error:
        raise ValueError(f"data contract cannot format {kind}: missing {error.args[0]}") from error


def find_grade(contract: dict[str, Any], grade: str) -> dict[str, Any]:
    for item in contract["grades"]:
        if item["grade"] == grade:
            return item
    raise ValueError(f"grade {grade!r} is not declared in data-contract.json")


def find_major(contract: dict[str, Any], grade: str, major_code: str) -> dict[str, Any]:
    grade_item = find_grade(contract, grade)
    for item in grade_item["majors"]:
        if item["code"] == major_code:
            return item
    raise ValueError(f"major {grade}{major_code} is not declared in data-contract.json")


def major_name(contract: dict[str, Any], major_code: str) -> str:
    names = {
        major["code"]: major["name"]
        for grade in contract["grades"]
        for major in grade["majors"]
    }
    try:
        return names[major_code.upper()]
    except KeyError as error:
        raise ValueError(f"unknown major code {major_code!r}") from error
