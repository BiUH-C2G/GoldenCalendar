"""读取并应用课程覆写规则"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml


OVERRIDE_KINDS = {"administrative", "english", "englishCatchup", "german", "physicalEducation"}
LANGUAGE_KINDS = {"english", "englishCatchup", "german"}
IDENTITY_FIELDS = ("grade", "majorCode", "groupId", "section", "level", "classNumber", "title", "teacher")
MATCH_FIELDS = set(IDENTITY_FIELDS) | {"kind", "weeks", "weekday", "slot"}


def load_override_rules(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []

    value = yaml.safe_load(path.read_text(encoding="utf-8"))
    if value is None:
        return []
    if not isinstance(value, dict):
        raise ValueError(f"覆写规则文件 {path} 的根节点必须是对象")
    unknown = set(value) - {"rules"}
    if unknown:
        raise ValueError(f"覆写规则文件 {path} 存在未知字段：{sorted(unknown)}")

    raw_rules = value.get("rules", [])
    if not isinstance(raw_rules, list):
        raise ValueError(f"覆写规则文件 {path} 的 rules 必须是数组")
    return [_normalize_rule(item, index, path) for index, item in enumerate(raw_rules)]


def _normalize_rule(value: Any, index: int, path: Path) -> dict[str, Any]:
    label = f"覆写规则第 {index + 1} 条"
    rule = _expect_dict(value, f"{path} 的 {label}")
    _reject_unknown(rule, {"match", "set", "proposedBy", "proposedAt", "reason"}, label)
    match = _normalize_match(rule.get("match"), label)
    changes = _expect_dict(rule.get("set"), f"{label}.set")
    _reject_unknown(changes, {"room"}, f"{label}.set")
    room = changes.get("room")
    if not isinstance(room, str) or not room.strip():
        raise ValueError(f"{label}.set.room 必须是非空字符串")
    return {
        "match": match,
        "set": {"room": room.strip()},
        "proposedBy": _expect_string(rule.get("proposedBy"), f"{label}.proposedBy"),
        "proposedAt": _expect_string(rule.get("proposedAt"), f"{label}.proposedAt"),
        "reason": _expect_string(rule.get("reason"), f"{label}.reason"),
    }


def _normalize_match(value: Any, label: str) -> dict[str, Any]:
    match = _expect_dict(value, f"{label}.match")
    _reject_unknown(match, MATCH_FIELDS, f"{label}.match")
    kind = _expect_string(match.get("kind"), f"{label}.match.kind")
    if kind not in OVERRIDE_KINDS:
        raise ValueError(f"{label}.match.kind 不支持：{kind}")

    normalized = {"kind": kind}
    for field in IDENTITY_FIELDS:
        if field in match:
            normalized[field] = _normalize_identity_value(match[field], f"{label}.match.{field}")

    if kind == "administrative":
        _require_fields(normalized, {"grade", "majorCode"}, label)
        if "title" not in normalized and "teacher" not in normalized:
            raise ValueError(f"{label}.match 至少需要 title 或 teacher")
    elif kind == "german":
        _require_fields(normalized, {"section", "level", "classNumber"}, label)
    elif kind == "english":
        _require_fields(normalized, {"section", "classNumber"}, label)
    elif kind == "englishCatchup":
        _require_fields(normalized, {"classNumber"}, label)
    elif kind == "physicalEducation":
        _require_fields(normalized, {"groupId"}, label)

    if "weeks" in match:
        weeks = _expect_dict(match["weeks"], f"{label}.match.weeks")
        _reject_unknown(weeks, {"from", "to"}, f"{label}.match.weeks")
        start = _expect_integer_range(weeks.get("from"), f"{label}.match.weeks.from", 1, 60)
        end = _expect_integer_range(weeks.get("to"), f"{label}.match.weeks.to", 1, 60)
        if start > end:
            raise ValueError(f"{label}.match.weeks.from 不能大于 to")
        normalized["weeks"] = {"from": start, "to": end}

    for field, minimum, maximum in (("weekday", 1, 7), ("slot", 1, 20)):
        if field in match:
            normalized[field] = _expect_integer_range(match[field], f"{label}.match.{field}", minimum, maximum)
    return normalized


def _expect_dict(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} 必须是对象")
    return value


def _expect_string(value: Any, label: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{label} 必须是字符串")
    if not value.strip():
        raise ValueError(f"{label} 不能为空")
    return value.strip()


def _normalize_identity_value(value: Any, label: str) -> str:
    if isinstance(value, bool) or not isinstance(value, (str, int)):
        raise ValueError(f"{label} 必须是字符串或整数")
    text = str(value).strip()
    if not text:
        raise ValueError(f"{label} 不能为空")
    return text


def _expect_integer_range(value: Any, label: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum or value > maximum:
        raise ValueError(f"{label} 必须是 {minimum} 至 {maximum} 之间的整数")
    return value


def _require_fields(value: dict[str, Any], fields: set[str], label: str) -> None:
    missing = fields - set(value)
    if missing:
        raise ValueError(f"{label}.match 缺少字段：{sorted(missing)}")


def _reject_unknown(value: dict[str, Any], allowed: set[str], label: str) -> None:
    unknown = set(value) - allowed
    if unknown:
        raise ValueError(f"{label} 存在未知字段：{sorted(unknown)}")


def apply_administrative_overrides(result: dict[str, Any], rules: list[dict[str, Any]]) -> set[int]:
    matched: set[int] = set()
    source = result["source"]
    for group in result["groups"]:
        for event in group["events"]:
            for index, rule in enumerate(rules):
                if _matches_administrative(rule, source, group["groupId"], event):
                    event["room"] = rule["set"]["room"]
                    matched.add(index)
    return matched


def _matches_administrative(rule: dict[str, Any], source: dict[str, Any], group_id: str, event: dict[str, Any]) -> bool:
    match = rule["match"]
    if match["kind"] != "administrative":
        return False
    if match["grade"] != source["grade"] or match["majorCode"] != source["majorCode"]:
        return False
    if match.get("groupId") is not None and match["groupId"] != group_id:
        return False
    if match.get("title") is not None and match["title"] != event["title"]:
        return False
    if match.get("teacher") is not None and match["teacher"] != event["teacher"]:
        return False
    return _matches_time(match, event)


def apply_language_overrides(classes: list[dict[str, Any]], rules: list[dict[str, Any]]) -> set[int]:
    matched: set[int] = set()
    for course in classes:
        meetings = course["meetings"]
        for index, rule in enumerate(rules):
            if not _matches_language_course(rule, course):
                continue
            next_meetings = []
            for meeting in meetings:
                pieces, changed = _apply_language_rule(meeting, rule)
                next_meetings.extend(pieces)
                if changed:
                    matched.add(index)
            meetings = next_meetings
        course["meetings"] = _deduplicate_meetings(meetings)
    return matched


def _matches_language_course(rule: dict[str, Any], course: dict[str, Any]) -> bool:
    match = rule["match"]
    expected_language, expected_kind = {
        "german": ("German", "standard"),
        "english": ("English", "standard"),
        "englishCatchup": ("English", "catchup"),
    }.get(match["kind"], (None, None))
    if expected_language is None or course["language"] != expected_language or course["kind"] != expected_kind:
        return False
    for field in ("section", "level", "classNumber"):
        if field in match and match[field] != course.get(field):
            return False
    return True


def _apply_language_rule(meeting: dict[str, Any], rule: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
    match = rule["match"]
    if match.get("weekday") is not None and match["weekday"] != meeting["weekday"]:
        return [meeting], False
    if match.get("slot") is not None and match["slot"] != meeting["slot"]:
        return [meeting], False
    if match.get("teacher") is not None and match["teacher"] not in meeting["teachers"]:
        return [meeting], False

    meeting_start = meeting["startWeek"]
    meeting_end = meeting["endWeek"]
    weeks = match.get("weeks")
    override_start = weeks["from"] if weeks else meeting_start
    override_end = weeks["to"] if weeks else meeting_end
    overlap_start = max(meeting_start, override_start)
    overlap_end = min(meeting_end, override_end)
    if overlap_start > overlap_end:
        return [meeting], False

    boundaries = {meeting_start, meeting_end + 1, overlap_start, overlap_end + 1}
    sorted_boundaries = sorted(boundaries)
    pieces = []
    for left, right in zip(sorted_boundaries, sorted_boundaries[1:]):
        piece = {**meeting, "startWeek": left, "endWeek": right - 1}
        if left >= overlap_start and right - 1 <= overlap_end:
            piece["room"] = rule["set"]["room"]
        pieces.append(piece)
    return pieces, True


def apply_physical_education_overrides(groups: dict[str, list[dict[str, Any]]], rules: list[dict[str, Any]]) -> set[int]:
    matched: set[int] = set()
    for group_id, meetings in groups.items():
        for meeting in meetings:
            for index, rule in enumerate(rules):
                if _matches_physical_education(rule, group_id, meeting):
                    meeting["room"] = rule["set"]["room"]
                    matched.add(index)
    return matched


def _matches_physical_education(rule: dict[str, Any], group_id: str, meeting: dict[str, Any]) -> bool:
    match = rule["match"]
    if match["kind"] != "physicalEducation" or match["groupId"] != group_id:
        return False
    if match.get("weekday") is not None and match["weekday"] != meeting["weekday"]:
        return False
    if match.get("slot") is not None and match["slot"] != meeting["slot"]:
        return False
    if match.get("teacher") is not None and match["teacher"] not in meeting["teachers"]:
        return False
    return _matches_time(match, meeting)


def _matches_time(match: dict[str, Any], record: dict[str, Any]) -> bool:
    if match.get("weekday") is not None and match["weekday"] != record["weekday"]:
        return False
    if match.get("slot") is not None and match["slot"] != record["slot"]:
        return False
    weeks = match.get("weeks")
    return not weeks or weeks["from"] <= record.get("week", record.get("startWeek", 0)) <= weeks["to"]


def _deduplicate_meetings(meetings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique = {json.dumps(meeting, ensure_ascii=False, sort_keys=True): meeting for meeting in meetings}
    return sorted(unique.values(), key=lambda item: (item["startWeek"], item["endWeek"], item["weekday"], item["slot"]))


def ensure_override_matches(rules: list[dict[str, Any]], matched: set[int], kinds: set[str]) -> None:
    missing = [index + 1 for index, rule in enumerate(rules) if rule["match"]["kind"] in kinds and index not in matched]
    if missing:
        raise ValueError(f"以下覆写规则没有命中任何课次：{missing}")
