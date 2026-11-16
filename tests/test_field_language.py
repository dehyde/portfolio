import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.images = []
        self.ids = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.append(attrs['id'])
        if tag == 'img':
            self.images.append(attrs)


class FieldLanguageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / 'cases/custom-fields.html').read_text()
        cls.page = Page(cls.html)
        cls.css = (ROOT / 'files/case-study-field-language.css').read_text()

    def test_collage_preserves_original_asset_and_loads_existing_images(self):
        collage = self.html.split('<div class="cf-collage reveal"', 1)[1].split('</section>', 1)[0]
        images = Page(collage).images
        self.assertEqual(len(images), 3)
        self.assertIn('../files/hero-ui.png', [image['src'] for image in images])
        for image in images:
            self.assertTrue((ROOT / 'cases' / image['src']).is_file())
            self.assertTrue(image['alt'])
            self.assertTrue(int(image['width']) > 0 and int(image['height']) > 0)

    def test_chips_are_contextual_not_section_end_decorations(self):
        for section in ('project-flexibility', 'reuse-before-creation'):
            content = self.html.split(f'id="{section}"', 1)[1].split('</header>', 1)[0]
            self.assertNotIn('class="cf-field-example"', content)
            self.assertNotIn('class="cf-definition"', content)
        self.assertEqual(self.html.count('class="cf-definition"'), 3)
        self.assertEqual(self.html.count('class="cf-value"'), 1)

    def test_navigation_ids_are_unique(self):
        self.assertEqual(len(self.page.ids), len(set(self.page.ids)))

    def test_layout_keeps_upright_images_and_legible_value_type(self):
        self.assertNotIn('rotate(', self.css)
        self.assertNotIn('perspective', self.css)
        self.assertIn('font-variation-settings: normal', self.css)


if __name__ == '__main__':
    unittest.main()
