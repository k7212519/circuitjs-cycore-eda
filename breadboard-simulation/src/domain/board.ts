import type { ComponentKind, Hole, Point, TwoPinComponentKind } from './types'

export const BOARD_ID = 'dual-830-trimmed-v1' as const
export const BOARD_WIDTH = 1188
export const BOARD_HEIGHT = 662
export const HOLE_PITCH = 18
export const HOLE_RADIUS = 3.8
export const HOLE_SLEEVE_RADIUS = 6.4
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
  if (kind === 'seven-segment') return 10
  return kind === 'npn' || kind === 'pnp' ? 3 : 2
}

export function isTwoPinComponent(kind: ComponentKind): kind is TwoPinComponentKind {
  return defaultPinCount(kind) === 2
}

export function defaultPlacement(kind: ComponentKind, anchor: Hole, occupied: Set<string>): string[] | null {
  if (kind === 'seven-segment') return sevenSegmentPlacement(anchor, occupied)
  const count = defaultPinCount(kind)
  const candidates: string[][] = []

  if (anchor.region === 'terminal' && anchor.zone !== undefined && anchor.row !== undefined) {
    const spans = count === 3 ? [0, 1, 2] : kind === 'button' ? [0, 2] : [0, 5]
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
  } else if (anchor.region === 'rail' && kind !== 'button') {
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

function sevenSegmentPlacement(anchor: Hole, occupied: Set<string>): string[] | null {
  if (anchor.region !== 'terminal' || anchor.zone === undefined || anchor.row === undefined) return null
  if (anchor.column + 4 >= 63) return null

  let upperZone: number
  let upperRow: number
  let lowerZone: number
  let lowerRow: number
  if ((anchor.zone === 0 || anchor.zone === 2) && anchor.row >= 1) {
    upperZone = anchor.zone
    upperRow = anchor.row
    lowerZone = anchor.zone + 1
    lowerRow = anchor.row - 1
  } else if ((anchor.zone === 1 || anchor.zone === 3) && anchor.row <= 3) {
    lowerZone = anchor.zone
    lowerRow = anchor.row
    upperZone = anchor.zone - 1
    upperRow = anchor.row + 1
  } else {
    return null
  }

  const lower = Array.from({ length: 5 }, (_, offset) => `t-${lowerZone}-${lowerRow}-${anchor.column + offset}`)
  const upper = Array.from({ length: 5 }, (_, offset) => `t-${upperZone}-${upperRow}-${anchor.column + offset}`)
  // Physical numbering: bottom row 1-5 left-to-right, top row 6-10 right-to-left.
  const pins = [...lower, ...upper.reverse()]
  if (pins.some((pin) => !holeById.has(pin) || occupied.has(pin))) return null
  return pins
}

export function isValidButtonPinPair(first: Hole, second: Hole): boolean {
  return first.region === 'terminal'
    && second.region === 'terminal'
    && first.zone === second.zone
    && first.row === second.row
    && Math.abs(first.column - second.column) === 2
    && first.nodeId !== second.nodeId
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
