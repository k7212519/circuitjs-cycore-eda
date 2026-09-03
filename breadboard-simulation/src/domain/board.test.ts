import { describe, expect, it } from 'vitest'
import {
  BOARD_HEIGHT, BOARD_WIDTH, HOLE_RADIUS, HOLE_SLEEVE_RADIUS, defaultPlacement, holeById, holes, intrinsicNodeCount, nearestHole,
} from './board'

describe('dual 830 trimmed breadboard', () => {
  it('contains 1460 physical holes and 256 intrinsic nodes', () => {
    expect(holes).toHaveLength(1460)
    expect(intrinsicNodeCount).toBe(256)
  })

  it('uses the compact visual radii without changing the board pitch', () => {
    expect(HOLE_RADIUS).toBe(3.8)
    expect(HOLE_SLEEVE_RADIUS).toBe(6.4)
  })

  it('connects five terminal holes per column and fifty holes per rail', () => {
    expect(holeById.get('t-0-0-12')?.nodeId).toBe(holeById.get('t-0-4-12')?.nodeId)
    expect(holeById.get('t-0-0-12')?.nodeId).not.toBe(holeById.get('t-0-0-13')?.nodeId)
    expect(holeById.get('rail-top-positive-0')?.nodeId).toBe(holeById.get('rail-top-positive-49')?.nodeId)
    expect(holeById.get('rail-top-positive-0')?.nodeId).not.toBe(holeById.get('rail-bottom-positive-0')?.nodeId)
  })

  it('aligns rail endpoints to the third terminal holes with one empty grid position per group gap', () => {
    const first = holeById.get('rail-top-positive-0')!
    const fourth = holeById.get('rail-top-positive-4')!
    const fifth = holeById.get('rail-top-positive-5')!
    const last = holeById.get('rail-top-positive-49')!
    expect(first.x).toBe(holeById.get('t-0-0-2')?.x)
    expect(last.x).toBe(holeById.get('t-0-0-60')?.x)
    expect(fifth.x - fourth.x).toBe(36)
    expect(fifth.nodeId).toBe(fourth.nodeId)

    const terminalXs = new Set(
      holes.filter((hole) => hole.region === 'terminal' && hole.zone === 0 && hole.row === 0).map((hole) => hole.x),
    )
    const topRail = holes.filter((hole) => hole.region === 'rail' && hole.side === 'top' && hole.polarity === 'positive')
    expect(topRail.every((hole) => terminalXs.has(hole.x))).toBe(true)
  })

  it('keeps equal compact side padding around the terminal zones', () => {
    const first = holeById.get('t-0-0-0')!
    const last = holeById.get('t-0-0-62')!
    const containerPadding = 14
    const boardInset = 8
    expect(first.x - containerPadding).toBe(BOARD_WIDTH - (last.x + containerPadding))
    expect(first.x - containerPadding - boardInset).toBe(14)
  })

  it('keeps a two-hole-high trench between adjacent terminal zones', () => {
    const containerPadding = 14
    for (let zone = 0; zone < 3; zone += 1) {
      const upperLastRow = holeById.get(`t-${zone}-4-0`)!
      const lowerFirstRow = holeById.get(`t-${zone + 1}-0-0`)!
      const visibleTrench = lowerFirstRow.y - containerPadding - (upperLastRow.y + containerPadding)
      expect(visibleTrench).toBe(28)
    }
  })

  it('centers the physical join inside the middle trench', () => {
    const containerPadding = 14
    const upperEdge = holeById.get('t-1-4-0')!.y + containerPadding
    const lowerEdge = holeById.get('t-2-0-0')!.y - containerPadding
    expect((upperEdge + lowerEdge) / 2).toBe(BOARD_HEIGHT / 2)
  })

  it('symmetrically locates the A-B and C-D trench backgrounds', () => {
    const containerPadding = 14
    const centerBetween = (upperZone: number) => (
      holeById.get(`t-${upperZone}-4-0`)!.y + containerPadding
      + holeById.get(`t-${upperZone + 1}-0-0`)!.y - containerPadding
    ) / 2
    const centers = [centerBetween(0), centerBetween(2)]
    expect(centers).toEqual([203, 459])
    expect(centers[0]! + centers[1]!).toBe(BOARD_HEIGHT)
  })

  it('keeps a two-hole-high gap between terminal zones and power strips', () => {
    const containerPadding = 14
    const holeSleeveRadius = 7
    const topPower = holeById.get('rail-top-positive-0')!
    const firstTerminal = holeById.get('t-0-0-0')!
    const lastTerminal = holeById.get('t-3-4-0')!
    const bottomPower = holeById.get('rail-bottom-negative-0')!
    expect(firstTerminal.y - containerPadding - (topPower.y + holeSleeveRadius)).toBe(28)
    expect(bottomPower.y - holeSleeveRadius - (lastTerminal.y + containerPadding)).toBe(28)
  })

  it('keeps compact symmetric power strips at the top and bottom', () => {
    const topPositive = holeById.get('rail-top-positive-0')!
    const topNegative = holeById.get('rail-top-negative-0')!
    const bottomPositive = holeById.get('rail-bottom-positive-0')!
    const bottomNegative = holeById.get('rail-bottom-negative-0')!
    expect(topPositive.y).toBe(BOARD_HEIGHT - bottomNegative.y)
    expect(topNegative.y).toBe(BOARD_HEIGHT - bottomPositive.y)
    expect([topNegative.y, topPositive.y, bottomNegative.y, bottomPositive.y]).toEqual([34, 54, 608, 628])
    expect(topPositive.y - topNegative.y).toBe(20)
    expect(bottomPositive.y - bottomNegative.y).toBe(20)
  })

  it('snaps to the nearest hole and creates a valid default footprint', () => {
    const anchor = holeById.get('t-1-2-20')!
    expect(nearestHole({ x: anchor.x + 3, y: anchor.y - 2 }, 10)?.id).toBe(anchor.id)
    expect(defaultPlacement('resistor', anchor, new Set())).toEqual(['t-1-2-20', 't-1-2-25'])
    expect(defaultPlacement('button', anchor, new Set())).toEqual(['t-1-2-20', 't-1-2-22'])
    // Transistor package pins are stored in physical left-to-right E-B-C order.
    expect(defaultPlacement('npn', anchor, new Set())).toEqual(['t-1-2-20', 't-1-2-21', 't-1-2-22'])
  })

  it('creates the rigid SC56-11EWA footprint across a breadboard trench', () => {
    const lowerLeft = holeById.get('t-1-1-20')!
    expect(defaultPlacement('seven-segment', lowerLeft, new Set())).toEqual([
      't-1-1-20', 't-1-1-21', 't-1-1-22', 't-1-1-23', 't-1-1-24',
      't-0-2-24', 't-0-2-23', 't-0-2-22', 't-0-2-21', 't-0-2-20',
    ])
    expect(defaultPlacement('seven-segment', holeById.get('t-3-4-20')!, new Set())).toBeNull()
    expect(defaultPlacement('seven-segment', holeById.get('t-1-1-59')!, new Set())).toBeNull()
    expect(defaultPlacement('seven-segment', lowerLeft, new Set(['t-0-2-22']))).toBeNull()
  })
})
