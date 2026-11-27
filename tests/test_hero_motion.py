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

    def object_timing(self, element):
        paths = element.findall('.//{*}path')
        self.assertTrue(paths, element.get('id'))
        draws, erases = zip(*(self.stroke_timing(path) for path in paths))
        return active_span(draws), active_span(erases)

    def test_polished_preview_uses_the_same_scene_timelines(self):
        page = ROOT / 'previews' / 'polished-hero.html'
        preview = IntroAssets()
        preview.feed(page.read_text())
        animation = ET.parse(page.parent / urlsplit(preview.animation).path).getroot()
        self.assertEqual(animation.attrib, self.animation.attrib)
        scenes = animation.findall('{*}g')
        self.assertEqual([g.get('id') for g in scenes], [g.get('id') for g in self.scenes])

        def timeline(scene):
            return [(e.tag, {k: v for k, v in e.attrib.items() if k != 'd'}) for e in scene.iter()]

        for polished, original in zip(scenes, self.scenes):
            with self.subTest(scene=polished.get('id')):
                self.assertEqual(timeline(polished), timeline(original))
                self.assertNotEqual([p.get('d') for p in polished.findall('.//{*}path')],
                                    [p.get('d') for p in original.findall('.//{*}path')])

        self.assert_workflow_poster(page.parent, preview, animation)

    def assert_workflow_poster(self, directory, hero, animation):
        self.assertIsNotNone(hero.poster)
        self.assertEqual(hero.poster.get('alt'), '')
        poster = ET.parse(directory / urlsplit(hero.poster['src']).path).getroot()
        self.assertEqual(poster.get('viewBox'), animation.get('viewBox'))
        for element in poster.iter():
            tag = element.tag.rsplit('}', 1)[-1]
            self.assertNotIn(tag, {'animate', 'animateTransform', 'animateMotion', 'set', 'script'})

        def artwork(element, hold_time=None, pose=()):
            transform = element.get('transform')
            track = element.find('{*}animateTransform')
            if track is not None and hold_time is not None:
                self.assertEqual(track.get('type'), 'translate')
                before, after = next((a, b) for s, e, a, b in keyframe_intervals(track, str)
                                     if s <= hold_time < e)
                self.assertEqual(before, after, 'Workflow must be still during its hold')
                transform = f'translate({before})'
            if transform and transform not in ('translate(0 0)', 'translate(0,0)'):
                pose += (transform,)
            if element.tag.rsplit('}', 1)[-1] == 'path':
                yield element.get('d'), pose
            for child in element:
                yield from artwork(child, hold_time, pose)

        workflow = animation.find('{*}g[@id="branching-flow"]')
        self.assertIsNotNone(workflow)
        (_, drawn), (erasing, _) = self.object_timing(workflow)
        paths = list(artwork(workflow, hold_time=(drawn + erasing) / 2))
        self.assertTrue(paths)
        self.assertEqual(list(artwork(poster)), paths)

    def test_homepage_has_a_static_workflow_fallback(self):
        self.assert_workflow_poster(ROOT, self.hero, self.animation)

    def test_five_scenes_start_ten_seconds_apart_in_a_fifty_second_loop(self):
        names = ['branching-flow', 'linked-screens', 'mouse-reorder', 'shared-fields', 'metric-study']
        self.assertEqual([scene.get('id') for scene in self.scenes], names)
        for index, scene in enumerate(self.scenes):
            with self.subTest(scene=scene.get('id')):
                start = index * 10
                for track in scene.iter():
                    if track.tag.rsplit('}', 1)[-1].startswith('animate'):
                        self.assertEqual(float(track.get('begin', '0s').removesuffix('s')), start)
                        self.assertEqual(float(track.get('dur').removesuffix('s')), 50)
                (draw_start, _), _ = self.object_timing(scene)
                self.assertAlmostEqual(draw_start, start, delta=.001)

    def test_every_scene_fades_in_and_out(self):
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
