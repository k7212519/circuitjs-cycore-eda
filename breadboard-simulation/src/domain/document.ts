import { SENSOR_KINDS, endpointPoint, endpointKey, sensorOutsideBoard } from './sensors'
import { z } from 'zod'
import { halfTurnPins, defaultPinCount, holeById, isLegacyCd4017Footprint, rigidModulePlacementFromLowerPin } from './board'
import { occupiedHoles } from './validation'
import type { SensorWire } from './sensors'
import type { BreadboardDocument } from './types'

const componentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['resistor', 'capacitor', 'led', 'diode', 'switch', 'button', 'npn', 'pnp', 'seven-segment', 'cd4017', 'cd4026', 'esp32-s3']),
  pins: z.array(z.string()).min(2).max(44),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  value: z.number().positive(),
  color: z.string().optional(),
  label: z.string().optional(),
  bandCount: z.union([z.literal(4), z.literal(5)]).optional(),
  variant: z.enum(['ceramic', 'electrolytic', 'small-signal', 'rectifier', 'schottky', 'common-cathode', 'common-anode']).optional(),
}).superRefine((component, context) => {
  const expected = defaultPinCount(component.kind)
  if (component.pins.length !== expected) {
    context.addIssue({
      code: 'custom',
      path: ['pins'],
      message: `${component.kind} requires exactly ${expected} pins`,
    })
  }
})

const wireSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  color: z.string().min(1),
})

const endpointSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hole'), holeId: z.string().min(1) }),
  z.object({ type: z.literal('sensor'), sensorId: z.string().min(1), pin: z.number().int().nonnegative() }),
])
const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() })
const sensorWireSchema = z.union([
  z.object({ id: z.string().min(1), from: endpointSchema, to: endpointSchema, color: z.string().min(1), waypoints: z.array(pointSchema).optional() }),
  z.object({
    id: z.string().min(1), source: z.object({ sensorId: z.string().min(1), pin: z.number().int().nonnegative() }),
    holeId: z.string().min(1), color: z.string().min(1), lane: z.number().finite().optional(),
  }),
])

export const breadboardDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  boardId: z.literal('dual-830-trimmed-v1'),
  projectName: z.string().min(1).max(100),
  components: z.array(componentSchema),
  wires: z.array(wireSchema),
  sensors: z.array(z.object({
    id: z.string().min(1), kind: z.enum(SENSOR_KINDS),
    position: z.object({ x: z.number().finite(), y: z.number().finite() }),
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  })).optional(),
  sensorWires: z.array(sensorWireSchema).optional(),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    scale: z.number().min(0.2).max(4),
  }),
})

export function createEmptyDocument(projectName = '未命名实验'): BreadboardDocument {
  return {
    schemaVersion: 1,
    boardId: 'dual-830-trimmed-v1',
    projectName,
    components: [],
    wires: [],
    viewport: { x: 0, y: 0, scale: 1 },
  }
}

export function parseDocument(value: unknown): BreadboardDocument {
  const parsed = breadboardDocumentSchema.parse(value)
  const document: BreadboardDocument = { ...parsed, sensorWires: parsed.sensorWires?.map(wire => {
    if ('from' in wire) return wire
    const converted: SensorWire = { id: wire.id, from: { type: 'sensor', ...wire.source }, to: { type: 'hole', holeId: wire.holeId }, color: wire.color }
    const sensor = parsed.sensors?.find(s => s.id === wire.source.sensorId)
    const hole = holeById.get(wire.holeId)
    if (wire.lane !== undefined && sensor && hole) converted.waypoints = [sensor.rotation % 180 === 0 ? { x: wire.lane, y: hole.y } : { x: hole.x, y: wire.lane }]
    return converted
  }) }
  const ids = [...document.components, ...document.wires, ...(document.sensors ?? []), ...(document.sensorWires ?? [])].map(item => item.id)
  if (new Set(ids).size !== ids.length) throw new Error('项目包含重复对象 ID')
  for (const sensor of document.sensors ?? []) if (!sensorOutsideBoard(sensor)) throw new Error('外置模块必须位于面包板外')
  const occupied = occupiedHoles({ ...document, sensorWires: [] })
  for (const wire of document.sensorWires ?? []) {
    if (wire.from.type === 'hole' && wire.to.type === 'hole') throw new Error('外置导线必须连接模块引脚')
    for (const endpoint of [wire.from, wire.to]) {
      if (!endpointPoint(document, endpoint)) throw new Error('传感器导线包含无效端点')
      const key = endpointKey(endpoint)
      if (occupied.has(key)) throw new Error('传感器导线端点已占用')
      occupied.add(key)
    }
  }
  compactCd4017Footprints(document)
  expandEsp32S3Footprints(document)
  return document
}

// Only change owned document copies, and only move pins within their existing
// intrinsic nodes. Occupied target holes leave the legacy footprint intact.
export function compactCd4017Footprints(document: BreadboardDocument): void {
  for (const component of document.components) {
    if (component.kind !== 'cd4017' || !isLegacyCd4017Footprint(component.pins)) continue
    const canonical = component.rotation === 180 ? halfTurnPins(component.pins) : component.pins
    const anchor = holeById.get(canonical[0]!)!
    const occupied = occupiedHoles(document, component.id)
    const lowerAnchorAbove = holeById.get(`t-${anchor.zone}-${(anchor.row ?? 0) - 1}-${anchor.column}`)
    for (const candidate of [anchor, lowerAnchorAbove]) {
      if (!candidate) continue
      const pins = rigidModulePlacementFromLowerPin('cd4017', candidate, occupied)
      if (!pins || pins.some((pin, index) => holeById.get(pin)?.nodeId !== holeById.get(canonical[index]!)?.nodeId)) continue
      component.pins = component.rotation === 180 ? halfTurnPins(pins) : pins
      break
    }
  }
}

export function serializeDocument(document: BreadboardDocument): string {
  return JSON.stringify(parseDocument(document))
}

export function expandEsp32S3Footprints(document: BreadboardDocument): void {
  for (const component of document.components) {
    if (component.kind !== 'esp32-s3') continue
    const canonical = component.rotation === 180 ? halfTurnPins(component.pins) : component.pins
    const first = holeById.get(canonical[0] ?? '')
    const upper = holeById.get(canonical[43] ?? '')
    if (first && upper && Math.abs(first.y - upper.y - 182) <= 2) continue
    if (!first || !upper || first.zone !== (upper.zone ?? -2) + 1) continue
    const lower = holeById.get(`t-${first.zone}-4-${first.column}`)
    const pins = lower ? rigidModulePlacementFromLowerPin('esp32-s3', lower, occupiedHoles(document, component.id)) : null
    if (pins && pins.every((pin, index) => holeById.get(pin)?.nodeId === holeById.get(canonical[index]!)?.nodeId)) {
      component.pins = component.rotation === 180 ? halfTurnPins(pins) : pins
    }
  }
}
