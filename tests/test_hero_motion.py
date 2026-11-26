from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]


class IntroAssets(HTMLParser):
    """Find the hero image delivered to a browser before JavaScript runs."""

    def __init__(self):
        super().__init__()
        self.in_intro = False
        self.poster = None
        self.animation = None

    def handle_starttag(self, tag, raw_attrs):
        attrs = dict(raw_attrs)
        if tag == 'section' and 'intro' in attrs.get('class', '').split():
            self.in_intro = True
        if self.in_intro and tag == 'img':
            self.poster = attrs
        if self.in_intro and 'data-animation' in attrs:
            self.animation = attrs['data-animation']

    def handle_endtag(self, tag):
        if tag == 'section':
            self.in_intro = False


def keyframe_intervals(track):
    """Return each interpolated segment in seconds from the start of playback."""
    period = float(track.get('dur').removesuffix('s'))
    begin = float(track.get('begin', '0s').removesuffix('s'))
    times = [begin + period * float(t) for t in track.get('keyTimes').split(';')]
    values = [float(v) for v in track.get('values').split(';')]
    return zip(times, times[1:], values, values[1:])


def active_span(intervals):
    """Start of the first and end of the last selected interval."""
    intervals = list(intervals)
    return min(a for a, b in intervals), max(b for a, b in intervals)


class HeroMotionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hero = IntroAssets()
        cls.hero.feed((ROOT / 'index.html').read_text())
        cls.animation = ET.parse(ROOT / urlsplit(cls.hero.animation).path).getroot()
        cls.scenes = cls.animation.findall('{*}g')

    def stroke_timing(self, path):
        dash = path.find('{*}animate[@attributeName="stroke-dashoffset"]')
        self.assertIsNotNone(dash, path.get('id'))
        self.assertEqual(dash.get('repeatCount'), 'indefinite')
        self.assertNotEqual(dash.get('calcMode'), 'discrete', path.get('id'))
        intervals = list(keyframe_intervals(dash))
        draw = [(s, e) for s, e, a, b in intervals if a > b >= 0]
        erase = [(s, e) for s, e, a, b in intervals if 0 >= a > b]
        self.assertTrue(draw and erase, f'Missing draw or forward erase on {path.get("id")}')
        return active_span(draw), active_span(erase)

    def test_the_hero_has_a_static_decorative_fallback(self):
        self.assertIsNotNone(self.hero.poster)
        self.assertEqual(self.hero.poster.get('alt'), '')
        poster = ET.parse(ROOT / urlsplit(self.hero.poster['src']).path).getroot()
        self.assertEqual(poster.get('viewBox'), self.animation.get('viewBox'))
        for element in poster.iter():
            tag = element.tag.rsplit('}', 1)[-1]
            self.assertNotIn(tag, {'animate', 'animateTransform', 'animateMotion', 'set', 'script'})
        self.assertGreater(len(poster.findall('.//{*}path')), 0)

    def test_every_scene_fades_in_and_out(self):
        self.assertEqual(len(self.scenes), 6)
        for scene in self.scenes:
            with self.subTest(scene=scene.get('id')):
                opacity = scene.find('{*}animate[@attributeName="opacity"]')
                self.assertIsNotNone(opacity)
                self.assertEqual(opacity.get('repeatCount'), 'indefinite')
                self.assertNotEqual(opacity.get('calcMode'), 'discrete')
                changes = [(a, b) for s, e, a, b in keyframe_intervals(opacity) if e - s >= 0.25]
                self.assertTrue(any(b > a for a, b in changes), 'Missing fade-in')
                self.assertTrue(any(b < a for a, b in changes), 'Missing fade-out')

    def test_strokes_overlap_in_the_same_order_during_drawing_and_erasing(self):
        for scene in self.scenes:
            with self.subTest(scene=scene.get('id')):
                paths = scene.findall('.//{*}path')
                self.assertGreaterEqual(len(paths), 2)
                strokes = sorted(self.stroke_timing(path) for path in paths)
                for (draw, erase), (next_draw, next_erase) in zip(strokes, strokes[1:]):
                    self.assertTrue(draw[0] < next_draw[0] < draw[1],
                                    f'Draw windows do not overlap in sequence: {draw}, {next_draw}')
                    self.assertTrue(erase[0] < next_erase[0] < erase[1],
                                    f'Erase windows do not overlap in sequence: {erase}, {next_erase}')

    def test_each_scene_has_the_same_total_drawing_and_erasing_time(self):
        durations = []
        for scene in self.scenes:
            draws, erases = zip(*(self.stroke_timing(p) for p in scene.findall('.//{*}path')))
            durations.append([end - start for start, end in (active_span(draws), active_span(erases))])
        for scene, (draw, erase) in zip(self.scenes, durations):
            with self.subTest(scene=scene.get('id')):
                self.assertAlmostEqual(draw, durations[0][0], delta=0.001)
                self.assertAlmostEqual(erase, durations[0][1], delta=0.001)

    def test_each_scene_starts_drawing_while_its_neighbor_is_still_erasing(self):
        visible_windows = []
        periods = set()
        for scene in self.scenes:
            opacity = scene.find('{*}animate[@attributeName="opacity"]')
            periods.add(float(opacity.get('dur').removesuffix('s')))
            visible = active_span((s, e) for s, e, a, b in keyframe_intervals(opacity) if max(a, b) > 0)
            draws, erases = zip(*(self.stroke_timing(p) for p in scene.findall('.//{*}path')))
            visible_draw = max(visible[0], active_span(draws)[0])
            erase_start, erase_end = active_span(erases)
            visible_windows.append((visible_draw, max(visible[0], erase_start), min(visible[1], erase_end)))

        self.assertEqual(len(periods), 1)
        period = periods.pop()
        for i, (_, erase_start, erase_end) in enumerate(visible_windows):
            with self.subTest(outgoing=self.scenes[i].get('id')):
                next_start = visible_windows[(i + 1) % len(visible_windows)][0]
                if i == len(visible_windows) - 1:
                    next_start += period
                self.assertTrue(erase_start < next_start < erase_end,
                                f'Next drawing starts at {next_start} outside erasure {erase_start, erase_end}')


if __name__ == '__main__':
    unittest.main()
