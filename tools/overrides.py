"""读取并应用课程覆写规则"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import yaml


OVERRIDE_KINDS = {"administrative", "english", "englishCatchup", "german", "physicalEducation"}
LANGUAGE_KINDS = {"english", "englishCatchup", "german"}
IDENTITY_FIELDS = ("grade", "majorCode", "groupId", "section", "level", "classNumber", "title", "teacher")
MATCH_FIELDS = set(IDENTITY_FIELDS) | {"kind", "weeks", "weekday", "slot"}
CHANGE_FIELDS = ("room", "weekday", "slot")


def _load_override_root(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}

    value = yaml.safe_load(path.read_text(encoding="utf-8"))
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ValueError(f"覆写规则文件 {path} 的根节点必须是对象")
    unknown = set(value) - {"rules", "dayMoves"}
    if unknown:
        raise ValueError(f"覆写规则文件 {path} 存在未知字段：{sorted(unknown)}")
    return value


def load_override_rules(path: Path) -> list[dict[str, Any]]:
    raw_rules = _load_override_root(path).get("rules", [])
    if not isinstance(raw_rules, list):
        raise ValueError(f"覆写规则文件 {path} 的 rules 必须是数组")
    return [_normalize_rule(item, index, path) for index, item in enumerate(raw_rules)]


def load_day_moves(path: Path) -> list[dict[str, Any]]:
    raw_moves = _load_override_root(path).get("dayMoves", [])
    if not isinstance(raw_moves, list):
        raise ValueError(f"覆写规则文件 {path} 的 dayMoves 必须是数组")

    day_moves = [_normalize_day_move(item, index, path) for index, item in enumerate(raw_moves)]
    sources = [move["from"] for item in day_moves for move in item["moves"]]
    targets = {move["to"] for item in day_moves for move in item["moves"]}

    # 同一天只能搬走一次，且搬入日不能再被搬走，避免连环挪移的歧义
    duplicated = sorted({day for day in sources if sources.count(day) > 1})
    if duplicated: raise ValueError(f"整日调课存在重复的原日期：{duplicated}")
    chained = sorted(set(sources) & targets)
    if chained: raise ValueError(f"整日调课的目标日期不能同时作为原日期：{chained}")
    return day_moves


def _normalize_day_move(value: Any, index: int, path: Path) -> dict[str, Any]:
    label = f"整日调课第 {index + 1} 条"
    item = _expect_dict(value, f"{path} 的 {label}")
    _reject_unknown(item, {"moves", "proposedBy", "proposedAt", "reason"}, label)
    raw_moves = item.get("moves")
    if not isinstance(raw_moves, list) or not raw_moves: raise ValueError(f"{label}.moves 必须是非空数组")

    moves = []
    for move_index, raw_move in enumerate(raw_moves):
        move_label = f"{label}.moves[{move_index}]"
        move = _expect_dict(raw_move, move_label)
        _reject_unknown(move, {"from", "to"}, move_label)
        source = _expect_iso_date(move.get("from"), f"{move_label}.from")
        target = _expect_iso_date(move.get("to"), f"{move_label}.to")
        if source == target: raise ValueError(f"{move_label} 的 from 与 to 不能相同")
        moves.append({"from": source, "to": target})
    return {"moves": moves, "proposedBy": _expect_string(item.get("proposedBy"), f"{label}.proposedBy"), "proposedAt": _expect_string(item.get("proposedAt"), f"{label}.proposedAt"), "reason": _expect_string(item.get("reason"), f"{label}.reason")}


def _expect_iso_date(value: Any, label: str) -> str:
    # YAML 会把未加引号的日期解析成 date 对象，这里统一成 ISO 字符串
    if isinstance(value, date): return value.isoformat()
    text = _expect_string(value, label)
    try:
        return date.fromisoformat(text).isoformat()
    except ValueError as error:
        raise ValueError(f"{label} 必须是 YYYY-MM-DD 格式的日期") from error


def _normalize_rule(value: Any, index: int, path: Path) -> dict[str, Any]:
    label = f"覆写规则第 {index + 1} 条"
    rule = _expect_dict(value, f"{path} 的 {label}")
    _reject_unknown(rule, {"match", "set", "proposedBy", "proposedAt", "reason"}, label)
    match = _normalize_match(rule.get("match"), label)
    return {
        "match": match,
        "set": _normalize_changes(rule.get("set"), label),
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


def _normalize_changes(value: Any, label: str) -> dict[str, Any]:
    changes = _expect_dict(value, f"{label}.set")
    _reject_unknown(changes, set(CHANGE_FIELDS), f"{label}.set")
    if not changes: raise ValueError(f"{label}.set 至少需要 room、weekday、slot 之一")

    normalized: dict[str, Any] = {}
    if "room" in changes: normalized["room"] = _expect_string(changes["room"], f"{label}.set.room")
    for field, minimum, maximum in (("weekday", 1, 7), ("slot", 1, 20)):
        if field in changes: normalized[field] = _expect_integer_range(changes[field], f"{label}.set.{field}", minimum, maximum)
    return normalized


def _apply_changes(record: dict[str, Any], changes: dict[str, Any]) -> None:
    # 行政班课次带具体日期，改上课日时要在同一周内同步平移
    if "weekday" in changes and "date" in record: record["date"] = (date.fromisoformat(record["date"]) + timedelta(days=changes["weekday"] - record["weekday"])).isoformat()
    record.update(changes)


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
                    _apply_changes(event, rule["set"])
                    matched.add(index)

        # 改期后恢复按时间排序，稳定排序可保留同节次的原有先后
        group["events"].sort(key=lambda event: (event["date"], event["slot"]))
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
            _apply_changes(piece, rule["set"])
        pieces.append(piece)
    return pieces, True


def apply_physical_education_overrides(groups: dict[str, list[dict[str, Any]]], rules: list[dict[str, Any]]) -> set[int]:
    matched: set[int] = set()
    for group_id, meetings in groups.items():
        for meeting in meetings:
            for index, rule in enumerate(rules):
                if _matches_physical_education(rule, group_id, meeting):
                    _apply_changes(meeting, rule["set"])
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


WEEKDAY_NAMES = "一二三四五六日"


def _calendar_position(day: str, calendar_start: str) -> tuple[int, int]:
    offset = (date.fromisoformat(day) - date.fromisoformat(calendar_start)).days
    if offset < 0: raise ValueError(f"整日调课日期 {day} 早于学期第一周周一 {calendar_start}")
    return offset // 7 + 1, offset % 7 + 1


def _flatten_day_moves(day_moves: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{**move, "index": index} for index, item in enumerate(day_moves) for move in item["moves"]]


def _format_day(day: str) -> str:
    value = date.fromisoformat(day)
    return f"{value.month}月{value.day}日（周{WEEKDAY_NAMES[value.weekday()]}）"


def _day_move_notices(day_moves: list[dict[str, Any]], calendar_start: str) -> list[dict[str, Any]]:
    notices = []
    for move in _flatten_day_moves(day_moves):
        source_week, _ = _calendar_position(move["from"], calendar_start)
        target_week, _ = _calendar_position(move["to"], calendar_start)

        # 原日期整天搬空，按假期处理；目标日期所在周给出调课提示
        notices.append({"label": "Holiday", "startDate": move["from"], "endDate": move["from"], "startWeek": source_week, "endWeek": source_week})
        notices.append({"label": f"调课：{_format_day(move['to'])}上{_format_day(move['from'])}的课", "startDate": move["to"], "endDate": move["to"], "startWeek": target_week, "endWeek": target_week})
    return notices


def apply_administrative_day_moves(result: dict[str, Any], day_moves: list[dict[str, Any]]) -> set[int]:
    matched: set[int] = set()
    calendar_start = result["calendar"]["startDate"]
    moves = {move["from"]: move for move in _flatten_day_moves(day_moves)}
    notices = _day_move_notices(day_moves, calendar_start)
    for group in result["groups"]:
        for event in group["events"]:
            move = moves.get(event["date"])
            if not move: continue
            event["week"], event["weekday"] = _calendar_position(move["to"], calendar_start)
            event["date"] = move["to"]
            matched.add(move["index"])

        group["notices"].extend(dict(notice) for notice in notices)
        group["notices"].sort(key=lambda notice: (notice["startDate"], notice["endDate"], notice["label"]))
        group["events"].sort(key=lambda event: (event["date"], event["slot"]))
    return matched


def apply_meeting_day_moves(meetings: list[dict[str, Any]], day_moves: list[dict[str, Any]], calendar_start: str) -> list[dict[str, Any]]:
    for move in _flatten_day_moves(day_moves):
        source_week, source_weekday = _calendar_position(move["from"], calendar_start)
        target_week, target_weekday = _calendar_position(move["to"], calendar_start)
        next_meetings = []
        for meeting in meetings:
            if meeting["weekday"] != source_weekday or not meeting["startWeek"] <= source_week <= meeting["endWeek"]:
                next_meetings.append(meeting)
                continue

            # 从按周循环的区间里挖掉原日期那一周，再在目标日期补一个单周课次
            if meeting["startWeek"] < source_week: next_meetings.append({**meeting, "endWeek": source_week - 1})
            if source_week < meeting["endWeek"]: next_meetings.append({**meeting, "startWeek": source_week + 1})
            next_meetings.append({**meeting, "startWeek": target_week, "endWeek": target_week, "weekday": target_weekday})
        meetings = next_meetings
    return _deduplicate_meetings(meetings)


def ensure_day_move_matches(day_moves: list[dict[str, Any]], matched: set[int]) -> None:
    missing = [index + 1 for index in range(len(day_moves)) if index not in matched]
    if missing: raise ValueError(f"以下整日调课没有搬动任何行政班课次：{missing}")
