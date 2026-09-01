import json
from playwright.sync_api import sync_playwright

document = {
    "schemaVersion": 1,
    "boardId": "dual-830-trimmed-v1",
    "projectName": "LED 限流验收",
    "components": [
        {"id": "r1", "kind": "resistor", "pins": ["t-0-0-2", "t-0-0-7"], "rotation": 0, "value": 1000, "label": "1 kΩ"},
        {"id": "led1", "kind": "led", "pins": ["t-0-1-7", "t-0-1-12"], "rotation": 0, "value": 0.01, "color": "#ef3d32", "label": "红色 LED"},
    ],
    "wires": [
        {"id": "w1", "from": "rail-top-positive-0", "to": "t-0-1-2", "color": "#e4523d"},
        {"id": "w2", "from": "t-0-2-12", "to": "rail-top-negative-0", "color": "#232a28"},
    ],
    "viewport": {"x": 0, "y": 0, "scale": 1},
}
draft = json.dumps({"projectId": None, "document": document})

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    context.add_init_script(f"localStorage.setItem('cycore_breadboard_draft_v1', {json.dumps(draft)});")
    page = context.new_page()
    page.goto("http://127.0.0.1:5174/circuit/breadboard/", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    status_text = page.locator(".engine-pill span").inner_text()
    assert status_text == "实时求解", f"unexpected engine status: {status_text}"
    frame = page.frame(url=lambda url: "/circuit-engine/circuitjs.html" in url)
    assert frame is not None, "CircuitJS same-origin iframe did not load"
    page.wait_for_timeout(1200)
    led_current = page.locator("iframe").evaluate("""frame => {
      const elements = frame.contentWindow.CircuitJS1.getElements();
      const led = elements.find(element => element.getType() === 'LEDElm');
      return led ? led.getCurrent() : null;
    }""")
    assert led_current is not None and 0.001 < abs(led_current) < 0.01, f"unexpected LED current: {led_current}"
    page.locator("iframe").evaluate("""frame => {
      const sim = frame.contentWindow.CircuitJS1;
      const reversed = sim.exportCircuit().split('\\n').map(line => {
        if (!line.startsWith('162 ')) return line;
        const parts = line.split(' ');
        return [parts[0], parts[3], parts[4], parts[1], parts[2], ...parts.slice(5)].join(' ');
      }).join('\\n');
      sim.importCircuit(reversed, false);
      sim.setSimRunning(true);
    }""")
    page.wait_for_timeout(700)
    reverse_current = page.locator("iframe").evaluate("""frame => {
      const led = frame.contentWindow.CircuitJS1.getElements().find(element => element.getType() === 'LEDElm');
      return led ? led.getCurrent() : null;
    }""")
    assert reverse_current is not None and abs(reverse_current) < 0.000001, f"reversed LED should be off: {reverse_current}"
    page.screenshot(path="/tmp/breadboard-engine-ready.png", full_page=True)
    print(f"CircuitJS iframe connected; LED forward={led_current:.6f} A, reverse={reverse_current:.3e} A", flush=True)
    browser.close()
