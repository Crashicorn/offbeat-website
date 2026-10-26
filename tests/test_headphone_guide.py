#!/usr/bin/env python3
"""Editorial, asset-credit and rig-handoff checks for the fit-first headphone guide."""
import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "best-dj-headphones-2026.html"


class Markup(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.images = []
        self.ids = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "img":
            self.images.append((attrs.get("src"), attrs.get("alt", "")))
        if attrs.get("id"):
            self.ids.append(attrs["id"])


class HeadphoneGuideTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.doc = Markup()
        cls.doc.feed(cls.html)

    def test_three_use_cases_and_fit_dimensions_are_explicit(self):
        for phrase in ["Quick one-ear booth cueing", "Home practice + production", "Premium over-ear DJ pair", "Passive isolation", "glasses", "on-ear", "over-ear", "replaceable pads"]:
            self.assertIn(phrase.lower(), self.html.lower())
        headers = re.search(r"<thead>(.*?)</thead>", self.html, re.S).group(1)
        for heading in ["Cup shape", "One-ear cueing", "Isolation to check", "Comfort / wear"]:
            self.assertIn(heading, headers)

    def test_exact_photo_and_illustrations_are_honestly_labeled(self):
        photos = [(src, alt) for src, alt in self.doc.images if src == "assets/img/products/photos/sennheiser-hd25-commons.jpg"]
        self.assertEqual(len(photos), 1)
        self.assertIn("Sennheiser HD 25-1", photos[0][1])
        self.assertIn("Bizzarle", self.html)
        self.assertIn("CC BY-SA 4.0", self.html)
        self.assertIn("pioneer-hdj-x10-outline.svg", self.html)
        self.assertIn("not a product photograph", self.html.lower())

    def test_rig_links_match_real_catalog_entries(self):
        catalog = json.loads((ROOT / "assets/dj-gear-catalog.json").read_text())
        ids = {item["id"] for item in catalog["items"]}
        self.assertIn("sennheiser-hd25", ids)
        self.assertIn("ath-m50x", ids)
        self.assertIn('href="build-your-dj-setup.html?add=sennheiser-hd25"', self.html)
        self.assertIn('href="build-your-dj-setup.html?add=ath-m50x"', self.html)
        self.assertIn("HDJ-X10 is not currently a selectable headphone", self.html)
        self.assertIn('href="build-your-dj-setup.html?start=guide"', self.html)

    def test_hearing_safety_and_source_prices_are_caveated(self):
        self.assertIn("not a safe listening target", self.html.lower())
        self.assertIn("not a live retailer quote", self.html.lower())
        self.assertNotIn("120 dB SPL handles", self.html)
        self.assertIn("sennheiser.com/en-us/catalog/products/headphones/hd-25", self.html)
        self.assertIn("pioneerdj.com/en/product/headphones/hdj-x10-k", self.html)
        self.assertIn("audio-technica.com/en-us/ath-m50x", self.html)

    def test_faq_schema_and_anchors_are_current(self):
        scripts = re.findall(r'<script type="application/ld\+json">(.*?)</script>', self.html, re.S)
        objects = [json.loads(script) for script in scripts]
        faq = next(item for item in objects if item.get("@type") == "FAQPage")
        self.assertEqual(len(faq["mainEntity"]), 5)
        self.assertNotIn("ItemList", [item.get("@type") for item in objects])
        self.assertEqual(len(self.doc.ids), len(set(self.doc.ids)))
        self.assertIn("headphone-fit.js", self.html)


if __name__ == "__main__":
    unittest.main()
