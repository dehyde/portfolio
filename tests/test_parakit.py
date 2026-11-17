import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class ParakitCaseStudyTest(unittest.TestCase):
    def test_homepage_links_to_protected_case_study(self):
        page = (ROOT / 'index.html').read_text()
        self.assertIn('href="cases/parakit.html"', page)
        self.assertIn('data-protected-case="Parakit"', page)

    def test_learnings_are_linked_and_follow_the_work(self):
        page = (ROOT / 'cases/parakit.html').read_text()
        self.assertIn('href="#learnings"', page)
        self.assertGreater(page.index('id="learnings"'), page.index('id="outcome"'))
        self.assertIn('Onboarding is part of the experience', page)

    def test_case_study_has_recordings_and_navigation(self):
        page = (ROOT / 'cases/parakit.html').read_text()
        self.assertIn('href="../index.html#work"', page)
        self.assertIn('parakit-setup-of-local-preview.mp4', page)
        self.assertIn('parakit-skill-visual-user-flows.mp4', page)
        self.assertIn('parakit-direct-select-manual-edit-full.mp4', page)

if __name__ == '__main__':
    unittest.main()
