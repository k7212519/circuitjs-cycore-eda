import { holeById } from './board'
import type { BreadboardDocument, ValidationIssue } from './types'

class DisjointSet {
  private readonly parent = new Map<string, string>()

  add(value: string): void {
    if (!this.parent.has(value)) this.parent.set(value, value)
  }

  find(value: string): string {
    this.add(value)
    const parent = this.parent.get(value) as string
    if (parent === value) return value
    const root = this.find(parent)
    this.parent.set(value, root)
    return root
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)
    if (leftRoot !== rightRoot) this.parent.set(rightRoot, leftRoot)
  }
}

export interface Connectivity {
  rootForHole: Map<string, string>
  rootForNode: Map<string, string>
}

export function buildConnectivity(document: BreadboardDocument): Connectivity {
  const set = new DisjointSet()
  for (const hole of holeById.values()) set.add(hole.nodeId)

  for (const wire of document.wires) {
    const from = holeById.get(wire.from)
    const to = holeById.get(wire.to)
    if (from && to) set.union(from.nodeId, to.nodeId)
  }

  const rootForNode = new Map<string, string>()
  const rootForHole = new Map<string, string>()
  for (const hole of holeById.values()) {
    const root = set.find(hole.nodeId)
    rootForNode.set(hole.nodeId, root)
    rootForHole.set(hole.id, root)
  }
  return { rootForHole, rootForNode }
}

export function validateDocument(document: BreadboardDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const occupied = new Map<string, string>()

  const occupy = (holeId: string, targetId: string) => {
    const existing = occupied.get(holeId)
    if (existing && existing !== targetId) {
      issues.push({
        level: 'error',
        code: 'OCCUPIED_HOLE',
        message: '一个物理孔只能插入一根引脚。',
        targetId,
      })
    }
    occupied.set(holeId, targetId)
  }

  for (const component of document.components) {
    for (const pin of component.pins) occupy(pin, component.id)
  }
  for (const wire of document.wires) {
    occupy(wire.from, wire.id)
    occupy(wire.to, wire.id)
  }

  const connectivity = buildConnectivity(document)
  const attachmentCount = new Map<string, number>()
  for (const component of document.components) {
    for (const pin of component.pins) {
      const root = connectivity.rootForHole.get(pin)
      if (root) attachmentCount.set(root, (attachmentCount.get(root) ?? 0) + 1)
    }
  }
  const suppliedRoots = new Set([
    'rail-top-positive', 'rail-bottom-positive', 'rail-top-negative', 'rail-bottom-negative',
  ].map((node) => connectivity.rootForNode.get(node)).filter((root): root is string => Boolean(root)))
  for (const component of document.components) {
    const roots = component.pins.map((pin) => connectivity.rootForHole.get(pin)).filter(Boolean)
    if (new Set(roots).size !== roots.length) {
      issues.push({
        level: 'error',
        code: 'SAME_NODE',
        message: '元件的多个引脚落在同一电气节点，元件已被旁路。',
        targetId: component.id,
      })
    }
    if (component.pins.some((pin) => !holeById.has(pin))) {
      issues.push({
        level: 'warning',
        code: 'FLOATING_PIN',
        message: '元件存在未连接的引脚。',
        targetId: component.id,
      })
    }
    if (roots.some((root) => root && !suppliedRoots.has(root) && (attachmentCount.get(root) ?? 0) < 2)) {
      issues.push({
        level: 'warning',
        code: 'FLOATING_PIN',
        message: '元件存在悬空引脚，该节点尚未形成完整回路。',
        targetId: component.id,
      })
    }
  }

  const poweredRoots = ['rail-top-positive', 'rail-bottom-positive']
    .map((node) => connectivity.rootForNode.get(node))
  const groundRoots = new Set(['rail-top-negative', 'rail-bottom-negative']
    .map((node) => connectivity.rootForNode.get(node)))
  if (poweredRoots.some((root) => root && groundRoots.has(root))) {
    issues.push({
      level: 'error',
      code: 'SHORT_CIRCUIT',
      message: '检测到 +5V 与 GND 直接短接，仿真已暂停。',
    })
  }

  return issues
}

export function occupiedHoles(document: BreadboardDocument, ignoreId?: string): Set<string> {
  const result = new Set<string>()
  for (const component of document.components) {
    if (component.id !== ignoreId) component.pins.forEach((pin) => result.add(pin))
  }
  for (const wire of document.wires) {
    if (wire.id !== ignoreId) {
      result.add(wire.from)
      result.add(wire.to)
    }
  }
  return result
}
