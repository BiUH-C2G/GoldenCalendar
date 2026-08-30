"""为所有课表解析器提供统一的数据约定"""

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
        raise ValueError(f"数据约定无法生成 {kind} 文件名：缺少 {error.args[0]}") from error


def find_grade(contract: dict[str, Any], grade: str) -> dict[str, Any]:
    for item in contract["grades"]:
        if item["grade"] == grade:
            return item
    raise ValueError(f"data-contract.json 未声明年级 {grade!r}")


def find_major(contract: dict[str, Any], grade: str, major_code: str) -> dict[str, Any]:
    grade_item = find_grade(contract, grade)
    for item in grade_item["majors"]:
        if item["code"] == major_code:
            return item
    raise ValueError(f"data-contract.json 未声明专业 {grade}{major_code}")


def major_name(contract: dict[str, Any], major_code: str) -> str:
    names = {
        major["code"]: major["name"]
        for grade in contract["grades"]
        for major in grade["majors"]
    }
    try:
        return names[major_code.upper()]
    except KeyError as error:
        raise ValueError(f"未知专业代码 {major_code!r}") from error
