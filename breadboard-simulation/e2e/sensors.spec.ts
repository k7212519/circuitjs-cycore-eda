import { expect, test, type Page } from '@playwright/test'
import { PALETTE_SENSOR_KINDS, SENSOR_MODELS, sensorPinPoint, sensorWirePoints, sensorWireRoutes, wireSegments, parallelConflict, type SensorKind } from '../src/domain/sensors'
import type { BreadboardDocument, Point } from '../src/domain/types'

async function screen(page: Page, p: Point) {
  const box = (await page.locator('.canvas-shell canvas').first().boundingBox())!
  const [x, y, scale] = (await page.getByTestId('breadboard-canvas').getAttribute('data-board-transform'))!.split(',').map(Number)
  return { x: box.x + x! + p.x * scale!, y: box.y + y! + p.y * scale! }
}
async function clickWorld(page: Page, p: Point) { const s = await screen(page, p); await page.mouse.click(s.x, s.y) }
async function dragWorld(page: Page, a: Point, b: Point) {
  const from = await screen(page, a), to = await screen(page, b)
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 10 }); await page.mouse.up()
}
async function saved(page: Page): Promise<BreadboardDocument> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('cycore_breadboard_workspace_v1') ?? '{}').document)
}
async function place(page: Page, kind: SensorKind, point: Point) {
  await page.getByTestId(`part-sensor-${kind}`).click()
  await clickWorld(page, point)
  await expect(page.getByLabel('属性与测量').getByRole('heading', { name: SENSOR_MODELS[kind].name })).toBeVisible()
}
async function setup(page: Page) {
  await page.goto('')
  await expect(page.getByTestId('breadboard-canvas')).toBeVisible()
  // A wider world-space margin leaves room around every side of the breadboard.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '缩小', exact: true }).click()
  await page.getByTestId('part-menu-sensors').click()
}

test('offers all 13 external models, rejects board placement and renders a restorable gallery', async ({ page }, testInfo) => {
  await setup(page)
  await expect(page.getByRole('group', { name: '芯片传感器模型类型' }).getByRole('button')).toHaveCount(14)
  await page.getByTestId('part-sensor-dht11').click()
  await clickWorld(page, { x: 300, y: 300 })
  await expect(page.getByLabel('放置选项').getByRole('heading', { name: '温湿度传感器' })).toBeVisible()
  for (const [index, kind] of PALETTE_SENSOR_KINDS.entries()) {
    const point = index < 7 ? { x: 65 + index * 175, y: -170 } : { x: 90 + (index - 7) * 195, y: 820 }
    await place(page, kind, point)
  }
  await expect.poll(async () => (await saved(page))?.sensors?.length).toBe(13)
  await page.getByRole('button', { name: '显示全部', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('external-modules.png') })
  await page.reload()
  await expect.poll(async () => (await saved(page))?.sensors?.length).toBe(13)
  await clickWorld(page, { x: 65, y: -170 })
  await expect(page.getByLabel('属性与测量').getByText('仅模型，不参与仿真')).toBeVisible()
})

test('connects board and module pins, edits routes, moves, reconnects and undoes deletion', async ({ page }, testInfo) => {
  await setup(page)
  await place(page, 'dht11', { x: 250, y: -150 })
  await place(page, 'relay', { x: 700, y: -150 })
  await expect.poll(async () => (await saved(page))?.sensors?.length).toBe(2)
  let doc = await saved(page)
  const a = doc.sensors![0]!, b = doc.sensors![1]!
  await page.getByTestId('part-wire').click()
  await dragWorld(page, sensorPinPoint(a, 0), { x: 396, y: 103 })
  await expect.poll(async () => (await saved(page))?.sensorWires?.length).toBe(1)
  await clickWorld(page, sensorPinPoint(a, 1))
  await clickWorld(page, sensorPinPoint(b, 2))
  await expect.poll(async () => (await saved(page))?.sensorWires?.length).toBe(2)
  await page.getByRole('button', { name: '选择模式', exact: true }).click()
  doc = await saved(page)
  const wire = doc.sensorWires![0]!, points = sensorWirePoints(doc, wire)
  // Select a visible segment, then drag its center handle perpendicular to it.
  const start = points[1]!, end = points[2]!, center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  await clickWorld(page, center)
  await expect(page.getByLabel('属性与测量').getByRole('heading', { name: '模块导线' })).toBeVisible()
  await dragWorld(page, center, { x: center.x, y: center.y + 24 })
  await expect.poll(async () => (await saved(page))?.sensorWires?.[0]?.waypoints?.length ?? 0).toBeGreaterThan(0)
  await dragWorld(page, { x: 396, y: 103 }, { x: 450, y: 103 })
  await expect.poll(async () => (await saved(page))?.sensorWires?.[0]?.to).toEqual({ type: 'hole', holeId: 't-0-0-23' })
  await clickWorld(page, a.position)
  await dragWorld(page, a.position, { x: 290, y: -160 })
  await expect.poll(async () => Math.abs(((await saved(page))?.sensors?.[0]?.position.x ?? 0) - 290)).toBeLessThan(3)
  await page.screenshot({ path: testInfo.outputPath('external-wiring.png') })
  await page.getByRole('button', { name: '删除模块及接线' }).click()
  await expect.poll(async () => (await saved(page))?.sensorWires?.length).toBe(0)
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect.poll(async () => (await saved(page))?.sensorWires?.length).toBe(2)
  await page.reload()
  await expect.poll(async () => (await saved(page))?.sensorWires?.length).toBe(2)
})

test('drag-drops a sensor from the palette and rotates it without touching the board', async ({ page }) => {
  await setup(page)
  const part = page.getByTestId('part-sensor-sg90'), target = await screen(page, { x: 600, y: -160 })
  // HTML5 drag payload follows the same palette-to-canvas path as native desktop dragging.
  const transfer = await page.evaluateHandle(() => new DataTransfer())
  await part.dispatchEvent('dragstart', { dataTransfer: transfer })
  await page.getByTestId('breadboard-canvas').dispatchEvent('drop', { dataTransfer: transfer, clientX: target.x, clientY: target.y })
  await expect(page.getByLabel('属性与测量').getByRole('heading', { name: 'SG90 舵机' })).toBeVisible()
  await page.getByRole('button', { name: '旋转 90° · 0°' }).click()
  await expect.poll(async () => (await saved(page))?.sensors?.[0]?.rotation).toBe(90)
  await expect(page.getByRole('button', { name: '旋转 90° · 90°' })).toBeVisible()
})

test('fans out three parallel wires and keeps adjusted paths separated', async ({ page }, testInfo) => {
  await setup(page)
  await place(page, 'dht11', { x: 220, y: -150 })
  await expect.poll(async () => (await saved(page))?.sensors?.length).toBe(1)
  const sensor = (await saved(page)).sensors![0]!
  await page.getByTestId('part-wire').click()
  for (let pin = 0; pin < 3; pin++) {
    await dragWorld(page, sensorPinPoint(sensor, pin), { x: 396 + pin * 18, y: 103 })
    await expect.poll(async () => (await saved(page))?.sensorWires?.length).toBe(pin + 1)
  }
  const assertSeparated = (doc: BreadboardDocument) => {
    const values = [...sensorWireRoutes(doc).values()]
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
      for (const a of wireSegments(values[i]!)) for (const b of wireSegments(values[j]!)) expect(parallelConflict(a, b)).toBe(false)
    }
  }
  let doc = await saved(page)
  assertSeparated(doc)
  await page.getByRole('button', { name: '选择模式', exact: true }).click()
  const points = sensorWirePoints(doc, doc.sensorWires![0]!)
  const horizontal = wireSegments(points).find(s => s.from.y === s.to.y && Math.abs(s.to.x - s.from.x) > 40)!
  const center = { x: (horizontal.from.x + horizontal.to.x) / 2, y: horizontal.from.y }
  await clickWorld(page, center)
  await expect(page.getByLabel('属性与测量').getByRole('heading', { name: '模块导线' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('parallel-wire-handles.png') })
  await dragWorld(page, center, { x: center.x, y: center.y + 30 })
  await expect.poll(async () => (await saved(page))?.sensorWires?.[0]?.waypoints?.length ?? 0).toBeGreaterThan(0)
  doc = await saved(page)
  assertSeparated(doc)
  await page.screenshot({ path: testInfo.outputPath('parallel-wire-adjusted.png') })
  await page.reload()
  assertSeparated(await saved(page))
})
