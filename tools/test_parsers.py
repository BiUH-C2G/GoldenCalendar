#!/usr/bin/env python3
"""验证课表解析器的关键日期算法"""

from datetime import date
import unittest

from parse_timetables import derive_calendar_start


class ParserDateTest(unittest.TestCase):
    def test_derive_first_monday(self) -> None:
        self.assertEqual(derive_calendar_start(date(2026, 9, 23), 4, 3), date(2026, 8, 31))

    def test_empty_monday_does_not_shift_anchor(self) -> None:
        self.assertEqual(derive_calendar_start(date(2026, 9, 1), 1, 2), date(2026, 8, 31))


if __name__ == "__main__":
    unittest.main()
