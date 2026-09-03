import json
import math
from playwright.sync_api import sync_playwright

document = {
    "schemaVersion": 1,
    "boardId": "dual-830-trimmed-v1",
    "projectName": "LED 限流验收",
    "components": [
        {"id": "r1", "kind": "resistor", "pins": ["t-0-0-2", "t-0-0-7"], "rotation": 0, "value": 1000, "label": "1 kΩ"},
        {"id": "led1", "kind": "led", "pins": ["t-0-1-7", "t-0-1-12"], "rotation": 0, "value": 0.01, "color": "#ef3d32", "label": "红色 LED"},
        {"id": "c1", "kind": "capacitor", "pins": ["t-0-0-20", "t-0-0-25"], "rotation": 0, "value": 0.00001, "variant": "electrolytic", "label": "10 µF"},
    ],
    "wires": [
        {"id": "w1", "from": "rail-top-positive-0", "to": "t-0-1-2", "color": "#e4523d"},
        {"id": "w2", "from": "t-0-2-12", "to": "rail-top-negative-0", "color": "#232a28"},
        {"id": "w3", "from": "rail-top-positive-3", "to": "t-0-1-20", "color": "#e4523d"},
        {"id": "w4", "from": "t-0-1-25", "to": "rail-top-negative-3", "color": "#232a28"},
    ],
    "viewport": {"x": 0, "y": 0, "scale": 1},
}
def draft_for(source):
    return json.dumps({"projectId": None, "document": source})


def open_workbench(browser, source):
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    draft = draft_for(source)
    context.add_init_script(f"localStorage.setItem('cycore_breadboard_draft_v1', {json.dumps(draft)});")
    page = context.new_page()
    page.goto("http://127.0.0.1:5174/circuit/breadboard/", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    status_text = page.locator(".engine-pill span").inner_text()
    assert status_text == "实时求解", f"unexpected engine status: {status_text}"
    frame = page.frame(url=lambda url: "/circuit-engine/circuitjs.html" in url)
    assert frame is not None, "CircuitJS same-origin iframe did not load"
    page.wait_for_timeout(1200)
    return context, page

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context, page = open_workbench(browser, document)
    readings = page.locator("iframe").evaluate("""frame => {
      const elements = frame.contentWindow.CircuitJS1.getElements();
      const led = elements.find(element => element.getExternalId() === 'led1');
      const resistor = elements.find(element => element.getExternalId() === 'r1');
      const capacitor = elements.find(element => element.getExternalId() === 'c1');
      if (!led || !resistor || !capacitor) return null;
      return {
        ledType: led.getType(),
        resistorType: resistor.getType(),
        capacitorType: capacitor.getType(),
        ledCurrent: led.getCurrent(),
        resistorCurrent: resistor.getCurrent(),
        ledPower: led.getPower(),
        ledBrightness: led.getBrightness(),
        ledPinCurrents: [led.getPostCurrent(0), led.getPostCurrent(1)],
      };
    }""")
    assert readings is not None, "bound CircuitJS elements were not found"
    assert readings["ledType"] == "LEDElm" and readings["resistorType"] == "ResistorElm"
    assert readings["capacitorType"] == "PolarCapacitorElm"
    led_current = readings["ledCurrent"]
    assert 0.001 < led_current < 0.01, f"unexpected LED current: {led_current}"
    assert abs(led_current - readings["resistorCurrent"]) < 1e-9
    assert readings["ledPower"] > 0
    assert abs(sum(readings["ledPinCurrents"])) < 1e-9
    expected_brightness = max(0, min(1, 1 + 0.2 * math.log(led_current / 0.01)))
    assert abs(readings["ledBrightness"] - expected_brightness) < 1e-9
    page.screenshot(path="/tmp/breadboard-engine-ready.png", full_page=True)
    context.close()

    reversed_document = json.loads(json.dumps(document))
    reversed_document["components"][1]["pins"].reverse()
    reverse_context, reverse_page = open_workbench(browser, reversed_document)
    reverse_reading = reverse_page.locator("iframe").evaluate("""frame => {
      const led = frame.contentWindow.CircuitJS1.getElements().find(element => element.getExternalId() === 'led1');
      return led ? { current: led.getCurrent(), brightness: led.getBrightness() } : null;
    }""")
    assert reverse_reading is not None
    assert abs(reverse_reading["current"]) < 0.000001, f"reversed LED should be off: {reverse_reading['current']}"
    assert reverse_reading["brightness"] == 0
    reverse_context.close()

    display_document = {
        "schemaVersion": 1,
        "boardId": "dual-830-trimmed-v1",
        "projectName": "共阴极数码管验收",
        "components": [
            {"id": "ra", "kind": "resistor", "pins": ["t-2-0-2", "t-2-0-7"], "rotation": 0, "value": 1000},
            {"id": "rg", "kind": "resistor", "pins": ["t-2-0-12", "t-2-0-17"], "rotation": 0, "value": 1000},
            {"id": "rdp", "kind": "resistor", "pins": ["t-2-0-22", "t-2-0-27"], "rotation": 0, "value": 1000},
            {
                "id": "display", "kind": "seven-segment",
                "pins": [
                    "t-1-1-20", "t-1-1-21", "t-1-1-22", "t-1-1-23", "t-1-1-24",
                    "t-0-2-24", "t-0-2-23", "t-0-2-22", "t-0-2-21", "t-0-2-20",
                ],
                "rotation": 0, "value": 0.01, "color": "#ef3d32", "label": "SC56-11EWA",
            },
        ],
        "wires": [
            {"id": "va", "from": "rail-top-positive-0", "to": "t-2-1-2", "color": "#e4523d"},
            {"id": "a", "from": "t-2-1-7", "to": "t-0-0-23", "color": "#e4523d"},
            {"id": "vg", "from": "rail-top-positive-1", "to": "t-2-1-12", "color": "#e4523d"},
            {"id": "g", "from": "t-2-1-17", "to": "t-0-0-20", "color": "#e4523d"},
            {"id": "vdp", "from": "rail-top-positive-2", "to": "t-2-1-22", "color": "#e4523d"},
            {"id": "dp", "from": "t-2-1-27", "to": "t-1-0-24", "color": "#e4523d"},
            {"id": "common", "from": "t-1-0-22", "to": "rail-top-negative-0", "color": "#232a28"},
        ],
        "viewport": {"x": 0, "y": 0, "scale": 1},
    }
    display_context, display_page = open_workbench(browser, display_document)
    display_reading = display_page.locator("iframe").evaluate("""frame => {
      const display = frame.contentWindow.CircuitJS1.getElements().find(element => element.getExternalId() === 'display');
      if (!display) return null;
      return {
        type: display.getType(),
        currents: Array.from({ length: display.getPostCount() }, (_, index) => display.getPostCurrent(index)),
      };
    }""")
    assert display_reading is not None and display_reading["type"] == "SevenSegElm"
    segment_currents = display_reading["currents"]
    for index in [0, 6, 7]:
        assert segment_currents[index] > 0.001, display_reading
    for index in [1, 2, 3, 4, 5]:
        assert abs(segment_currents[index]) < 0.000001, display_reading
    assert segment_currents[8] < -0.003
    assert abs(sum(segment_currents)) < 1e-8
    display_page.screenshot(path="/tmp/breadboard-seven-segment.png", full_page=True)
    display_context.close()

    alternate_common_document = json.loads(json.dumps(display_document))
    alternate_common_document["wires"][-1]["from"] = "t-0-0-22"
    alternate_context, alternate_page = open_workbench(browser, alternate_common_document)
    alternate_currents = alternate_page.locator("iframe").evaluate("""frame => {
      const display = frame.contentWindow.CircuitJS1.getElements().find(element => element.getExternalId() === 'display');
      return display ? Array.from({ length: display.getPostCount() }, (_, index) => display.getPostCurrent(index)) : null;
    }""")
    assert alternate_currents is not None
    for index in [0, 6, 7]:
        assert alternate_currents[index] > 0.001, alternate_currents
    assert abs(alternate_currents[8] - segment_currents[8]) < 1e-8
    alternate_context.close()

    transistor_document = {
        "schemaVersion": 1,
        "boardId": "dual-830-trimmed-v1",
        "projectName": "NPN 端口验收",
        "components": [
            {"id": "rb", "kind": "resistor", "pins": ["t-0-0-2", "t-0-0-12"], "rotation": 0, "value": 100000},
            {"id": "rc", "kind": "resistor", "pins": ["t-0-0-3", "t-0-0-17"], "rotation": 0, "value": 1000},
            {"id": "q1", "kind": "npn", "pins": ["t-0-1-7", "t-0-1-12", "t-0-1-17"], "rotation": 0, "value": 100},
        ],
        "wires": [
            {"id": "vbase", "from": "rail-top-positive-1", "to": "t-0-1-2", "color": "#e4523d"},
            {"id": "vcollector", "from": "rail-top-positive-2", "to": "t-0-1-3", "color": "#e4523d"},
            {"id": "ground", "from": "t-0-2-7", "to": "rail-top-negative-1", "color": "#232a28"},
        ],
        "viewport": {"x": 0, "y": 0, "scale": 1},
    }
    transistor_context, transistor_page = open_workbench(browser, transistor_document)
    transistor = transistor_page.locator("iframe").evaluate("""frame => {
      const q = frame.contentWindow.CircuitJS1.getElements().find(element => element.getExternalId() === 'q1');
      if (!q) return null;
      const volts = [q.getVoltage(0), q.getVoltage(1), q.getVoltage(2)];
      const currents = [q.getPostCurrent(0), q.getPostCurrent(1), q.getPostCurrent(2)];
      return { type: q.getType(), volts, currents, power: q.getPower() };
    }""")
    assert transistor is not None and transistor["type"] == "TransistorElm"
    assert abs(sum(transistor["currents"])) < 1e-8
    assert transistor["currents"][0] > 0 and transistor["currents"][1] > 0 and transistor["currents"][2] < 0
    assert transistor["volts"][1] - transistor["volts"][2] > 0
    assert transistor["power"] > 0
    transistor_context.close()

    multi_button_document = {
        "schemaVersion": 1,
        "boardId": "dual-830-trimmed-v1",
        "projectName": "双按键隔离验收",
        "components": [
            {"id": "left-led", "kind": "led", "pins": ["t-0-4-12", "t-0-4-13"], "rotation": 0, "value": 0.01, "color": "#ef3d32"},
            {"id": "left-r", "kind": "resistor", "pins": ["t-0-3-13", "t-0-3-18"], "rotation": 0, "value": 10},
            {"id": "left-c", "kind": "capacitor", "pins": ["t-0-2-18", "t-0-2-20"], "rotation": 0, "value": 0.00001, "variant": "electrolytic"},
            {"id": "q1", "kind": "npn", "pins": ["t-0-3-29", "t-0-3-30", "t-0-3-31"], "rotation": 0, "value": 100},
            {"id": "right-led", "kind": "led", "pins": ["t-0-4-32", "t-0-4-31"], "rotation": 0, "value": 0.01, "color": "#ef3d32"},
            {"id": "right-r", "kind": "resistor", "pins": ["rail-top-positive-25", "t-0-2-32"], "rotation": 0, "value": 1000},
            {"id": "right-button", "kind": "button", "pins": ["t-0-1-34", "t-0-1-36"], "rotation": 0, "value": 1},
            {"id": "left-button", "kind": "button", "pins": ["t-0-3-20", "t-0-3-22"], "rotation": 0, "value": 1},
        ],
        "wires": [
            {"id": "left-v", "from": "rail-top-positive-9", "to": "t-0-1-12", "color": "#e4523d"},
            {"id": "left-g", "from": "t-0-0-22", "to": "rail-top-negative-17", "color": "#e4523d"},
            {"id": "q-g", "from": "t-0-0-29", "to": "rail-top-negative-23", "color": "#e4523d"},
            {"id": "q-b", "from": "t-0-0-30", "to": "t-0-0-34", "color": "#e4523d"},
            {"id": "button-v", "from": "t-0-0-36", "to": "rail-top-positive-29", "color": "#e4523d"},
        ],
        "viewport": {"x": 0, "y": 0, "scale": 1},
    }
    divergent_context, divergent_page = open_workbench(browser, multi_button_document)
    canvas = divergent_page.locator(".canvas-shell canvas").first
    box = canvas.bounding_box()
    transform = divergent_page.get_by_test_id("breadboard-canvas").get_attribute("data-board-transform")
    assert box is not None and transform is not None
    offset_x, offset_y, scale = [float(value) for value in transform.split(",")]
    right_button_x = box["x"] + offset_x + (36 + 35 * 18) * scale
    right_button_y = box["y"] + offset_y + (103 + 18) * scale
    divergent_page.mouse.move(right_button_x, right_button_y)
    divergent_page.mouse.down()
    divergent_page.wait_for_timeout(700)
    assert divergent_page.locator(".engine-pill span").inner_text() == "电路异常"
    divergent_page.mouse.up()
    divergent_context.close()

    stable_button_document = json.loads(json.dumps(multi_button_document))
    stable_button_document["components"].insert(6, {
        "id": "base-r", "kind": "resistor", "pins": ["t-0-0-30", "t-0-0-34"],
        "rotation": 0, "value": 10000,
    })
    stable_button_document["wires"] = [wire for wire in stable_button_document["wires"] if wire["id"] != "q-b"]
    buttons_context, buttons_page = open_workbench(browser, stable_button_document)
    canvas = buttons_page.locator(".canvas-shell canvas").first
    box = canvas.bounding_box()
    transform = buttons_page.get_by_test_id("breadboard-canvas").get_attribute("data-board-transform")
    assert box is not None and transform is not None
    offset_x, offset_y, scale = [float(value) for value in transform.split(",")]
    right_button_x = box["x"] + offset_x + (36 + 35 * 18) * scale
    right_button_y = box["y"] + offset_y + (103 + 18) * scale
    buttons_page.mouse.move(right_button_x, right_button_y)
    buttons_page.mouse.down()
    buttons_page.wait_for_timeout(700)
    button_readings = buttons_page.locator("iframe").evaluate("""frame => {
      const elements = frame.contentWindow.CircuitJS1.getElements();
      const read = id => {
        const element = elements.find(candidate => candidate.getExternalId() === id);
        return element ? { type: element.getType(), current: element.getCurrent(), brightness: element.getBrightness() } : null;
      };
      return {
        leftLed: read('left-led'),
        rightLed: read('right-led'),
        leftButton: read('left-button'),
        rightButton: read('right-button'),
      };
    }""")
    buttons_page.mouse.up()
    assert button_readings["leftLed"] is not None and button_readings["rightLed"] is not None
    assert button_readings["leftButton"] is not None and button_readings["rightButton"] is not None
    assert button_readings["leftLed"]["brightness"] == 0, button_readings
    assert button_readings["rightLed"]["brightness"] > 0, button_readings
    assert abs(button_readings["leftButton"]["current"]) < 1e-9, button_readings
    assert abs(button_readings["rightButton"]["current"]) > 1e-9, button_readings
    buttons_context.close()

    print(
        f"CircuitJS bindings verified; LED forward={led_current:.6f} A, "
        f"reverse={reverse_reading['current']:.3e} A, transistor terminal sum={sum(transistor['currents']):.3e} A, "
        f"seven-segment a/g/dp={segment_currents[0]:.4f}/{segment_currents[6]:.4f}/{segment_currents[7]:.4f} A, "
        f"dual-button LED brightness={button_readings['leftLed']['brightness']:.3f}/{button_readings['rightLed']['brightness']:.3f}",
        flush=True,
    )
    browser.close()
