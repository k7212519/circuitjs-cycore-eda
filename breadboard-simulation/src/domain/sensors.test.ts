import { describe, expect, it } from 'vitest'
import { createEmptyDocument, parseDocument, serializeDocument } from './document'
import { BOARD_HEIGHT, BOARD_WIDTH, holeById } from './board'
import { buildCircuitJsNetlist } from './netlist'
import { PALETTE_SENSOR_KINDS, SENSOR_MODELS, cleanOrthogonalPoints, endpointPoint, roundedOrthogonalPath, sensorBounds, sensorOutsideBoard, sensorPinLocal, sensorPinPoint, sensorWirePoints, sensorWireRoutes, wireSegments, parallelConflict, wireSegmentHandles, moveWireSegment, sensorPcbTop, type ExternalSensor, type SensorWire } from './sensors'
import type { Point } from './types'

const orthogonal = (points: Point[]) => {
  expect(points.length).toBeGreaterThan(1)
  for (let i = 1; i < points.length; i++) expect(points[i]!.x === points[i - 1]!.x || points[i]!.y === points[i - 1]!.y).toBe(true)
  expect(roundedOrthogonalPath(points)).not.toMatch(/NaN|Infinity/)
}
const sensor: ExternalSensor = { id: 's1', kind: 'dht11', position: { x: 220, y: -180 }, rotation: 0 }
const wire: SensorWire = { id: 'w1', from: { type: 'sensor', sensorId: 's1', pin: 1 }, to: { type: 'hole', holeId: 't-0-0-6' }, color: '#f28c28' }

describe('external module geometry and persistence', () => {
  it('defines all 13 models and both relay terminal banks from one catalog', () => {
    expect(PALETTE_SENSOR_KINDS).toHaveLength(13)
    expect(new Set(PALETTE_SENSOR_KINDS).size).toBe(13)
    expect(SENSOR_MODELS.relay.pins).toEqual(['VCC', 'GND', 'IN', 'NC', 'COM', 'NO'])
    expect(sensorPinLocal({ kind: 'relay' }, 0).direction.y).toBe(1)
    expect(sensorPinLocal({ kind: 'relay' }, 3).direction.y).toBe(-1)
  })
  for (const rotation of [0, 90, 180, 270] as const) it(`routes board and module connections at ${rotation} degrees on all board sides`, () => {
    for (const position of [{ x: 300, y: -180 }, { x: 300, y: BOARD_HEIGHT + 180 }, { x: -200, y: 300 }, { x: BOARD_WIDTH + 200, y: 300 }]) {
      const a = { ...sensor, rotation, position }
      expect(sensorOutsideBoard(a)).toBe(true)
      const b: ExternalSensor = { id: 's2', kind: 'relay', position: { x: -220, y: -200 }, rotation: ((rotation + 90) % 360) as ExternalSensor['rotation'] }
      const doc = { ...createEmptyDocument(), sensors: [a, b] }
      for (const to of [wire.to, { type: 'sensor' as const, sensorId: b.id, pin: 4 }]) {
        const w = { ...wire, to }, points = sensorWirePoints(doc, w)
        orthogonal(points)
        expect(points[0]).toEqual(sensorPinPoint(a, 1))
        expect(points.at(-1)).toMatchObject({ x: endpointPoint(doc, to)!.x, y: endpointPoint(doc, to)!.y })
        // Sample straight segments to ensure routes never pass through endpoint bodies.
        for (const module of to.type === 'sensor' ? [a, b] : [a]) {
          const bounds = sensorBounds(module, false)
          for (let i = 1; i < points.length; i++) for (let step = 1; step < 10; step++) {
            const p = points[i - 1]!, q = points[i]!, x = p.x + (q.x - p.x) * step / 10, y = p.y + (q.y - p.y) * step / 10
            expect(x > bounds.x && x < bounds.x + bounds.width && y > bounds.y && y < bounds.y + bounds.height).toBe(false)
          }
        }
      }
      orthogonal(sensorWirePoints(doc, wire, { end: 'to', point: { x: 711.3, y: 38.7 } }))
    }
  })
  it('includes all terminal extents in the eight-pixel board clearance', () => {
    expect(sensorOutsideBoard({ ...sensor, position: { x: 300, y: -76 } })).toBe(true)
    expect(sensorOutsideBoard({ ...sensor, position: { x: 300, y: -75.99 } })).toBe(false)
    expect(sensorOutsideBoard({ ...sensor, position: { x: 300, y: 300 } })).toBe(false)
  })
  it('keeps manual bends on movement and cleans repeated/collinear points', () => {
    const doc = { ...createEmptyDocument(), sensors: [sensor], sensorWires: [{ ...wire, waypoints: [{ x: 500, y: -70 }, { x: 500, y: 50 }] }] }
    const points = sensorWirePoints(doc, doc.sensorWires[0]!)
    orthogonal(points)
    expect(points.some(p => p.x === 500)).toBe(true)
    doc.sensors[0] = { ...sensor, position: { x: 280, y: -230 } }
    const moved = sensorWirePoints(doc, doc.sensorWires[0]!)
    orthogonal(moved)
    expect(moved.some(p => p.x === 500)).toBe(true)
    expect(cleanOrthogonalPoints([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 }, { x: 20, y: 20 }])).toEqual([{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 20, y: 20 }])
    expect(roundedOrthogonalPath([{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }])).toContain('Q 0 2 1 2')
  })
  it('round trips modern documents and migrates the legacy lane format', () => {
    const document = { ...createEmptyDocument(), sensors: [sensor], sensorWires: [{ ...wire, waypoints: [{ x: 500, y: 20 }] }] }
    expect(parseDocument(JSON.parse(serializeDocument(document)))).toEqual(document)
    const migrated = parseDocument({ ...document, sensorWires: [{ id: 'old', source: { sensorId: sensor.id, pin: 1 }, holeId: 't-0-0-6', color: '#ffffff', lane: 600 }] })
    expect(migrated.sensorWires![0]).toMatchObject({ from: wire.from, to: wire.to, waypoints: [{ x: 600, y: holeById.get('t-0-0-6')!.y }] })
    expect(parseDocument(createEmptyDocument()).components).toEqual([])
  })
  it('rejects dangling, repeated or occupied endpoints and leaves simulation unchanged', () => {
    const document = { ...createEmptyDocument(), sensors: [sensor], sensorWires: [wire] }
    expect(() => parseDocument({ ...document, sensors: [] })).toThrow('无效端点')
    expect(() => parseDocument({ ...document, sensorWires: [wire, { ...wire, id: 'w2' }] })).toThrow('占用')
    expect(() => parseDocument({ ...document, sensors: [sensor, sensor] })).toThrow('重复')
    expect(() => parseDocument({ ...document, sensorWires: [{ ...wire, from: { type: 'sensor', sensorId: sensor.id, pin: 99 } }] })).toThrow('无效端点')
    const before = buildCircuitJsNetlist(createEmptyDocument())
    expect(buildCircuitJsNetlist(document)).toEqual(before)
    expect(buildCircuitJsNetlist({ ...document, sensors: [{ ...sensor, rotation: 90 }], sensorWires: [{ ...wire, waypoints: [{ x: 400, y: -100 }] }] })).toEqual(before)
  })
})

describe('parallel lanes and one handle per segment', () => {
  it('separates three adjacent pin wires in both horizontal and vertical orientations', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const module = { ...sensor, rotation, position: { x: -180, y: -180 } }
      const doc = { ...createEmptyDocument(), sensors: [module], sensorWires: [0, 1, 2].map(pin => ({ ...wire, id: `wire-${pin}`, from: { type: 'sensor' as const, sensorId: module.id, pin }, to: { type: 'hole' as const, holeId: `t-0-0-${20 + pin}` } })) }
      const routes = sensorWireRoutes(doc)
      for (const points of routes.values()) orthogonal(points)
      const values = [...routes.values()]
      for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
        for (const a of wireSegments(values[i]!)) for (const b of wireSegments(values[j]!)) expect(parallelConflict(a, b), JSON.stringify({rotation,a,b})).toBe(false)
      }
      expect(sensorWireRoutes(doc)).toEqual(routes)
    }
  })
  it('assigns exactly one midpoint per straight segment, including long end segments', () => {
    const points = [{ x: 0, y: 0 }, { x: 0, y: 200 }, { x: 200, y: 200 }, { x: 200, y: 400 }]
    expect(wireSegmentHandles(points).map(h => h.center)).toEqual([{ x: 0, y: 100 }, { x: 100, y: 200 }, { x: 200, y: 300 }])
    for (let index = 0; index < 3; index++) {
      const moved = [points[0]!, ...moveWireSegment(points, index, { x: 50, y: 250 }), points.at(-1)!]
      orthogonal(moved)
      expect(moved[0]).toEqual(points[0])
      expect(moved.at(-1)).toEqual(points.at(-1))
    }
  })
  it('keeps the microphone on the PCB while exposing the IR heads above a narrow board', () => {
    expect(SENSOR_MODELS.sound.width).toBeLessThan(75)
    expect(sensorPcbTop('sound')).toBe(-SENSOR_MODELS.sound.height / 2)
    expect(SENSOR_MODELS.obstacle.width).toBe(62)
    expect(sensorPcbTop('obstacle')).toBeGreaterThan(-SENSOR_MODELS.obstacle.height / 2 + 31)
    for (const kind of ['light', 'thermistor', 'vibration'] as const) {
      expect(SENSOR_MODELS[kind].width).toBeLessThan(75)
      expect(sensorPcbTop(kind)).toBeGreaterThan(-SENSOR_MODELS[kind].height / 2)
    }
  })
})
