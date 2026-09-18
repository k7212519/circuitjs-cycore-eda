"""Run against the complete makeSite output served at http://127.0.0.1:8766."""
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8766'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    api_requests = []
    page.on('request', lambda request: api_requests.append(request.url)
            if 'api-eda.cycore.com.cn' in request.url or '/eda/login/validate' in request.url else None)
    page.goto(BASE + '/circuit/manifest.json')
    page.evaluate('''async () => {
      const cache = await caches.open('circuitjs1-app-cache-v1');
      await cache.put('/circuit/breadboard/', new Response('obsolete login redirect'));
    }''')
    page.goto(BASE + '/circuit/breadboard/')
    page.wait_for_load_state('networkidle')
    print('Toolbar:', page.locator('.tool-actions button').all_text_contents())
    expect(page.locator('.engine-pill')).to_contain_text('实时求解', timeout=30000)
    assert api_requests == [], api_requests
    page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=60000)
    cache_names = page.evaluate('caches.keys()')
    assert any(name.startswith('circuitjs1-app-cache-') for name in cache_names)
    assert 'circuitjs1-app-cache-v1' not in cache_names
    print('PASS: guest entry and embedded engine make no authentication requests; offline cache installed')

    # Simulate expired credentials. Entry must still be completely local.
    page.evaluate("localStorage.setItem('eda_token', 'expired-test-token')")
    page.reload()
    page.wait_for_load_state('networkidle')
    expect(page.locator('.engine-pill')).to_contain_text('实时求解', timeout=30000)
    assert api_requests == [], api_requests

    context.set_offline(True)
    page.reload()
    expect(page.locator('.engine-pill')).to_contain_text('实时求解', timeout=30000)
    page.get_by_role('button', name='暂停仿真', exact=True).click()
    expect(page.locator('.engine-pill')).to_contain_text('已暂停')
    page.get_by_role('button', name='运行仿真', exact=True).click()
    expect(page.locator('.engine-pill')).to_contain_text('实时求解', timeout=10000)
    assert '/breadboard/' in page.url
    print('PASS: expired credentials do not block entry; offline reload and solver run succeed')

    context.set_offline(False)
    context.route('https://api-eda.cycore.com.cn/**', lambda route: route.fulfill(
        status=401, content_type='application/json', body='{"code":401}'))
    page.get_by_title('打开云端项目', exact=True).click()
    page.wait_for_url(BASE + '/circuit/login.html')
    assert page.evaluate("sessionStorage.getItem('redirect_after_login')") == BASE + '/circuit/breadboard/'
    assert page.evaluate("localStorage.getItem('eda_token')") is None
    assert page.evaluate("localStorage.getItem('cycore_breadboard_workspace_v1')") is not None
    assert len(api_requests) == 1, api_requests
    print('PASS: cloud action rejects expired login once, redirects to circuit login, preserves workspace and return URL')

    page.goto(BASE + '/circuit/breadboard/')
    page.wait_for_load_state('networkidle')
    page.get_by_title('保存到云端', exact=True).click()
    page.wait_for_url(BASE + '/circuit/login.html')
    assert len(api_requests) == 1, api_requests
    cached_urls = page.evaluate('''async () => {
      const results = [];
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys()) results.push(request.url);
      }
      return results;
    }''')
    assert not any('api-eda.cycore.com.cn' in url or url.endswith('/login.html') for url in cached_urls)
    print('PASS: guest save redirects correctly; no account responses in offline caches')
    browser.close()
