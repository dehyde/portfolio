import math
import re
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class GovernanceIntegrationTest(unittest.TestCase):
    def test_both_levels_share_one_isometric_plane(self):
        script = (ROOT / 'files/case-study-governance-visuals.js').read_text()
        markup = re.search(r'element.innerHTML = `(<svg.*?</svg>)`;', script, re.S).group(1)
        svg = ET.fromstring(markup)
        face = next((n for n in svg.iter('polygon') if n.get('class') == 'gv-plane-face'), None)
        self.assertIsNotNone(face, 'Both levels need a shared isometric plane')
        points = [tuple(map(float, p.split(','))) for p in face.get('points').split()]
        lengths = []
        for i, (x, y) in enumerate(points):
            nx, ny = points[(i + 1) % 4]
            dx, dy = nx - x, ny - y
            self.assertAlmostEqual(abs(dy / dx), math.tan(math.pi / 6), places=6)
            lengths.append(math.hypot(dx, dy))
        self.assertLess(max(lengths) - min(lengths), .001)
        planes = [n for n in svg.iter('use') if 'gv-plane' in n.get('class', '').split()]
        self.assertEqual(len(planes), 2)
        self.assertEqual(planes[0].get('href'), planes[1].get('href'))

    def test_shadow_is_clipped_to_project_surface(self):
        script = (ROOT / 'files/case-study-governance-visuals.js').read_text()
        markup = re.search(r'element.innerHTML = `(<svg.*?</svg>)`;', script, re.S).group(1)
        svg = ET.fromstring(markup)
        layer = next((n for n in svg.iter('g') if n.get('class') == 'gv-shadow-layer'), None)
        self.assertIsNotNone(layer, 'A cast shadow needs its own clipped layer')
        self.assertIn('project-clip', layer.get('clip-path', ''))
        self.assertIsNotNone(layer.find('polygon'))
        self.assertIsNotNone(svg.find('.//feGaussianBlur'))

    def test_static_content_is_visible_without_module_startup(self):
        html = (ROOT / 'cases/custom-fields.html').read_text()
        css = re.search(r'(?<![\w-])\.reveal\s*\{([^}]+)\}', html).group(1)
        self.assertRegex(css, r'opacity:\s*1[;\s]')
        self.assertIn('.reveal.reveal-pending', html)
        self.assertIn("element.classList.add('reveal-pending')", html)


if __name__ == '__main__':
    unittest.main()
