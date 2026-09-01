import type { ComponentKind, Hole, Point, TwoPinComponentKind } from './types'

export const BOARD_ID = 'dual-830-trimmed-v1' as const
export const BOARD_WIDTH = 1188
export const BOARD_HEIGHT = 662
export const HOLE_PITCH = 18
export const HOLE_RADIUS = 4.4
export const RAIL_GROUP_SIZE = 5
export const RAIL_GROUP_GAP = HOLE_PITCH

const terminalStartX = 36
const terminalStartY = 103
const zoneGap = 56
const terminalSpan = (63 - 1) * HOLE_PITCH
const railSpan = (50 - 1) * HOLE_PITCH + 9 * RAIL_GROUP_GAP
const railStartX = terminalStartX + Math.round((terminalSpan - railSpan) / 2)

export const holes: Hole[] = []

for (let zone = 0; zone < 4; zone += 1) {
  const zoneY = terminalStartY + zone * (4 * HOLE_PITCH + zoneGap)
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 63; column += 1) {
      holes.push({
        id: `t-${zone}-${row}-${column}`,
        nodeId: `terminal-${zone}-${column}`,
        region: 'terminal',
        zone,
        row,
        column,
        x: terminalStartX + column * HOLE_PITCH,
        y: zoneY + row * HOLE_PITCH,
      })
    }
  }
}

const railRows = [
  { side: 'top' as const, polarity: 'negative' as const, y: 34 },
  { side: 'top' as const, polarity: 'positive' as const, y: 54 },
  { side: 'bottom' as const, polarity: 'negative' as const, y: 608 },
  { side: 'bottom' as const, polarity: 'positive' as const, y: 628 },
]

for (const rail of railRows) {
  for (let column = 0; column < 50; column += 1) {
    holes.push({
      id: `rail-${rail.side}-${rail.polarity}-${column}`,
      nodeId: `rail-${rail.side}-${rail.polarity}`,
      region: 'rail',
      side: rail.side,
      polarity: rail.polarity,
      column,
      x: railStartX + column * HOLE_PITCH + Math.floor(column / RAIL_GROUP_SIZE) * RAIL_GROUP_GAP,
      y: rail.y,
    })
  }
}

export const holeById = new Map(holes.map((hole) => [hole.id, hole]))

export const intrinsicNodeCount = new Set(holes.map((hole) => hole.nodeId)).size

export function nearestHole(point: Point, maxDistance = 16, excluded = new Set<string>()): Hole | null {
  let best: Hole | null = null
  let bestDistance = maxDistance
  for (const hole of holes) {
    if (excluded.has(hole.id)) continue
    const distance = Math.hypot(point.x - hole.x, point.y - hole.y)
    if (distance < bestDistance) {
      best = hole
      bestDistance = distance
    }
  }
  return best
}

export function defaultPinCount(kind: ComponentKind): number {
  return kind === 'npn' || kind === 'pnp' ? 3 : 2
}

export function isTwoPinComponent(kind: ComponentKind): kind is TwoPinComponentKind {
  return defaultPinCount(kind) === 2
}

export function defaultPlacement(kind: ComponentKind, anchor: Hole, occupied: Set<string>): string[] | null {
  const count = defaultPinCount(kind)
  const candidates: string[][] = []

  if (anchor.region === 'terminal' && anchor.zone !== undefined && anchor.row !== undefined) {
    const spans = count === 3 ? [0, 1, 2] : [0, 5]
    for (const direction of [1, -1]) {
      const pins = spans.map((span) => `t-${anchor.zone}-${anchor.row}-${anchor.column + direction * span}`)
      candidates.push(pins)
    }
    if (count === 2) {
      for (let targetZone = 0; targetZone < 4; targetZone += 1) {
        if (targetZone === anchor.zone) continue
        candidates.push([anchor.id, `t-${targetZone}-${anchor.row}-${anchor.column}`])
      }
    }
  } else if (anchor.region === 'rail') {
    const opposite = anchor.polarity === 'positive' ? 'negative' : 'positive'
    candidates.push([anchor.id, `rail-${anchor.side}-${opposite}-${anchor.column}`])
  }

  for (const pins of candidates) {
    if (pins.length !== count) continue
    const resolved = pins.map((id) => holeById.get(id))
    if (resolved.some((hole) => !hole)) continue
    if (pins.some((id) => occupied.has(id))) continue
    if (new Set(resolved.map((hole) => hole?.nodeId)).size !== pins.length) continue
    return pins
  }
  return null
}

export function boardPointLabel(holeId: string): string {
  const hole = holeById.get(holeId)
  if (!hole) return '未连接'
  if (hole.region === 'rail') {
    return `${hole.side === 'top' ? '上' : '下'}${hole.polarity === 'positive' ? '红' : '蓝'}轨 · ${hole.column + 1}`
  }
  const zoneName = ['A', 'B', 'C', 'D'][hole.zone ?? 0]
  return `${zoneName}${(hole.row ?? 0) + 1}-${hole.column + 1}`
}

export function holesForNode(nodeId: string): Hole[] {
  return holes.filter((hole) => hole.nodeId === nodeId)
}
