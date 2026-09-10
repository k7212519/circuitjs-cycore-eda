import { BOARD_HEIGHT, BOARD_WIDTH, boardPointLabel, holeById } from './board'
import type { BreadboardDocument, Point } from './types'

export const SENSOR_KINDS = ['dht11', 'hc-sr04', 'hc-sr501', 'light', 'sound', 'soil', 'flame', 'mq2', 'obstacle', 'hall', 'thermistor', 'vibration', 'motor', 'sg90', 'traffic-light', 'relay', 'potentiometer'] as const
export type SensorKind = typeof SENSOR_KINDS[number]
export const PALETTE_SENSOR_KINDS: SensorKind[] = ['dht11', 'hc-sr04', 'obstacle', 'light', 'sound', 'thermistor', 'mq2', 'motor', 'sg90', 'traffic-light', 'relay', 'vibration', 'potentiometer']
export interface SensorModel { name: string; model: string; pins: string[]; width: number; height: number; color: string; headHeight?: number }
// Pin order is for the depicted breakout variant, viewed from the component side.
export const SENSOR_MODELS: Record<SensorKind, SensorModel> = {
  dht11: { name: '温湿度传感器', model: 'DHT11 三针模块', pins: ['VCC', 'DATA', 'GND'], width: 66, height: 112, color: '#24568a' },
  'hc-sr04': { name: '超声波测距', model: 'HC-SR04', pins: ['VCC', 'TRIG', 'ECHO', 'GND'], width: 162, height: 86, color: '#23568a' },
  'hc-sr501': { name: '人体红外传感器', model: 'HC-SR501', pins: ['VCC', 'OUT', 'GND'], width: 108, height: 112, color: '#285b43' },
  light: { name: '光敏传感器', model: 'LM393 光敏模块', pins: ['VCC', 'GND', 'DO', 'AO'], width: 68, height: 112, color: '#23568a', headHeight: 24 },
  sound: { name: '声音传感器', model: 'KY-037', pins: ['AO', 'GND', 'VCC', 'DO'], width: 68, height: 126, color: '#23568a' },
  soil: { name: '土壤湿度传感器', model: '电容式土壤湿度 v1.2', pins: ['GND', 'VCC', 'AO'], width: 60, height: 184, color: '#252e2d' },
  flame: { name: '火焰传感器', model: '四针火焰模块', pins: ['AO', 'DO', 'GND', 'VCC'], width: 68, height: 112, color: '#23568a', headHeight: 28 },
  mq2: { name: '烟雾 / 气体传感器', model: 'MQ-2 模块', pins: ['VCC', 'GND', 'DO', 'AO'], width: 92, height: 114, color: '#23568a' },
  obstacle: { name: '红外避障传感器', model: 'FC-51', pins: ['OUT', 'GND', 'VCC'], width: 62, height: 118, color: '#23568a', headHeight: 34 },
  hall: { name: '霍尔磁场传感器', model: 'KY-024', pins: ['AO', 'GND', 'VCC', 'DO'], width: 68, height: 112, color: '#23568a', headHeight: 28 },
  thermistor: { name: '热敏传感器', model: 'NTC 温度模块', pins: ['VCC', 'GND', 'DO', 'AO'], width: 68, height: 112, color: '#24568a', headHeight: 28 },
  vibration: { name: '震动传感器', model: 'SW-420 模块', pins: ['VCC', 'GND', 'DO'], width: 64, height: 112, color: '#24568a', headHeight: 18 },
  motor: { name: '130 小风扇', model: '130 直流电机风扇', pins: ['M+', 'M−'], width: 88, height: 126, color: '#f4c629' },
  sg90: { name: 'SG90 舵机', model: 'SG90', pins: ['GND', 'VCC', 'PWM'], width: 110, height: 120, color: '#236ac0' },
  'traffic-light': { name: '红绿灯模块', model: 'TRAFFIC LIGHT', pins: ['GND', 'R', 'Y', 'G'], width: 68, height: 168, color: '#285b43' },
  relay: { name: '单路继电器', model: 'RELAY · 1CH', pins: ['VCC', 'GND', 'IN', 'NC', 'COM', 'NO'], width: 62, height: 130, color: '#173d68' },
  potentiometer: { name: '旋钮电位器', model: 'ROTARY POT', pins: ['VCC', 'SIG', 'GND'], width: 96, height: 110, color: '#285b43' },

}
export interface ExternalSensor { id: string; kind: SensorKind; position: Point; rotation: 0 | 90 | 180 | 270 }
export interface SensorPinRef { sensorId: string; pin: number }
export type WireEndpoint = { type: 'hole'; holeId: string } | ({ type: 'sensor' } & SensorPinRef)
export interface SensorWire { id: string; from: WireEndpoint; to: WireEndpoint; color: string; waypoints?: Point[] }
export interface Bounds { x: number; y: number; width: number; height: number }
export const endpointKey = (e: WireEndpoint) => e.type === 'hole' ? e.holeId : `sensor:${e.sensorId}:${e.pin}`
export function sensorPinLocal(sensor: Pick<ExternalSensor, 'kind'>, pin: number): Point & { direction: Point } {
  const model = SENSOR_MODELS[sensor.kind]
  if (sensor.kind === 'motor') return { x: (pin - 0.5) * 18, y: 32, direction: { x: 0, y: 1 } }
  const top = sensor.kind === 'relay' && pin >= 3
  const count = sensor.kind === 'relay' ? 3 : model.pins.length
  return { x: ((top ? pin - 3 : pin) - (count - 1) / 2) * 18, y: (top ? -1 : 1) * (model.height / 2 + 12), direction: { x: 0, y: top ? -1 : 1 } }
}
function rotate(point: Point, rotation: ExternalSensor['rotation']): Point {
  switch (rotation) {
    case 90: return { x: -point.y, y: point.x }
    case 180: return { x: -point.x, y: -point.y }
    case 270: return { x: point.y, y: -point.x }
    default: return { ...point }
  }
}
export function sensorPinPoint(sensor: ExternalSensor, pin: number): Point {
  const point = rotate(sensorPinLocal(sensor, pin), sensor.rotation)
  return { x: sensor.position.x + point.x, y: sensor.position.y + point.y }
}
export function sensorPcbTop(kind: SensorKind): number {
  const model = SENSOR_MODELS[kind]
  return -model.height / 2 + (model.headHeight ?? 0)
}
export function sensorBounds(sensor: ExternalSensor, includePins = true): Bounds {
  const model = SENSOR_MODELS[sensor.kind]
  const points = [{ x: -model.width / 2, y: -model.height / 2 }, { x: model.width / 2, y: sensor.kind === 'motor' ? 26 : model.height / 2 }]
  if (includePins) points.push(...model.pins.map((_, i) => sensorPinLocal(sensor, i)))
  const rotated = points.map(p => rotate(p, sensor.rotation))
  const x = Math.min(...rotated.map(p => p.x)), y = Math.min(...rotated.map(p => p.y))
  return { x: sensor.position.x + x, y: sensor.position.y + y, width: Math.max(...rotated.map(p => p.x)) - x, height: Math.max(...rotated.map(p => p.y)) - y }
}
export function sensorOutsideBoard(sensor: ExternalSensor): boolean {
  const b = sensorBounds(sensor)
  return b.x + b.width <= -8 || b.x >= BOARD_WIDTH + 8 || b.y + b.height <= -8 || b.y >= BOARD_HEIGHT + 8
}
export function endpointPoint(document: BreadboardDocument, endpoint: WireEndpoint): Point | undefined {
  if (endpoint.type === 'hole') return holeById.get(endpoint.holeId)
  const sensor = document.sensors?.find(s => s.id === endpoint.sensorId)
  return sensor && SENSOR_MODELS[sensor.kind].pins[endpoint.pin] !== undefined ? sensorPinPoint(sensor, endpoint.pin) : undefined
}
export function endpointLabel(document: BreadboardDocument, endpoint: WireEndpoint): string {
  if (endpoint.type === 'hole') return boardPointLabel(endpoint.holeId)
  const sensor = document.sensors?.find(s => s.id === endpoint.sensorId)
  return sensor ? `${SENSOR_MODELS[sensor.kind].name} · ${SENSOR_MODELS[sensor.kind].pins[endpoint.pin]}` : '未知端点'
}
export function sensorEndpointUsed(document: BreadboardDocument, source: WireEndpoint, ignoreId?: string): boolean {
  const key = endpointKey(source)
  return (document.sensorWires ?? []).some(w => w.id !== ignoreId && [w.from, w.to].some(e => endpointKey(e) === key))
}
export function nearestSensorEndpoint(document: BreadboardDocument, point: Point, radius = 12): WireEndpoint | undefined {
  let best: WireEndpoint | undefined, distance = radius
  for (const sensor of document.sensors ?? []) for (let pin = 0; pin < SENSOR_MODELS[sensor.kind].pins.length; pin++) {
    const p = sensorPinPoint(sensor, pin), d = Math.hypot(p.x - point.x, p.y - point.y)
    if (d <= distance) { distance = d; best = { type: 'sensor', sensorId: sensor.id, pin } }
  }
  return best
}
export function cleanOrthogonalPoints(points: Point[]): Point[] {
  const clean: Point[] = []
  for (const p of points) {
    const b = clean.at(-1)
    if (b && p.x === b.x && p.y === b.y) continue
    const a = clean.at(-2)
    if (a && b && ((a.x === b.x && b.x === p.x && (b.y - a.y) * (p.y - b.y) >= 0) || (a.y === b.y && b.y === p.y && (b.x - a.x) * (p.x - b.x) >= 0))) clean.pop()
    clean.push(p)
  }
  return clean
}
function inside(p: Point, b: Bounds): boolean { return p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height }
function clearSegment(a: Point, b: Point, boxes: Bounds[]): boolean {
  return !boxes.some(r => a.x === b.x
    ? a.x > r.x && a.x < r.x + r.width && Math.max(a.y, b.y) > r.y && Math.min(a.y, b.y) < r.y + r.height
    : a.y > r.y && a.y < r.y + r.height && Math.max(a.x, b.x) > r.x && Math.min(a.x, b.x) < r.x + r.width)
}
export const PARALLEL_WIRE_GAP = 12
export interface WireSegment { from: Point; to: Point }
export function wireSegments(points: Point[]): WireSegment[] {
  const clean = cleanOrthogonalPoints(points)
  return clean.slice(1).map((to, i) => ({ from: clean[i]!, to }))
}
export function parallelConflict(a: WireSegment, b: WireSegment): boolean {
  const av = a.from.x === a.to.x, bv = b.from.x === b.to.x
  if (av !== bv) return false
  const distance = Math.abs(av ? a.from.x - b.from.x : a.from.y - b.from.y)
  const overlap = av
    ? Math.min(Math.max(a.from.y, a.to.y), Math.max(b.from.y, b.to.y)) - Math.max(Math.min(a.from.y, a.to.y), Math.min(b.from.y, b.to.y))
    : Math.min(Math.max(a.from.x, a.to.x), Math.max(b.from.x, b.to.x)) - Math.max(Math.min(a.from.x, a.to.x), Math.min(b.from.x, b.to.x))
  return distance < PARALLEL_WIRE_GAP - 0.001 && overlap > 0.001
}

// The queue keeps routing responsive as additional wires add candidate lanes.
class RouteQueue {
  private items: { state: number; cost: number }[] = []
  push(item: { state: number; cost: number }) {
    let i = this.items.length
    this.items.push(item)
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[parent]!.cost <= item.cost) break
      this.items[i] = this.items[parent]!
      i = parent
    }
    this.items[i] = item
  }
  pop() {
    const first = this.items[0], last = this.items.pop()
    if (!first || !last || !this.items.length) return first
    let i = 0
    while (i * 2 + 1 < this.items.length) {
      let child = i * 2 + 1
      if (child + 1 < this.items.length && this.items[child + 1]!.cost < this.items[child]!.cost) child++
      if (this.items[child]!.cost >= last.cost) break
      this.items[i] = this.items[child]!
      i = child
    }
    this.items[i] = last
    return first
  }
}

// Rectilinear lanes can cross perpendicular wires, but do not share parallel runs.
function routeBetween(a: Point, b: Point, boxes: Bounds[], reserved: WireSegment[], allowConflict = false): Point[] | null {
  if (boxes.some(box => inside(a, box) || inside(b, box))) return null
  const minX = Math.min(a.x, b.x, ...boxes.map(r => r.x)) - 48
  const maxX = Math.max(a.x, b.x, ...boxes.map(r => r.x + r.width)) + 48
  const minY = Math.min(a.y, b.y, ...boxes.map(r => r.y)) - 48
  const maxY = Math.max(a.y, b.y, ...boxes.map(r => r.y + r.height)) + 48
  const nearby = reserved.filter(s => Math.max(s.from.x, s.to.x) >= minX && Math.min(s.from.x, s.to.x) <= maxX && Math.max(s.from.y, s.to.y) >= minY && Math.min(s.from.y, s.to.y) <= maxY)
  const laneX = nearby.flatMap(s => s.from.x === s.to.x ? [s.from.x - PARALLEL_WIRE_GAP, s.from.x + PARALLEL_WIRE_GAP] : [Math.min(s.from.x, s.to.x) - PARALLEL_WIRE_GAP, Math.max(s.from.x, s.to.x) + PARALLEL_WIRE_GAP])
  const laneY = nearby.flatMap(s => s.from.y === s.to.y ? [s.from.y - PARALLEL_WIRE_GAP, s.from.y + PARALLEL_WIRE_GAP] : [Math.min(s.from.y, s.to.y) - PARALLEL_WIRE_GAP, Math.max(s.from.y, s.to.y) + PARALLEL_WIRE_GAP])
  const xs = [...new Set([a.x, b.x, ...boxes.flatMap(r => [r.x, r.x + r.width]), ...laneX.filter(x => x >= minX && x <= maxX)])].sort((x, y) => x - y)
  const ys = [...new Set([a.y, b.y, ...boxes.flatMap(r => [r.y, r.y + r.height]), ...laneY.filter(y => y >= minY && y <= maxY)])].sort((x, y) => x - y)
  const points = xs.flatMap(x => ys.map(y => ({ x, y })))
  const start = xs.indexOf(a.x) * ys.length + ys.indexOf(a.y), end = xs.indexOf(b.x) * ys.length + ys.indexOf(b.y)
  // Direction is part of the state so equal-distance routes prefer fewer bends.
  const distances = new Float64Array(points.length * 3).fill(Infinity)
  const previous = new Int32Array(points.length * 3).fill(-1)
  const queue = new RouteQueue()
  distances[start * 3] = 0
  queue.push({ state: start * 3, cost: 0 })
  let final = -1
  for (let entry = queue.pop(); entry; entry = queue.pop()) {
    if (entry.cost !== distances[entry.state]) continue
    const current = Math.floor(entry.state / 3), direction = entry.state % 3
    if (current === end) { final = entry.state; break }
    const p = points[current]!
    for (const next of [current - 1, current + 1, current - ys.length, current + ys.length]) {
      const q = points[next]
      if (!q || (p.x !== q.x && p.y !== q.y) || !clearSegment(p, q, boxes)) continue
      const collision = nearby.some(s => parallelConflict({ from: p, to: q }, s))
      if (collision && !allowConflict) continue
      const nextDirection = p.x === q.x ? 1 : 2, nextState = next * 3 + nextDirection
      const length = Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
      const cost = entry.cost + length + (direction && direction !== nextDirection ? 12 : 0) + (collision ? 1000 + length * 100 : 0)
      if (cost < distances[nextState]!) {
        distances[nextState] = cost
        previous[nextState] = entry.state
        queue.push({ state: nextState, cost })
      }
    }
  }
  if (final < 0) return null
  const result: Point[] = []
  for (let i = final; i >= 0; i = previous[i]!) result.unshift(points[Math.floor(i / 3)]!)
  return cleanOrthogonalPoints(result)
}

type EndpointPreview = { end: 'from' | 'to'; point: Point }
function pinStub(document: BreadboardDocument, endpoint: WireEndpoint, point: Point, free = false): Point {
  const sensor = endpoint.type === 'sensor' && !free ? document.sensors?.find(s => s.id === endpoint.sensorId) : undefined
  if (!sensor || endpoint.type !== 'sensor') return point
  const d = rotate(sensorPinLocal(sensor, endpoint.pin).direction, sensor.rotation)
  return { x: point.x + d.x * 22, y: point.y + d.y * 22 }
}

function routeSensorWire(document: BreadboardDocument, wire: SensorWire, reserved: WireSegment[], preview?: { end: 'from' | 'to'; point: Point }): Point[] {
  const a = preview?.end === 'from' ? preview.point : endpointPoint(document, wire.from)
  const b = preview?.end === 'to' ? preview.point : endpointPoint(document, wire.to)
  if (!a || !b) return []
  const endpointSensors = [wire.from, wire.to].flatMap((e, i) => {
    if (e.type !== 'sensor' || preview?.end === (i === 0 ? 'from' : 'to')) return []
    const s = document.sensors?.find(s => s.id === e.sensorId)
    return s ? [s] : []
  })
  const boxes = endpointSensors.map(s => { const b = sensorBounds(s, false); return { x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 16 } })
  const start = pinStub(document, wire.from, a, preview?.end === 'from'), finish = pinStub(document, wire.to, b, preview?.end === 'to')
  const route = (waypoints: Point[], allowConflict = false) => {
    const points = [start, ...waypoints, finish], result: Point[] = [a]
    for (let i = 1; i < points.length; i++) {
      const segment = routeBetween(points[i - 1]!, points[i]!, boxes, reserved, allowConflict)
      if (!segment) return null
      result.push(...segment)
    }
    result.push(b)
    return cleanOrthogonalPoints(result)
  }
  return route(wire.waypoints ?? []) ?? route([]) ?? route(wire.waypoints ?? [], true) ?? route([], true) ?? []
}
export function sensorWireRoutes(document: BreadboardDocument, preview?: EndpointPreview & { wireId: string }): Map<string, Point[]> {
  const wires = document.sensorWires ?? []
  const routes = new Map<string, Point[]>()
  const reserved = document.wires.flatMap(w => {
    const a = holeById.get(w.from), b = holeById.get(w.to)
    return a && b && (a.x === b.x || a.y === b.y) ? [{ from: a, to: b }] : []
  }) as WireSegment[]
  // Reserve all terminal exits before routing, including wires that are drawn later.
  const stubs = wires.map(wire => ({ id: wire.id, segments: (['from', 'to'] as const).flatMap(end => {
    const p = preview?.wireId === wire.id && preview.end === end ? preview.point : endpointPoint(document, wire[end])
    if (!p) return []
    const stub = pinStub(document, wire[end], p, preview?.wireId === wire.id && preview.end === end)
    return p.x === stub.x && p.y === stub.y ? [] : [{ from: p, to: stub }]
  }) }))
  // User-adjusted paths get first choice; automatically routed peers move around them.
  const ordered = [...wires].sort((a, b) => Number(Boolean(b.waypoints?.length)) - Number(Boolean(a.waypoints?.length)))
  for (const wire of ordered) {
    const obstacles = [...reserved, ...stubs.filter(s => s.id !== wire.id).flatMap(s => s.segments)]
    const points = routeSensorWire(document, wire, obstacles, preview?.wireId === wire.id ? preview : undefined)
    routes.set(wire.id, points)
    reserved.push(...wireSegments(points))
  }
  return routes
}

export function sensorWirePoints(document: BreadboardDocument, wire: SensorWire, preview?: EndpointPreview): Point[] {
  const wires = document.sensorWires ?? []
  const routedDocument = { ...document, sensorWires: wires.some(w => w.id === wire.id) ? wires.map(w => w.id === wire.id ? wire : w) : [...wires, wire] }
  return sensorWireRoutes(routedDocument, preview ? { ...preview, wireId: wire.id } : undefined).get(wire.id) ?? []
}

export function wireSegmentHandles(points: Point[]) {
  return wireSegments(points).map(({ from, to }, index) => ({
    index, vertical: from.x === to.x, center: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
  }))
}

// Moving an end segment adds a short dogleg while keeping its terminal anchored.
export function moveWireSegment(points: Point[], index: number, point: Point): Point[] {
  const clean = cleanOrthogonalPoints(points), a = clean[index], b = clean[index + 1]
  if (!a || !b) return []
  const vertical = a.x === b.x
  const shift = (p: Point): Point => vertical ? { x: point.x, y: p.y } : { x: p.x, y: point.y }
  const inset = Math.min(22, Math.hypot(b.x - a.x, b.y - a.y) / 3)
  const direction = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) }
  const first = index === 0, last = index === clean.length - 2
  const nearA = { x: a.x + direction.x * inset, y: a.y + direction.y * inset }
  const nearB = { x: b.x - direction.x * inset, y: b.y - direction.y * inset }
  const moved = [
    ...clean.slice(0, index),
    ...(first ? [a, nearA, shift(nearA)] : [shift(a)]),
    ...(last ? [shift(nearB), nearB, b] : [shift(b)]),
    ...clean.slice(index + 2),
  ]
  return cleanOrthogonalPoints(moved).slice(1, -1)
}

export function roundedOrthogonalPath(points: Point[]): string {
  const clean = cleanOrthogonalPoints(points)
  if (!clean.length) return ''
  let path = `M ${clean[0]!.x} ${clean[0]!.y}`
  for (let i = 1; i < clean.length - 1; i++) {
    const a = clean[i - 1]!, b = clean[i]!, c = clean[i + 1]!
    const d1 = Math.hypot(b.x - a.x, b.y - a.y), d2 = Math.hypot(c.x - b.x, c.y - b.y)
    const r = Math.min(8, d1 / 2, d2 / 2)
    path += ` L ${b.x + (a.x - b.x) * r / d1} ${b.y + (a.y - b.y) * r / d1} Q ${b.x} ${b.y} ${b.x + (c.x - b.x) * r / d2} ${b.y + (c.y - b.y) * r / d2}`
  }
  const last = clean.at(-1)!
  return `${path} L ${last.x} ${last.y}`
}
