import re
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG_NS = "{http://www.w3.org/2000/svg}"


class GovernanceVisualTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script = (ROOT / "files/case-study-governance-visuals.js").read_text()
        markup = re.search(r'element.innerHTML = `(<svg.*?</svg>)`;', script, re.S)
        if not markup:
            raise AssertionError("Governance SVG not found")
        cls.svg = ET.fromstring(markup.group(1).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1))
        cls.css = (ROOT / "files/case-study-governance.css").read_text()

    def find(self, name):
        return next((node for node in self.svg.iter() if name in node.get("class", "").split()), None)

    def test_definitions_are_bright_chips(self):
        for name in ("gv-shared-definition", "gv-private-definition"):
            node = self.find(name)
            self.assertIsNotNone(node, name)
            self.assertIsNotNone(node.find(f"{SVG_NS}rect"), name)
            self.assertIn("gv-definition", node.attrib["class"])
        self.assertRegex(self.css, r"\.gv-definition\s*\{[^}]*fill:\s*#e6e5d9")

    def test_saved_value_is_nested_in_bright_definition(self):
        node = self.find("gv-retained-definition")
        self.assertIsNotNone(node)
        self.assertIsNotNone(node.find(f"{SVG_NS}rect[@class='gv-definition']"))
        self.assertIsNotNone(node.find(f"{SVG_NS}rect[@class='gv-value-surface']"))
        text = " ".join(node.itertext())
        self.assertIn("MEP approval", text)
        self.assertIn("Plumbing", text)
        self.assertRegex(self.css, r"\.gv-value-surface\s*\{[^}]*fill:\s*#30372f")

    def test_removed_option_and_saved_value_still_have_distinct_animation_targets(self):
        for name in ("gv-option-token", "gv-option-strike", "gv-retained-token", "gv-removed-label"):
            self.assertIsNotNone(self.find(name), name)


if __name__ == "__main__":
    unittest.main()
