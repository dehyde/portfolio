from html.parser import HTMLParser
from pathlib import Path
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
        poster = ET.parse(ROOT / hero.poster['src']).getroot()
        animation = ET.parse(ROOT / hero.animation).getroot()
        self.assertEqual(poster.get('viewBox'), animation.get('viewBox'))
        for element in poster.iter():
            tag = element.tag.rsplit('}', 1)[-1]
            self.assertNotIn(tag, {'animate', 'animateTransform', 'animateMotion', 'set', 'script'})
        self.assertGreater(len(poster.findall('.//{*}path')), 0)


if __name__ == '__main__':
    unittest.main()
