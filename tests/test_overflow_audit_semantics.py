"""Regression tests for the sitewide overflow release-audit contract."""

import shutil
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

from tools.overflow_audit_portable import MEASURE, external_image_hosts


class OverflowAuditContractTests(unittest.TestCase):
    def test_external_hosts_are_exact_not_substring_matches(self):
        hosts = external_image_hosts(
            [
                "http://127.0.0.1:8099/local.png",
                "https://cdn.example.org/photo.jpg",
                "https://cdn.127.0.0.1:8099.evil.example/photo.jpg",
                "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
            ],
            "http://127.0.0.1:8099/",
        )
        self.assertEqual(
            hosts,
            ["cdn.127.0.0.1:8099.evil.example", "cdn.example.org"],
        )

    def test_html_spill_is_detected_without_svg_text_false_positive(self):
        chrome = next(
            (shutil.which(name) for name in ("google-chrome", "chromium", "chromium-browser")
             if shutil.which(name)),
            None,
        )
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=chrome) if chrome else playwright.chromium.launch()
            page = browser.new_page(viewport={"width": 390, "height": 844})
            try:
                page.set_content(
                    '<div style="width:90px;overflow:visible">'
                    '<span style="display:block;width:180px;height:25px">real spill</span>'
                    '</div>'
                )
                self.assertGreater(page.evaluate(MEASURE)["spillVisible"], 0)

                page.set_content(
                    '<svg width="200" height="100" viewBox="0 0 200 100">'
                    '<text x="0" y="30" font-size="24">'
                    'SVG text uses its own viewBox geometry, not CSS scrollWidth'
                    '</text></svg>'
                )
                self.assertEqual(page.evaluate(MEASURE)["spillVisible"], 0)

                page.set_content('<img src="data:image/png;base64,not-an-image">')
                page.wait_for_function("document.images[0].complete")
                self.assertEqual(page.evaluate(MEASURE)["imgBroken"], 1)
            finally:
                browser.close()

    def test_related_guide_card_css_does_not_style_heading_permalink(self):
        chrome = next(
            (shutil.which(name) for name in ("google-chrome", "chromium", "chromium-browser")
             if shutil.which(name)),
            None,
        )
        css = (Path(__file__).resolve().parents[1] / "assets/style.css").read_text()
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=chrome) if chrome else playwright.chromium.launch()
            page = browser.new_page(viewport={"width": 390, "height": 844})
            try:
                page.set_content(
                    "<style>" + css + "</style>"
                    '<section class="related-articles">'
                    '<h2 class="anchored">Related guides'
                    '<a class="heading-anchor" href="#related">#</a></h2>'
                    '<ul><li><a id="guide-card" href="guide.html">Actual guide</a></li></ul>'
                    '</section>'
                )
                permalink = page.locator("h2 .heading-anchor").evaluate(
                    "(el) => ({ padding: getComputedStyle(el).paddingLeft,"
                    " pseudo: getComputedStyle(el, '::before').content,"
                    " spill: el.scrollWidth - el.clientWidth })"
                )
                card = page.locator("#guide-card").evaluate(
                    "(el) => ({ padding: getComputedStyle(el).paddingLeft,"
                    " pseudo: getComputedStyle(el, '::before').content })"
                )
                self.assertEqual(permalink["padding"], "0px")
                self.assertIn(permalink["pseudo"], ("none", "normal"))
                self.assertLessEqual(permalink["spill"], 2)
                self.assertNotEqual(card["padding"], "0px")
                self.assertIn("→", card["pseudo"])
            finally:
                browser.close()


if __name__ == "__main__":
    unittest.main()
