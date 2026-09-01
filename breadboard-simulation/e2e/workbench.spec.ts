import { expect, test } from '@playwright/test'

test('renders the 5V breadboard laboratory and drag-places a resistor', async ({ page }) => {
  await page.goto('')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('元器件库')).toBeVisible()
  await expect(page.getByText('属性与测量')).toBeVisible()
  await expect(page.getByText('BOARD POWER')).toBeVisible()
  await expect(page.getByText('访客模式')).toBeVisible()
  await expect(page.getByTitle('访客模式不能保存云项目')).toBeDisabled()

  await page.getByTestId('part-resistor').click()
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
  await expect(page.getByLabel('属性与测量').getByText('1 kΩ')).toBeVisible()
  await expect(page.getByText('旋转 90°')).toBeVisible()
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
