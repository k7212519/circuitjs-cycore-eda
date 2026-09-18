"""Regression checks against makeSite output at http://127.0.0.1:8766."""
import json
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8766'
ACTIVE = {'code': 200, 'data': {'userId': 1, 'username': 'test', 'productAccess': {'status': 'ACTIVE'}}}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for scenario in ['active', 'self-return', 'missing-return', 'http401', 'business401', 'network-error', 'missing-token']:
        context = browser.new_context(service_workers='block')
        page = context.new_page()
        calls = []
        navigations = []
        page.on('framenavigated', lambda frame: navigations.append(frame.url) if frame == page.main_frame else None)

        def validation(route):
            calls.append(route.request.url)
            status, body = 200, ACTIVE
            if scenario == 'http401':
                status, body = 401, {'code': 401}
            elif scenario == 'business401':
                body = {'code': 401}
            elif scenario == 'network-error' or len(calls) > 1:
                # Before the fix, the second validation on circuitjs failed,
                # returned to login, and a later success could restart the loop.
                status, body = 500, {'code': 500}
            route.fulfill(status=status, content_type='application/json', body=json.dumps(body))

        context.route('**/eda/login/validate', validation)
        page.goto(BASE + '/circuit/manifest.json')
        if scenario != 'missing-token':
            page.evaluate("localStorage.setItem('eda_token', 'test-token')")
        else:
            page.evaluate("sessionStorage.setItem('authenticated', 'true')")
        if scenario in ['self-return', 'missing-return']:
            page.evaluate('(url) => sessionStorage.setItem("redirect_after_login", url)',
                          BASE + ('/circuit/login.html' if scenario == 'self-return' else '/circuit/breadboard/login.html'))
        page.goto(BASE + ('/circuit/circuitjs.html' if scenario == 'missing-token' else '/circuit/login.html'))
        expected = '/circuit/circuitjs.html' if scenario in ['active', 'self-return', 'missing-return'] else '/circuit/login.html'
        page.wait_for_url(BASE + expected)
        page.wait_for_load_state('networkidle')
        assert page.url == BASE + expected
        assert len(calls) == (0 if scenario == 'missing-token' else 1), (scenario, calls)
        assert len(navigations) <= 3, (scenario, navigations)
        if scenario in ['http401', 'business401']:
            assert page.evaluate("localStorage.getItem('eda_token')") is None
            expect(page.locator('#login-error')).to_be_visible()
        if scenario == 'network-error':
            assert page.evaluate("localStorage.getItem('eda_token')") == 'test-token'
            expect(page.locator('#login-error')).to_contain_text('暂时无法验证登录')
        print('PASS:', scenario, 'validations:', len(calls))
        context.close()
    browser.close()
