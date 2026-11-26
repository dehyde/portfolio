from pathlib import Path
import unittest
from html.parser import HTMLParser

class Cards(HTMLParser):
    def __init__(self):
        super().__init__(); self.labels = 0
    def handle_data(self, data):
        if data == 'Target users': self.labels += 1

class TargetUsersTest(unittest.TestCase):
    def test_each_card_has_a_label_and_no_divider(self):
        root = Path(__file__).resolve().parent.parent
        cards = Cards(); cards.feed((root / 'index.html').read_text())
        self.assertEqual(cards.labels, 4)
        css = (root / 'style.css').read_text()
        self.assertNotIn('.card-bottom{margin-top:auto;border-top:', css)

if __name__ == '__main__': unittest.main()
