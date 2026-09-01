from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:5174/circuit/breadboard/"


def verify_context(browser, viewport, screenshot_name, touch=False):
    context = browser.new_context(viewport=viewport, has_touch=touch, is_mobile=touch)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
    page.on("console", lambda message: errors.append(f"console: {message.text}") if message.type == "error" else None)
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.get_by_text("元器件库").wait_for()
    page.get_by_text("属性与测量").wait_for()
    page.get_by_test_id("part-resistor").click()
    canvas = page.locator(".canvas-shell canvas").first
    box = canvas.bounding_box()
    assert box, "breadboard canvas did not render"
    page.mouse.click(box["x"] + box["width"] * 0.36, box["y"] + box["height"] * 0.34)
    page.get_by_text("旋转 90°").wait_for()
    page.screenshot(path=f"/tmp/{screenshot_name}", full_page=True)
    assert not errors, "\n".join(errors)
    context.close()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    verify_context(browser, {"width": 1440, "height": 900}, "breadboard-desktop.png")
    verify_context(browser, {"width": 1194, "height": 834}, "breadboard-tablet.png", touch=True)
    browser.close()

for name in ("breadboard-desktop.png", "breadboard-tablet.png"):
    path = Path("/tmp") / name
    print(f"verified {path} ({path.stat().st_size} bytes)")
