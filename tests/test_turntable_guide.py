#!/usr/bin/env python3
"""Focused editorial and accessibility regression checks for the turntable guide."""
import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "best-dj-turntables-2026.html"


class Markup(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.images = []
        self.inputs = []
        self.faq_text = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.append(a["id"])
        if tag == "img":
            self.images.append((a.get("src"), a.get("alt")))
        if tag == "input":
            self.inputs.append(a)


class TurntableGuideTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.doc = Markup()
        cls.doc.feed(cls.html)

    def test_authentic_mk2_photo_is_identified_and_credited(self):
        img = next((alt for src, alt in self.doc.images if src == "assets/img/editorial/technics-sl-1200mk2-wikimedia.jpg"), None)
        self.assertEqual(img, "Technics SL-1200MK2 direct-drive turntable, viewed from above")
        self.assertIn("Technics SL-1200MK2, not the MK7.", self.html)
        self.assertIn("Dydric", self.html)
        self.assertIn("32bitmaschine", self.html)
        self.assertIn("CC BY-SA 2.5", self.html)
        self.assertTrue((ROOT / "assets/img/editorial/technics-sl-1200mk2-wikimedia.LICENSE.txt").exists())

    def test_three_routes_and_rig_handoff_set_realistic_expectations(self):
        for phrase in ["Technics SL-1200 family", "Pioneer DJ PLX-500", "Audio-Technica AT-LP120XUSB", "DVS", "PHONO", "LINE"]:
            self.assertIn(phrase, self.html)
        self.assertIn("turntables and cartridges are not currently selectable there", self.html.lower())
        self.assertIn('href="build-your-dj-setup.html?start=guide"', self.html)
        self.assertIn('href="controller-software-compatibility-matrix.html"', self.html)

    def test_cost_planner_is_user_priced_and_accessible(self):
        self.assertEqual(len(re.findall(r'data-tt-price(?:\s|>)', self.html)), 6)
        self.assertIn('data-tt-unit', self.html)
        self.assertIn('data-tt-quantity', self.html)
        self.assertIn('aria-live="polite"', self.html)
        self.assertIn("does not fetch live prices or guess", self.html)
        self.assertIn('src="assets/turntable-budget.js"', self.html)

    def test_faq_schema_matches_visible_faq_and_old_ranked_list_is_gone(self):
        scripts = re.findall(r'<script type="application/ld\+json">(.*?)</script>', self.html, re.S)
        objects = [json.loads(item) for item in scripts]
        faq = next(obj for obj in objects if obj.get("@type") == "FAQPage")
        self.assertEqual(len(faq["mainEntity"]), 5)
        self.assertNotIn("ItemList", [obj.get("@type") for obj in objects])
        self.assertNotIn("Turntable Comparison Table", self.html)
        self.assertIn('id="faq"', self.html)

    def test_anchor_ids_are_unique(self):
        duplicates = sorted({item for item in self.doc.ids if self.doc.ids.count(item) > 1})
        self.assertEqual(duplicates, [])


if __name__ == "__main__":
    unittest.main()
