import pathlib
import re
import unittest
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1]

class Frames(HTMLParser):
    def __init__(self):
        super().__init__()
        self.frames = []
    def handle_starttag(self, tag, attrs):
        if tag == 'iframe':
            self.frames.append(dict(attrs))

class CreationStoryTests(unittest.TestCase):
    def test_both_versions_are_available_as_interactive_examples(self):
        parser = Frames()
        parser.feed((ROOT / 'cases/workplan.html').read_text())
        frames = [frame for frame in parser.frames if 'workplan-create-' in frame.get('src', '')]
        self.assertEqual(len(frames), 2)
        for frame in frames:
            self.assertTrue(frame.get('title'))
            self.assertTrue((ROOT / 'cases' / frame['src']).resolve().is_file())

    def test_each_version_has_its_own_example_and_version_two_recordings(self):
        page = (ROOT / 'cases/workplan.html').read_text()
        self.assertLess(page.index('Version 1: Before usability testing'), page.index('workplan-create-v1.html'))
        self.assertLess(page.index('workplan-create-v1.html'), page.index('Version 2: Improved and proven'))
        self.assertLess(page.index('Version 2: Improved and proven'), page.index('workplan-create-v2.html'))
        recordings = re.findall(r'data-motion="(\.\./assets/workplan-creation/[^"]+\.gif)"', page)
        self.assertEqual(len(set(recordings)), 9)

    def test_anatomy_shares_the_page_motion_control(self):
        page = (ROOT / 'cases/workplan.html').read_text()
        anatomy = page.split('id="create-control-anatomy"', 1)[1].split('</section>', 1)[0]
        images = re.findall(r'<img ([^>]+)>', anatomy)
        self.assertEqual(len(images), 3)
        for image, view in zip(images[1:], ('ghost', 'details')):
            revised = dict(re.findall(r'([\w-]+)="([^"]*)"', image))
            self.assertIn('motion', revised['class'].split())
            self.assertEqual(revised['src'], revised['data-still'])
            self.assertTrue(revised['data-motion'].endswith(f'anatomy-{view}.webp'))
            self.assertNotEqual(revised['data-motion'], revised['data-still'])
            for attribute in ('data-motion', 'data-still'):
                self.assertTrue((ROOT / 'cases' / revised[attribute]).is_file())
        self.assertIn('name="anatomy-view" value="cursors" checked', anatomy)
        self.assertIn('name="anatomy-view" value="details">', anatomy)

    def test_reset_starts_hidden_in_both_examples(self):
        for version in ('v1', 'v2'):
            example = (ROOT / f'files/workplan-create-{version}.html').read_text()
            self.assertIn('id="reset" hidden', example)

    def test_first_example_includes_milestones(self):
        example = (ROOT / 'files/workplan-create-v1.html').read_text()
        self.assertNotIn("if (mode === 'new') items.push(['◇', 'New milestone'", example)
        self.assertIn("items.push(['◇', 'New milestone'", example)

    def test_recordings_do_not_exceed_their_native_width(self):
        page = (ROOT / 'cases/workplan.html').read_text()
        self.assertIn('creation-recordings img{width:auto;max-width:100%', page)

    def test_stale_untested_claim_is_removed(self):
        self.assertNotIn('The redesigned flow hasn’t been tested with users yet.', (ROOT / 'cases/workplan.html').read_text())

if __name__ == '__main__':
    unittest.main()
