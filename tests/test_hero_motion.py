from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re
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


def keyframe_intervals(track, parse_value=float):
    """Return each interpolated segment in seconds from the start of playback."""
    period = float(track.get('dur').removesuffix('s'))
    begin = float(track.get('begin', '0s').removesuffix('s'))
    times = [begin + period * float(t) for t in track.get('keyTimes').split(';')]
    values = [parse_value(v) for v in track.get('values').split(';')]
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

    def interview_objects(self, scene):
        names = ('interview-a', 'interview-b', 'interview-c', 'idea-a', 'idea-b')
        groups = {}
        for name in names:
            group = scene.find(f'.//{{*}}g[@id="{name}"]')
            self.assertIsNotNone(group, f'Missing interview object: {name}')
            groups[name] = group
        return groups

    def object_timing(self, element):
        paths = element.findall('.//{*}path')
        self.assertTrue(paths, element.get('id'))
        draws, erases = zip(*(self.stroke_timing(path) for path in paths))
        return active_span(draws), active_span(erases)

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

    def test_each_scene_has_five_seconds_to_draw_and_five_to_exit(self):
        for scene in self.scenes:
            with self.subTest(scene=scene.get('id')):
                (draw_start, draw_end), (erase_start, erase_end) = self.object_timing(scene)
                self.assertAlmostEqual(draw_end - draw_start, 5, delta=0.001)
                self.assertAlmostEqual(erase_end - erase_start, 5, delta=0.001)

    def test_interview_uses_the_workflow_pen_stagger_and_scene_fade(self):
        def overlap(first, following):
            (a, b), (c, d) = first, following
            return (b - c) / min(b - a, d - c)

        research = self.animation.find('{*}g[@id="research-synthesis"]')
        workflow = self.animation.find('{*}g[@id="branching-flow"]')
        reference = [self.stroke_timing(p)[0] for p in workflow.findall('{*}path')[:2]]
        stagger = overlap(*reference)
        for group in self.interview_objects(research).values():
            self.assertEqual(group.findall('.//{*}animate[@attributeName="opacity"]'), [])
        strokes = sorted(self.stroke_timing(p) for p in research.findall('.//{*}path'))
        for (draw, erase), (next_draw, next_erase) in zip(strokes, strokes[1:]):
            self.assertAlmostEqual(overlap(draw, next_draw), stagger, delta=.001)
            self.assertAlmostEqual(overlap(erase, next_erase), stagger, delta=.001)

    def test_interview_ideas_follow_their_bubbles_and_every_object_holds(self):
        scene = self.animation.find('{*}g[@id="research-synthesis"]')
        objects = self.interview_objects(scene)
        timings = {name: self.object_timing(group) for name, group in objects.items()}
        start = min(draw[0] for draw, _ in timings.values())
        for name, (draw, erase) in timings.items():
            with self.subTest(object=name):
                self.assertLessEqual(draw[1], start + 5.001)
                self.assertGreaterEqual(erase[0], start + 6.999)
        for bubble, idea in [('interview-a', 'idea-a'), ('interview-c', 'idea-b')]:
            delay = timings[idea][0][0] - timings[bubble][0][0]
            self.assertTrue(0 < delay <= 1.001, f'{idea} starts {delay:.3f}s after {bubble}')

    def test_each_interview_bubble_has_one_straight_speech_line(self):
        scene = self.animation.find('{*}g[@id="research-synthesis"]')
        for name in ('interview-a', 'interview-b', 'interview-c'):
            with self.subTest(bubble=name):
                paths = scene.find(f'.//{{*}}g[@id="{name}"]').findall('.//{*}path')
                self.assertEqual(len(paths), 2, 'Expected one outline and one remark')
                straight = 0
                for path in paths:
                    d = path.get('d')
                    commands = ''.join(re.findall(r'[MmLlHhVvCcSsQqTtAaZz]', d)).upper()
                    coordinates = re.findall(r'[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?', d)
                    if ((commands in ('M', 'ML') and len(coordinates) == 4) or
                            (commands in ('MH', 'MV') and len(coordinates) == 3)):
                        straight += 1
                self.assertEqual(straight, 1)
        for element in scene.iter():
            self.assertNotIn('rotate', element.get('transform', ''))
            self.assertNotEqual(element.get('type'), 'rotate')

    def test_hover_select_then_drag_swaps_the_two_cards(self):
        def moves(element_id, transform):
            group = self.animation.find(f'.//{{*}}g[@id="{element_id}"]')
            self.assertIsNotNone(group, element_id)
            track = group.find(f'{{*}}animateTransform[@type="{transform}"]')
            self.assertIsNotNone(track, element_id)
            def vector(raw):
                return tuple(float(n) for n in raw.replace(',', ' ').split())
            return [(s, e, a, b) for s, e, a, b in keyframe_intervals(track, vector) if a != b]

        check = self.animation.find('.//{*}path[@id="reorder-check"]')
        self.assertIsNotNone(check)
        selected = self.animation.find('.//{*}g[@id="card-a"]')
        self.assertIsNotNone(selected)
        self.assertIn(check, selected.iter(), 'The check must travel with the selected card')
        (select_start, select_end), _ = self.stroke_timing(check)
        hover = moves('reorder-hover', 'scale')
        self.assertTrue(hover and hover[0][3][0] > hover[0][2][0])
        self.assertLess(hover[0][1], select_start, 'The hover should register before selection')

        card_a, card_b = moves('card-a', 'translate'), moves('card-b', 'translate')
        drag_start, drop_end = card_a[0][0], card_a[-1][1]
        self.assertLessEqual(select_end, drag_start)
        dy_a = card_a[-1][3][1] - card_a[0][2][1]
        dy_b = card_b[-1][3][1] - card_b[0][2][1]
        self.assertGreater(dy_a, 0)
        self.assertAlmostEqual(dy_a, -dy_b, places=3, msg='Both cards must trade vertical positions')
        scene = next(s for s in self.scenes if check in s.iter())
        _, (exit_start, _) = self.object_timing(scene)
        self.assertLess(max(drop_end, card_b[-1][1]), exit_start)

        pointer = moves('reorder-pointer', 'translate')
        drag = [m for m in pointer if drag_start - .001 <= m[0] and m[1] <= drop_end + .001]
        self.assertTrue(drag, 'The pointer must move with the selected card')
        self.assertAlmostEqual(drag[-1][3][1] - drag[0][2][1], dy_a, places=3)

    def test_each_scene_starts_drawing_while_its_neighbor_is_still_erasing(self):
        visible_windows = []
        periods = set()
        for scene in self.scenes:
            opacity = scene.find('{*}animate[@attributeName="opacity"]')
            periods.add(float(opacity.get('dur').removesuffix('s')))
            visible = active_span((s, e) for s, e, a, b in keyframe_intervals(opacity) if max(a, b) > 0)
            (draw_start, _), (erase_start, erase_end) = self.object_timing(scene)
            visible_draw = max(visible[0], draw_start)
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
