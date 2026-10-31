"""Regression tests for the sitewide overflow release-audit contract."""

import shutil
import unittest

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


if __name__ == "__main__":
    unittest.main()
