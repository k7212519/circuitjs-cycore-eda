import { BOARD_HEIGHT, BOARD_WIDTH, boardPointLabel, holeById } from './board'
import type { BreadboardDocument, Point } from './types'

export const SENSOR_KINDS = ['dht11', 'hc-sr04', 'hc-sr501', 'light', 'sound', 'soil', 'flame', 'mq2', 'obstacle', 'hall', 'thermistor', 'vibration', 'motor', 'sg90', 'traffic-light', 'relay', 'potentiometer', 'buzzer'] as const
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
  buzzer: { name: '无源压电蜂鸣器', model: '两脚无源压电蜂鸣器', pins: ['+', '−'], width: 76, height: 76, color: '#202124' },
  potentiometer: { name: '旋钮电位器', model: 'ROTARY POT', pins: ['VCC', 'SIG', 'GND'], width: 96, height: 110, color: '#285b43' },

}
export interface ExternalSensor { id: string; kind: SensorKind; position: Point; rotation: 0 | 90 | 180 | 270 }
export interface SensorPinRef { sensorId: string; pin: number }
export type WireEndpoint = { type: 'hole'; holeId: string } | ({ type: 'sensor' } & SensorPinRef)
export interface WireLane { axis: 'x' | 'y'; value: number }
export interface SensorWire { id: string; from: WireEndpoint; to: WireEndpoint; color: string; waypoints?: Point[]; lanes?: WireLane[] }
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
    while (clean.length) {
      const b = clean.at(-1)!, a = clean.at(-2)
      if (p.x === b.x && p.y === b.y) { clean.pop(); continue }
      // Remove redundant excursions as well as forward collinear points.
      if (a && ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))) { clean.pop(); continue }
      break
    }
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
export const MIN_PARALLEL_WIRE_GAP = 9
const BEND_COST = 48
export interface WireSegment { from: Point; to: Point }
export function wireSegments(points: Point[]): WireSegment[] {
  const clean = cleanOrthogonalPoints(points)
  return clean.slice(1).map((to, i) => ({ from: clean[i]!, to }))
}
export function parallelConflict(a: WireSegment, b: WireSegment, gap = PARALLEL_WIRE_GAP): boolean {
  const av = a.from.x === a.to.x, bv = b.from.x === b.to.x
  if (av !== bv) return false
  const distance = Math.abs(av ? a.from.x - b.from.x : a.from.y - b.from.y)
  const overlap = av
    ? Math.min(Math.max(a.from.y, a.to.y), Math.max(b.from.y, b.to.y)) - Math.max(Math.min(a.from.y, a.to.y), Math.min(b.from.y, b.to.y))
    : Math.min(Math.max(a.from.x, a.to.x), Math.max(b.from.x, b.to.x)) - Math.max(Math.min(a.from.x, a.to.x), Math.min(b.from.x, b.to.x))
  return distance < gap - 0.001 && overlap > 0.001
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

type RouteGuide = WireLane | Point
const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y
const vector = (a: Point, b: Point): Point => ({ x: b.x - a.x, y: b.y - a.y })
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y
const directionOf = (d: Point) => d.x > 0 ? 1 : d.x < 0 ? 2 : d.y > 0 ? 3 : d.y < 0 ? 4 : 0
const opposite = (a: number, b: number) => (a === 1 && b === 2) || (a === 2 && b === 1) || (a === 3 && b === 4) || (a === 4 && b === 3)

function wireGuides(wire: SensorWire): RouteGuide[] {
  if (wire.lanes) return wire.lanes
  const points = cleanOrthogonalPoints(wire.waypoints ?? [])
  // Old files stored both ends of each lane. Recover lane intent without making
  // the old terminal-adjacent coordinates mandatory after a module moves.
  if (points.length < 2) return points
  const guides: RouteGuide[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!
    if (a.x === b.x) guides.push({ axis: 'x', value: a.x })
    else if (a.y === b.y) guides.push({ axis: 'y', value: a.y })
    else guides.push(a, b)
  }
  return guides
}
function followsGuide(a: Point, b: Point, guide: RouteGuide): boolean {
  return 'axis' in guide ? a[guide.axis] === guide.value && b[guide.axis] === guide.value
    : (a.x === b.x && guide.x === a.x && guide.y >= Math.min(a.y, b.y) && guide.y <= Math.max(a.y, b.y)) || (a.y === b.y && guide.y === a.y && guide.x >= Math.min(a.x, b.x) && guide.x <= Math.max(a.x, b.x))
}
function guideProgress(points: Point[], guides: RouteGuide[]): number {
  let stage = 0
  if (guides[0] && !('axis' in guides[0]) && samePoint(points[0]!, guides[0])) stage++
  for (let i = 1; i < points.length; i++) {
    while (guides[stage] && followsGuide(points[i - 1]!, points[i]!, guides[stage]!)) stage++
  }
  return stage
}
function segmentsMeet(a: WireSegment, b: WireSegment): boolean {
  const av = a.from.x === a.to.x, bv = b.from.x === b.to.x
  const between = (n: number, x: number, y: number) => n >= Math.min(x, y) && n <= Math.max(x, y)
  if (av === bv) return av
    ? a.from.x === b.from.x && Math.max(Math.min(a.from.y, a.to.y), Math.min(b.from.y, b.to.y)) <= Math.min(Math.max(a.from.y, a.to.y), Math.max(b.from.y, b.to.y))
    : a.from.y === b.from.y && Math.max(Math.min(a.from.x, a.to.x), Math.min(b.from.x, b.to.x)) <= Math.min(Math.max(a.from.x, a.to.x), Math.max(b.from.x, b.to.x))
  const v = av ? a : b, h = av ? b : a
  return between(v.from.x, h.from.x, h.to.x) && between(h.from.y, v.from.y, v.to.y)
}
function simpleRoute(points: Point[]): boolean {
  if (points.length < 2) return false
  const segments = wireSegments(points)
  if (segments.some(s => samePoint(s.from, s.to) || (s.from.x !== s.to.x && s.from.y !== s.to.y))) return false
  for (let i = 0; i < segments.length; i++) for (let j = i + 2; j < segments.length; j++) {
    if (segmentsMeet(segments[i]!, segments[j]!)) return false
  }
  return true
}
function routeCost(points: Point[], reserved: WireSegment[] = []): number {
  if (!points.length) return Infinity
  let cost = Math.max(0, points.length - 2) * BEND_COST
  for (const s of wireSegments(points)) {
    const length = Math.abs(s.to.x - s.from.x) + Math.abs(s.to.y - s.from.y)
    const close = reserved.some(r => parallelConflict(s, r))
    cost += length * (close ? 1.25 : 1)
  }
  return cost
}

// Search the whole wire, including ordered user lanes. Signed directions prevent
// U-turns at intermediate guides as well as at the fixed terminal exits.
function routeBetween(a: Point, b: Point, boxes: Bounds[], reserved: WireSegment[], guides: RouteGuide[], incoming: Point, outgoing: Point, gap: number, preferred: Point[] = []): Point[] | null {
  if (boxes.some(box => inside(a, box) || inside(b, box))) return null
  const guidePoints = guides.filter((g): g is Point => !('axis' in g))
  const guideX = [...guidePoints.map(p => p.x), ...guides.flatMap(g => 'axis' in g && g.axis === 'x' ? [g.value] : [])]
  const guideY = [...guidePoints.map(p => p.y), ...guides.flatMap(g => 'axis' in g && g.axis === 'y' ? [g.value] : [])]
  const minX = Math.min(a.x, b.x, ...boxes.map(r => r.x), ...guideX, ...preferred.map(p => p.x)) - 48
  const maxX = Math.max(a.x, b.x, ...boxes.map(r => r.x + r.width), ...guideX, ...preferred.map(p => p.x)) + 48
  const minY = Math.min(a.y, b.y, ...boxes.map(r => r.y), ...guideY, ...preferred.map(p => p.y)) - 48
  const maxY = Math.max(a.y, b.y, ...boxes.map(r => r.y + r.height), ...guideY, ...preferred.map(p => p.y)) + 48
  const nearby = reserved.filter(s => Math.max(s.from.x, s.to.x) >= minX && Math.min(s.from.x, s.to.x) <= maxX && Math.max(s.from.y, s.to.y) >= minY && Math.min(s.from.y, s.to.y) <= maxY)
  const gaps = gap === PARALLEL_WIRE_GAP ? [gap] : [gap, PARALLEL_WIRE_GAP]
  const laneX = nearby.flatMap(s => gaps.flatMap(d => s.from.x === s.to.x ? [s.from.x - d, s.from.x + d] : [Math.min(s.from.x, s.to.x) - d, Math.max(s.from.x, s.to.x) + d]))
  const laneY = nearby.flatMap(s => gaps.flatMap(d => s.from.y === s.to.y ? [s.from.y - d, s.from.y + d] : [Math.min(s.from.y, s.to.y) - d, Math.max(s.from.y, s.to.y) + d]))
  const xs = [...new Set([a.x, b.x, minX, maxX, ...boxes.flatMap(r => [r.x, r.x + r.width]), ...guideX, ...preferred.map(p => p.x), ...laneX.filter(x => x >= minX && x <= maxX)])].sort((x, y) => x - y)
  const ys = [...new Set([a.y, b.y, minY, maxY, ...boxes.flatMap(r => [r.y, r.y + r.height]), ...guideY, ...preferred.map(p => p.y), ...laneY.filter(y => y >= minY && y <= maxY)])].sort((x, y) => x - y)
  const points = xs.flatMap(x => ys.map(y => ({ x, y })))
  const start = xs.indexOf(a.x) * ys.length + ys.indexOf(a.y), end = xs.indexOf(b.x) * ys.length + ys.indexOf(b.y)
  const stride = points.length * 5
  const distances = new Float64Array(stride * (guides.length + 1)).fill(Infinity)
  const previous = new Int32Array(distances.length).fill(-1)
  const queue = new RouteQueue()
  let initialStage = 0
  const pin = { x: a.x - incoming.x, y: a.y - incoming.y }
  while (guides[initialStage]) {
    const guide = guides[initialStage]!
    if ((!('axis' in guide) && samePoint(a, guide)) || (directionOf(incoming) && followsGuide(pin, a, guide))) initialStage++
    else break
  }
  const startState = initialStage * stride + start * 5 + directionOf(incoming)
  distances[startState] = 0
  queue.push({ state: startState, cost: 0 })
  let final = -1
  for (let entry = queue.pop(); entry; entry = queue.pop()) {
    if (entry.cost !== distances[entry.state]) continue
    const stage = Math.floor(entry.state / stride), current = Math.floor((entry.state % stride) / 5), direction = entry.state % 5
    if (current === end && stage === guides.length) { final = entry.state; break }
    const p = points[current]!
    for (const next of [current - 1, current + 1, current - ys.length, current + ys.length]) {
      const q = points[next]
      if (!q || (p.x !== q.x && p.y !== q.y) || !clearSegment(p, q, boxes)) continue
      const nextDirection = directionOf(vector(p, q))
      if (opposite(direction, nextDirection) || (next === end && dot(vector(p, q), outgoing) < 0)) continue
      const s = { from: p, to: q }
      if (nearby.some(r => parallelConflict(s, r, gap))) continue
      let nextStage = stage
      while (guides[nextStage] && followsGuide(p, q, guides[nextStage]!)) nextStage++
      if (next === end && directionOf(outgoing)) {
        const terminal = { x: b.x + outgoing.x, y: b.y + outgoing.y }
        while (guides[nextStage] && followsGuide(b, terminal, guides[nextStage]!)) nextStage++
      }
      const nextState = nextStage * stride + next * 5 + nextDirection
      const length = Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
      const endBend = next === end && nextStage === guides.length && directionOf(outgoing) && directionOf(outgoing) !== nextDirection ? BEND_COST : 0
      const close = nearby.some(r => parallelConflict(s, r))
      const cost = entry.cost + length * (close ? 1.25 : 1) + (direction && direction !== nextDirection ? BEND_COST : 0) + endBend
      if (cost < distances[nextState]!) {
        distances[nextState] = cost
        previous[nextState] = entry.state
        queue.push({ state: nextState, cost })
      }
    }
  }
  if (final < 0) return null
  const result: Point[] = []
  for (let i = final; i >= 0; i = previous[i]!) result.push(points[Math.floor((i % stride) / 5)]!)
  return cleanOrthogonalPoints(result.reverse())
}

type EndpointPreview = { end: 'from' | 'to'; point: Point }
function pinStub(document: BreadboardDocument, endpoint: WireEndpoint, point: Point, free = false): Point {
  const sensor = endpoint.type === 'sensor' && !free ? document.sensors?.find(s => s.id === endpoint.sensorId) : undefined
  if (!sensor || endpoint.type !== 'sensor') return point
  const d = rotate(sensorPinLocal(sensor, endpoint.pin).direction, sensor.rotation)
  return { x: point.x + d.x * 22, y: point.y + d.y * 22 }
}
function adaptRoute(points: Point[], a: Point, b: Point): Point[] {
  if (points.length < 3) return []
  const moved = points.map(p => ({ ...p }))
  moved[0] = a; moved[moved.length - 1] = b
  if (points[0]!.x === points[1]!.x) moved[1]!.x = a.x
  else moved[1]!.y = a.y
  if (points.at(-1)!.x === points.at(-2)!.x) moved[moved.length - 2]!.x = b.x
  else moved[moved.length - 2]!.y = b.y
  return cleanOrthogonalPoints(moved)
}
function routeSensorWire(document: BreadboardDocument, wire: SensorWire, reserved: WireSegment[], preview?: EndpointPreview, preferred?: Point[], planned?: Point[]): Point[] {
  const a = preview?.end === 'from' ? preview.point : endpointPoint(document, wire.from)
  const b = preview?.end === 'to' ? preview.point : endpointPoint(document, wire.to)
  if (!a || !b) return []
  const boxes = (document.sensors ?? []).map(s => { const r = sensorBounds(s, false); return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 } })
  const start = pinStub(document, wire.from, a, preview?.end === 'from'), finish = pinStub(document, wire.to, b, preview?.end === 'to')
  const incoming = vector(a, start), outgoing = vector(finish, b)
  const ownStubs = [{ from: a, to: start }, { from: finish, to: b }].filter(s => !samePoint(s.from, s.to))
  const obstacles = [...reserved, ...ownStubs]
  const guides = wireGuides(wire)
  const valid = (points: Point[], required: RouteGuide[], gap: number) => {
    if (!simpleRoute(points) || !samePoint(points[0]!, a) || !samePoint(points.at(-1)!, b) || guideProgress(points, required) !== required.length) return false
    const first = vector(a, points[1]!), last = vector(points.at(-2)!, b)
    if ((directionOf(incoming) && (directionOf(first) !== directionOf(incoming) || dot(first, first) < dot(incoming, incoming))) || (directionOf(outgoing) && (directionOf(last) !== directionOf(outgoing) || dot(last, last) < dot(outgoing, outgoing)))) return false
    // Exits can touch their own terminal body (notably the motor); the rest
    // of the path must avoid every module, including unconnected modules.
    const core = cleanOrthogonalPoints([start, ...points.slice(1, -1), finish])
    return wireSegments(core).every(s => clearSegment(s.from, s.to, boxes)) && wireSegments(points).every(s => !reserved.some(r => parallelConflict(s, r, gap)))
  }
  const old = preferred ? adaptRoute(preferred, a, b) : []
  const plan = planned ? cleanOrthogonalPoints(planned) : []
  if (plan.length && valid(plan, guides, PARALLEL_WIRE_GAP)) return plan
  const search = (required: RouteGuide[], gap: number) => {
    const core = routeBetween(start, finish, boxes, obstacles, required, incoming, outgoing, gap, old)
    if (!core) return null
    const result = cleanOrthogonalPoints([a, ...core, b])
    return valid(result, required, gap) ? result : null
  }
  // Respect the user's lanes whenever feasible. Only relax an invalid lane
  // after testing both preferred and minimum safe wire separation.
  for (const required of guides.length ? [guides, []] : [[]]) {
    let best = search(required, PARALLEL_WIRE_GAP)
    if (!best || routeCost(best) >= Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + 3 * BEND_COST) {
      const compact = search(required, MIN_PARALLEL_WIRE_GAP)
      if (compact && (!best || routeCost(compact, reserved) < routeCost(best, reserved))) best = compact
    }
    if (old.length && valid(old, required, PARALLEL_WIRE_GAP) && (!best || routeCost(old, reserved) <= routeCost(best, reserved) + PARALLEL_WIRE_GAP)) return old
    if (best) return best
  }
  return []
}

// A shared fan-out gives peers a chance to move together instead of forcing the
// last wire to snake around every greedy choice made before it.
function fanOutPlans(document: BreadboardDocument): Map<string, Point[]> {
  const groups = new Map<string, { wire: SensorWire; pin: Point; target: Point; n: Point; t: Point; side: number }[]>()
  for (const wire of document.sensorWires ?? []) {
    if (wireGuides(wire).length) continue
    const source = wire.from.type === 'sensor' && wire.to.type === 'hole' ? wire.from : wire.to.type === 'sensor' && wire.from.type === 'hole' ? wire.to : undefined
    if (!source) continue
    const sensor = document.sensors?.find(s => s.id === source.sensorId)
    const pin = endpointPoint(document, source), target = endpointPoint(document, source === wire.from ? wire.to : wire.from)
    if (!sensor || !pin || !target) continue
    const n = rotate(sensorPinLocal(sensor, source.pin).direction, sensor.rotation), t = { x: n.y, y: -n.x }
    const side = Math.sign(dot(vector(pin, target), t))
    if (!side || dot(vector(pin, target), n) < 22) continue
    const key = `${source.sensorId}:${n.x}:${n.y}:${side}`
    const group = groups.get(key) ?? []
    group.push({ wire, pin, target, n, t, side }); groups.set(key, group)
  }
  const plans = new Map<string, Point[]>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    group.sort((a, b) => b.side * dot(vector(a.pin, b.pin), a.t))
    for (const [rank, { wire, pin, target, n, t }] of group.entries()) {
      const turn = { x: pin.x + n.x * (22 + rank * PARALLEL_WIRE_GAP), y: pin.y + n.y * (22 + rank * PARALLEL_WIRE_GAP) }
      const shift = dot(vector(turn, target), t)
      const points = [pin, turn, { x: turn.x + t.x * shift, y: turn.y + t.y * shift }, target]
      plans.set(wire.id, wire.from.type === 'sensor' ? points : points.reverse())
    }
  }
  return plans
}
export function sensorWireRoutes(document: BreadboardDocument, preview?: EndpointPreview & { wireId: string }, preferred?: Map<string, Point[]>): Map<string, Point[]> {
  const wires = document.sensorWires ?? []
  const boardSegments = document.wires.flatMap(w => {
    const a = holeById.get(w.from), b = holeById.get(w.to)
    return a && b && (a.x === b.x || a.y === b.y) ? [{ from: a, to: b }] : []
  }) as WireSegment[]
  const stubs = wires.map(wire => ({ id: wire.id, segments: (['from', 'to'] as const).flatMap(end => {
    const p = preview?.wireId === wire.id && preview.end === end ? preview.point : endpointPoint(document, wire[end])
    if (!p) return []
    const stub = pinStub(document, wire[end], p, preview?.wireId === wire.id && preview.end === end)
    return samePoint(p, stub) ? [] : [{ from: p, to: stub }]
  }) }))
  // Geometry and endpoint identity make routing independent of creation order.
  const key = (w: SensorWire) => [endpointKey(w.from), endpointKey(w.to)].sort().join('|')
  const ordered = [...wires].sort((a, b) => Number(Boolean(wireGuides(b).length)) - Number(Boolean(wireGuides(a).length)) || key(a).localeCompare(key(b)))
  const pass = (plans?: Map<string, Point[]>) => {
    const routes = new Map<string, Point[]>(), reserved = [...boardSegments]
    for (const wire of ordered) {
      const obstacles = [...reserved, ...stubs.filter(s => s.id !== wire.id).flatMap(s => s.segments)]
      const points = routeSensorWire(document, wire, obstacles, preview?.wireId === wire.id ? preview : undefined, preferred?.get(wire.id), preview?.wireId === wire.id ? undefined : plans?.get(wire.id))
      routes.set(wire.id, points); reserved.push(...wireSegments(points))
    }
    return routes
  }
  const baseline = pass()
  const plans = fanOutPlans(document)
  if (!plans.size) return baseline
  const bundled = pass(plans)
  const score = (routes: Map<string, Point[]>) => {
    const segments = [...routes].map(([id, points]) => ({ id, segments: wireSegments(points) }))
    return [...routes].reduce((sum, [id, points]) => sum + routeCost(points, [...boardSegments, ...segments.filter(s => s.id !== id).flatMap(s => s.segments)]), 0)
  }
  // Hysteresis keeps a valid previous topology when the improvement is tiny.
  return score(bundled) + (preferred ? PARALLEL_WIRE_GAP : 0) < score(baseline) ? bundled : baseline
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

// Retain only edited lanes, in traversal order. Automatic connector corners
// remain free to follow moved terminals. Editing a lane replaces its old value.
export function moveWireLane(wire: SensorWire, points: Point[], index: number, point: Point): WireLane[] {
  const segments = wireSegments(points), segment = segments[index]
  if (!segment) return wire.lanes ?? []
  const axis = segment.from.x === segment.to.x ? 'x' : 'y'
  const lane: WireLane = { axis, value: point[axis] }
  const existing = wireGuides(wire).filter((g): g is WireLane => 'axis' in g)
  const placed = existing.flatMap(g => {
    const i = segments.findIndex(s => followsGuide(s.from, s.to, g))
    return i < 0 || i === index ? [] : [{ lane: g, index: i }]
  })
  placed.push({ lane, index })
  return placed.sort((a, b) => a.index - b.index).map(p => p.lane)
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
