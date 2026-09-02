import { expect, test } from '@playwright/test'

test('renders the 5V breadboard laboratory and drag-places a resistor', async ({ page }) => {
  await page.goto('')
  await page.waitForLoadState('networkidle')
  await expect(page.getByAltText('CyCore logo')).toBeVisible()
  await expect(page.getByLabel('元器件库')).toBeVisible()
  await expect(page.getByText('TIP / 01')).toHaveCount(0)
  await expect(page.getByText('属性与测量')).toBeVisible()
  await expect(page.getByText('BOARD POWER')).toHaveCount(0)
  await expect(page.getByText('BOARD / DUAL-830 MOD')).toHaveCount(0)
  await expect(page.getByText('WHEEL ZOOM · MMB PAN')).toHaveCount(0)
  await expect(page.getByText('访客模式')).toBeVisible()
  await expect(page.getByTitle('访客模式不能保存云项目')).toBeDisabled()

  await page.getByTestId('part-resistor').click()
  const placementPanel = page.getByLabel('放置选项')
  await expect(placementPanel.getByRole('heading', { name: '放置选项' })).toBeVisible()
  await placementPanel.getByLabel('阻值 (Ω)').fill('2200')
  await placementPanel.getByRole('button', { name: '5 环' }).click()
  const canvas = page.locator('.canvas-shell canvas').first()
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  const transform = (await page.getByTestId('breadboard-canvas').getAttribute('data-board-transform'))!
  const [offsetX, offsetY, scale] = transform.split(',').map(Number)
  const toScreen = (x: number, y: number) => ({ x: box.x + offsetX! + x * scale!, y: box.y + offsetY! + y * scale! })
  const start = toScreen(216, 103)
  const end = toScreen(396, 103)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByLabel('属性与测量').getByText('2.2 kΩ')).toBeVisible()
  await expect(page.getByText('旋转 90°')).toBeVisible()
})

test('offers retaining switch and momentary button options under the switch menu', async ({ page }) => {
  await page.goto('')
  const palette = page.getByLabel('元器件库')
  await palette.getByTestId('part-menu-switch').click()
  await expect(palette.getByTestId('part-switch-toggle')).toContainText('开关')
  const button = palette.getByTestId('part-switch-button')
  await expect(button).toContainText('按键')
  await button.click()
  await expect(page.getByLabel('放置选项').getByText('瞬时按键', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('选择 按键 起点孔')).toBeVisible()
})

test('keeps the button knob independent and marquee-selects movable objects', async ({ page }) => {
  await page.goto('')
  await page.waitForLoadState('networkidle')
  const board = page.getByTestId('breadboard-canvas')
  const canvas = page.locator('.canvas-shell canvas').first()
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  const toScreen = async (x: number, y: number) => {
    const transform = (await board.getAttribute('data-board-transform'))!
    const [offsetX, offsetY, scale] = transform.split(',').map(Number)
    return { x: box.x + offsetX! + x * scale!, y: box.y + offsetY! + y * scale! }
  }
  const dragWorld = async (from: [number, number], to: [number, number]) => {
    const start = await toScreen(...from)
    const end = await toScreen(...to)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 8 })
    await page.mouse.up()
  }

  const palette = page.getByLabel('元器件库')
  await palette.getByTestId('part-menu-switch').click()
  await palette.getByTestId('part-switch-button').click()
  await dragWorld([216, 103], [252, 103])
  await palette.getByTestId('part-resistor').click()
  await dragWorld([360, 139], [450, 139])

  const inspector = page.getByLabel('属性与测量')
  await expect(inspector.getByText('电阻', { exact: true })).toBeVisible()
  const knob = await toScreen(234, 103)
  await page.mouse.move(knob.x, knob.y)
  await page.mouse.down()
  await expect(inspector.getByText('电阻', { exact: true })).toBeVisible()
  await page.mouse.up()

  const buttonBase = await toScreen(246, 115)
  await page.mouse.click(buttonBase.x, buttonBase.y)
  await expect(inspector.getByText('按键', { exact: true })).toBeVisible()

  await palette.getByTestId('part-wire').click()
  await dragWorld([216, 175], [306, 175])
  await dragWorld([390, 120], [430, 150])
  await expect(board).toHaveAttribute('data-selected-count', '0')
  await dragWorld([195, 80], [470, 190])
  await expect(board).toHaveAttribute('data-selected-count', '3')
  await expect(inspector.getByRole('heading', { name: '已选择 3 个对象' })).toBeVisible()

  const resistorBody = await toScreen(405, 139)
  await page.keyboard.down('Shift')
  await page.mouse.click(resistorBody.x, resistorBody.y)
  await page.keyboard.up('Shift')
  await expect(board).toHaveAttribute('data-selected-count', '2')
  await page.keyboard.down('Shift')
  await page.mouse.click(resistorBody.x, resistorBody.y)
  await page.keyboard.up('Shift')
  await expect(board).toHaveAttribute('data-selected-count', '3')

  await page.mouse.move(buttonBase.x, buttonBase.y)
  await page.mouse.down()
  await page.mouse.move(buttonBase.x + 36, buttonBase.y, { steps: 8 })
  await page.mouse.up()
  await expect(board).toHaveAttribute('data-selected-count', '3')
  await page.keyboard.press('Delete')
  await expect(board).toHaveAttribute('data-selected-count', '0')
})

test('chooses component subtypes from the left menu without duplicate right-side selectors', async ({ page }) => {
  await page.goto('')
  await page.waitForLoadState('networkidle')

  const palette = page.getByLabel('元器件库')
  await palette.getByTestId('part-menu-capacitor').click()
  await expect(palette.getByTestId('part-capacitor-ceramic')).toBeVisible()
  await palette.getByTestId('part-capacitor-electrolytic').click()

  const placementPanel = page.getByLabel('放置选项')
  await expect(placementPanel.getByText('电解电容', { exact: true }).first()).toBeVisible()
  await expect(placementPanel.getByLabel('容量 (F)')).toBeVisible()
  await expect(placementPanel.locator('select')).toHaveCount(0)

  await palette.getByTestId('part-menu-led').click()
  await palette.getByTestId('part-led-green').click()
  await expect(placementPanel.getByText('绿色 LED', { exact: true }).first()).toBeVisible()
  await expect(placementPanel.getByLabel('自定义 LED 颜色')).toHaveCount(0)

  await palette.getByTestId('part-menu-diode').click()
  await palette.getByTestId('part-diode-1n5819').click()
  await expect(placementPanel.getByText('1N5819 二极管', { exact: true }).first()).toBeVisible()
  await expect(placementPanel.getByLabel('二极管型号')).toHaveCount(0)
})

test('uses wheel zoom and middle-button pan without left-button panning', async ({ page }) => {
  await page.goto('')
  await page.waitForLoadState('networkidle')
  const board = page.getByTestId('breadboard-canvas')
  await expect(board).toHaveAttribute('data-board-interaction', 'wheel-zoom,middle-pan')
  await expect(page.getByTitle('放大')).toHaveCount(0)
  await expect(page.getByTitle('缩小')).toHaveCount(0)

  const canvas = page.locator('.canvas-shell canvas').first()
  const before = await board.getAttribute('data-board-transform')
  const box = await canvas.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.82)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.72)
    await page.mouse.up()
  }
  await expect(board).toHaveAttribute('data-board-transform', before ?? '')

  if (box) {
    await page.mouse.wheel(0, -600)
  }
  await expect.poll(() => board.getAttribute('data-board-transform')).not.toBe(before)
  const afterZoom = await board.getAttribute('data-board-transform')

  if (box) {
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.62)
    await page.mouse.up({ button: 'middle' })
  }
  await expect.poll(() => board.getAttribute('data-board-transform')).not.toBe(afterZoom)

  await page.getByTestId('part-wire').click()
  await expect(page.getByText('选择导线起点')).toBeVisible()
})

test('toggles and persists the color theme while reserving solver status width', async ({ page }) => {
  await page.goto('')
  await page.evaluate(() => localStorage.removeItem('darkMode'))
  await page.reload()
  await page.waitForLoadState('networkidle')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: '切换到浅色模式' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('button', { name: '切换到深色模式' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('darkMode'))).toBe('false')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect.poll(() => page.locator('.engine-pill').evaluate((node) => getComputedStyle(node).width)).toBe('96px')
})
