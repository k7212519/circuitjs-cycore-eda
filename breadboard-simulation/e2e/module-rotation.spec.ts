import { expect, test } from '@playwright/test'

test('ESP32-S3 preview rotates with Space and persists the 44-pin model', async ({ page }) => {
  await page.goto('')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('part-menu-chip').click()
  await page.getByTestId('part-chip-esp32-s3').click()
  await expect(page.getByLabel('放置选项').getByText('放置时按空格旋转 180°')).toBeVisible()
  const canvas = page.locator('.canvas-shell canvas').first()
  const box = (await canvas.boundingBox())!
  const [x, y, scale] = (await page.getByTestId('breadboard-canvas').getAttribute('data-board-transform'))!.split(',').map(Number)
  const anchor = { x: box.x + x! + 216 * scale!, y: box.y + y! + 249 * scale! }
  await page.mouse.move(anchor.x, anchor.y)
  await page.keyboard.press('Space')
  await page.mouse.click(anchor.x, anchor.y)
  const inspector = page.getByLabel('属性与测量')
  await expect(inspector.locator('.pin-row')).toHaveCount(44)
  await expect(inspector.locator('.meter-grid')).toHaveCount(0)
  await expect(inspector.locator('.pin-row').first()).toContainText('A2-32')
  await inspector.getByRole('button', { name: '旋转 180°' }).click()
  await expect(inspector.locator('.pin-row').first()).toContainText('B5-11')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cycore_breadboard_workspace_v1') || '{}').document?.components[0]?.rotation === 0)
  await page.reload()
  await page.waitForLoadState('networkidle')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cycore_breadboard_workspace_v1')!).document.components[0])
  expect(saved.kind).toBe('esp32-s3')
  expect(saved.pins).toHaveLength(44)
  expect(saved.rotation).toBe(0)
})

for (const kind of ['cd4017', 'cd4026']) {
  test(`${kind} rotates its preview and placed pin map`, async ({ page }) => {
    await page.goto('')
    await page.getByTestId('part-menu-chip').click()
    await page.getByTestId(`part-chip-${kind}`).click()
    const canvas = page.locator('.canvas-shell canvas').first()
    const box = (await canvas.boundingBox())!
    const [x, y, scale] = (await page.getByTestId('breadboard-canvas').getAttribute('data-board-transform'))!.split(',').map(Number)
    const anchor = { x: box.x + x! + 216 * scale!, y: box.y + y! + 249 * scale! }
    await page.mouse.move(anchor.x, anchor.y)
    await page.keyboard.press('Space')
    await page.mouse.click(anchor.x, anchor.y)
    const inspector = page.getByLabel('属性与测量')
    await expect(inspector.locator('.pin-row')).toHaveCount(16)
    await expect(inspector.locator('.pin-row').first()).toContainText('A4-18')
    await inspector.getByRole('button', { name: '旋转 180°' }).click()
    await expect(inspector.locator('.pin-row').first()).toContainText('B2-11')
  })
}
