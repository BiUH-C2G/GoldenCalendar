#!/usr/bin/env python3
"""验证课表解析器的关键日期算法与覆写改期"""

from datetime import date
from pathlib import Path
import unittest

from overrides import _normalize_day_move, _normalize_rule, apply_administrative_day_moves, apply_administrative_overrides, apply_language_overrides, apply_meeting_day_moves
from parse_timetables import derive_calendar_start

class ParserDateTest(unittest.TestCase):
    def test_derive_first_monday(self) -> None:
        self.assertEqual(derive_calendar_start(date(2026, 9, 23), 4, 3), date(2026, 8, 31))

    def test_empty_monday_does_not_shift_anchor(self) -> None:
        self.assertEqual(derive_calendar_start(date(2026, 9, 1), 1, 2), date(2026, 8, 31))

class OverrideMoveTest(unittest.TestCase):
    def rule(self, match: dict, changes: dict) -> dict:
        return _normalize_rule({"match": match, "set": changes, "proposedBy": "测试", "proposedAt": "测试", "reason": "测试"}, 0, Path("测试.yml"))

    def test_administrative_weekday_moves_date_within_week(self) -> None:
        result = {"source": {"grade": "2024", "majorCode": "CS"}, "groups": [{"groupId": "1", "events": [{"date": "2026-10-23", "week": 8, "weekday": 5, "slot": 2, "title": "甲", "teacher": "乙", "room": "B101"}, {"date": "2026-10-21", "week": 8, "weekday": 3, "slot": 2, "title": "丙", "teacher": "丁", "room": "B102"}]}]}
        rules = [self.rule({"kind": "administrative", "grade": "2024", "majorCode": "CS", "title": "甲"}, {"weekday": 2, "slot": 3})]

        self.assertEqual(apply_administrative_overrides(result, rules), {0})
        self.assertEqual(result["groups"][0]["events"][0], {"date": "2026-10-20", "week": 8, "weekday": 2, "slot": 3, "title": "甲", "teacher": "乙", "room": "B101"})

    def test_language_move_only_splits_selected_weeks(self) -> None:
        classes = [{"language": "German", "kind": "standard", "section": "V", "level": "PHD", "classNumber": "7", "meetings": [{"startWeek": 1, "endWeek": 17, "weekday": 2, "slot": 1, "teachers": ["甲"], "room": "A303"}]}]
        rules = [self.rule({"kind": "german", "section": "V", "level": "PHD", "classNumber": "7", "weeks": {"from": 8, "to": 17}}, {"weekday": 3})]

        self.assertEqual(apply_language_overrides(classes, rules), {0})
        self.assertEqual([(item["startWeek"], item["endWeek"], item["weekday"]) for item in classes[0]["meetings"]], [(1, 7, 2), (8, 17, 3)])

    def test_empty_changes_are_rejected(self) -> None:
        with self.assertRaises(ValueError): self.rule({"kind": "german", "section": "V", "level": "PHD", "classNumber": "7"}, {})

class DayMoveTest(unittest.TestCase):
    def day_moves(self) -> list:
        return [_normalize_day_move({"moves": [{"from": date(2026, 9, 28), "to": "2026-10-10"}], "proposedBy": "测试", "proposedAt": "测试", "reason": "测试"}, 0, Path("测试.yml"))]

    def test_administrative_events_move_and_leave_holiday(self) -> None:
        result = {"calendar": {"startDate": "2026-08-31"}, "groups": [{"groupId": "1", "events": [{"date": "2026-09-28", "week": 5, "weekday": 1, "slot": 2, "title": "甲", "teacher": "乙", "room": "B101"}, {"date": "2026-09-29", "week": 5, "weekday": 2, "slot": 1, "title": "丙", "teacher": "丁", "room": "B102"}], "notices": []}]}

        self.assertEqual(apply_administrative_day_moves(result, self.day_moves()), {0})
        group = result["groups"][0]
        self.assertEqual([(item["date"], item["week"], item["weekday"]) for item in group["events"]], [("2026-09-29", 5, 2), ("2026-10-10", 6, 6)])
        self.assertIn({"label": "Holiday", "startDate": "2026-09-28", "endDate": "2026-09-28", "startWeek": 5, "endWeek": 5}, group["notices"])

    def test_weekly_meetings_split_out_moved_week(self) -> None:
        meetings = [{"startWeek": 1, "endWeek": 17, "weekday": 1, "slot": 3, "teachers": ["甲"], "room": "A301"}, {"startWeek": 1, "endWeek": 17, "weekday": 2, "slot": 3, "teachers": ["乙"], "room": "A302"}]
        moved = apply_meeting_day_moves(meetings, self.day_moves(), "2026-08-31")

        self.assertEqual([(item["startWeek"], item["endWeek"], item["weekday"]) for item in moved], [(1, 4, 1), (1, 17, 2), (6, 6, 6), (6, 17, 1)])

if __name__ == "__main__":
    unittest.main()
