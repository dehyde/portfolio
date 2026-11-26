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


class HeroMotionTest(unittest.TestCase):
    def test_the_hero_has_a_static_decorative_fallback(self):
        hero = IntroAssets()
        hero.feed((ROOT / 'index.html').read_text())
        self.assertIsNotNone(hero.poster)
        self.assertEqual(hero.poster.get('alt'), '')
        poster = ET.parse(ROOT / urlsplit(hero.poster['src']).path).getroot()
        animation = ET.parse(ROOT / urlsplit(hero.animation).path).getroot()
        self.assertEqual(poster.get('viewBox'), animation.get('viewBox'))
        for element in poster.iter():
            tag = element.tag.rsplit('}', 1)[-1]
            self.assertNotIn(tag, {'animate', 'animateTransform', 'animateMotion', 'set', 'script'})
        self.assertGreater(len(poster.findall('.//{*}path')), 0)

    def test_every_scene_fades_in_and_out_while_its_strokes_erase_forward(self):
        hero = IntroAssets()
        hero.feed((ROOT / 'index.html').read_text())
        animation = ET.parse(ROOT / urlsplit(hero.animation).path).getroot()
        scenes = animation.findall('{*}g')
        self.assertEqual(len(scenes), 6)
        for scene in scenes:
            with self.subTest(scene=scene.get('id')):
                opacity = scene.find('{*}animate[@attributeName="opacity"]')
                self.assertIsNotNone(opacity)
                self.assertNotEqual(opacity.get('calcMode'), 'discrete')
                values = list(map(float, opacity.get('values').split(';')))
                times = list(map(float, opacity.get('keyTimes').split(';')))
                duration = float(opacity.get('dur').removesuffix('s'))
                transitions = [
                    (a, b) for a, b, t0, t1 in zip(values, values[1:], times, times[1:])
                    if (t1 - t0) * duration >= 0.25
                ]
                self.assertTrue(any(b > a for a, b in transitions), 'Missing fade-in')
                self.assertTrue(any(b < a for a, b in transitions), 'Missing fade-out')
                for path in scene.findall('.//{*}path'):
                    dash = path.find('{*}animate[@attributeName="stroke-dashoffset"]')
                    self.assertIsNotNone(dash, path.get('id'))
                    offsets = list(map(float, dash.get('values').split(';')))
                    dash_times = list(map(float, dash.get('keyTimes').split(';')))
                    forward_erase = any(
                        a >= 0 > b and t1 > t0
                        for a, b, t0, t1 in zip(offsets, offsets[1:], dash_times, dash_times[1:])
                    )
                    self.assertTrue(forward_erase, f'No forward erase on {path.get("id")}')


if __name__ == '__main__':
    unittest.main()
