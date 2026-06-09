"""Interval utilities.

merge_intervals(intervals) takes a list of [start, end] pairs and returns the
merged list in ascending order, combining any intervals that overlap or touch.
"""


def merge_intervals(intervals):
    if not intervals:
        return []
    merged = [list(intervals[0])]
    for start, end in intervals[1:]:
        last = merged[-1]
        if start < last[1]:
            last[1] = max(last[1], end)
        else:
            merged.append([start, end])
    return merged
