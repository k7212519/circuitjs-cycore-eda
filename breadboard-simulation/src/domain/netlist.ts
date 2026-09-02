import { holeById } from './board'
import { buildConnectivity, validateDocument } from './validation'
import type { BreadboardDocument, ComponentKind } from './types'

export interface NetlistBuildResult {
  circuit: string
  componentOrder: string[]
  blocked: boolean
}

interface XY { x: number; y: number }

function elementType(kind: ComponentKind): string {
  switch (kind) {
    case 'resistor': return 'ResistorElm'
    case 'capacitor': return 'CapacitorElm'
    case 'led': return 'LEDElm'
    case 'diode': return 'DiodeElm'
    case 'switch': return 'SwitchElm'
    case 'button': return 'SwitchElm'
    case 'npn':
    case 'pnp': return 'TransistorElm'
  }
}

export function circuitElementType(kind: ComponentKind): string {
  return elementType(kind)
}

export function buildCircuitJsNetlist(
  document: BreadboardDocument,
  closedContacts: Readonly<Record<string, boolean>> = {},
): NetlistBuildResult {
  const issues = validateDocument(document)
  if (issues.some((issue) => issue.level === 'error')) {
    return { circuit: '', componentOrder: [], blocked: true }
  }

  const connectivity = buildConnectivity(document)
  const roots = Array.from(new Set(connectivity.rootForHole.values())).sort()
  const points = new Map<string, XY>()
  roots.forEach((root, index) => {
    points.set(root, { x: 80 + (index % 36) * 32, y: 128 + Math.floor(index / 36) * 32 })
  })

  const lines = ['$ 1 0.000005 10.20027730826997 50 5 50 5e-11']
  const sourcePositive = { x: 32, y: 48 }
  const sourceGround = { x: 32, y: 80 }
  // CircuitJS defines the second post as V(first) + source voltage.
  lines.push(`v ${sourceGround.x} ${sourceGround.y} ${sourcePositive.x} ${sourcePositive.y} 0 0 40 5 0 0 0.5`)
  lines.push(`g ${sourceGround.x} ${sourceGround.y} ${sourceGround.x} ${sourceGround.y + 16} 0`)

  const wireTo = (from: XY, to: XY) => lines.push(`w ${from.x} ${from.y} ${to.x} ${to.y} 0`)
  for (const nodeId of ['rail-top-positive', 'rail-bottom-positive']) {
    const root = connectivity.rootForNode.get(nodeId)
    const target = root ? points.get(root) : undefined
    if (target) wireTo(sourcePositive, target)
  }
  for (const nodeId of ['rail-top-negative', 'rail-bottom-negative']) {
    const root = connectivity.rootForNode.get(nodeId)
    const target = root ? points.get(root) : undefined
    if (target) wireTo(sourceGround, target)
  }

  const componentOrder: string[] = []
  document.components.forEach((component, index) => {
    const pinPoints = component.pins.map((pin) => {
      const root = connectivity.rootForHole.get(pin)
      return root ? points.get(root) : undefined
    })
    if (pinPoints.some((point) => !point)) return

    const origin = { x: 80 + (index % 12) * 96, y: 480 + Math.floor(index / 12) * 80 }
    if (component.kind === 'npn' || component.kind === 'pnp') {
      const base = origin
      const body = { x: origin.x + 32, y: origin.y }
      const pnp = component.kind === 'pnp' ? -1 : 1
      const collector = { x: body.x, y: body.y - 16 * pnp }
      const emitter = { x: body.x, y: body.y + 16 * pnp }
      wireTo(pinPoints[0] as XY, base)
      wireTo(pinPoints[1] as XY, collector)
      wireTo(pinPoints[2] as XY, emitter)
      lines.push(`t ${base.x} ${base.y} ${body.x} ${body.y} 0 ${pnp} 0 0 ${component.value} default`)
    } else {
      const end = { x: origin.x + 64, y: origin.y }
      wireTo(pinPoints[0] as XY, origin)
      wireTo(pinPoints[1] as XY, end)
      switch (component.kind) {
        case 'resistor':
          lines.push(`r ${origin.x} ${origin.y} ${end.x} ${end.y} 0 ${component.value}`)
          break
        case 'capacitor':
          lines.push(`c ${origin.x} ${origin.y} ${end.x} ${end.y} 0 ${component.value} 0 0.001`)
          break
        case 'led':
          lines.push(`162 ${origin.x} ${origin.y} ${end.x} ${end.y} 2 default-led 1 0 0 0.01`)
          break
        case 'diode':
          lines.push(`d ${origin.x} ${origin.y} ${end.x} ${end.y} 3 default`)
          break
        case 'switch':
        case 'button':
          // CircuitJS switch position: 0 = closed, 1 = open. The workbench owns
          // the momentary interaction, so the imported switch itself is not toggled.
          lines.push(`s ${origin.x} ${origin.y} ${end.x} ${end.y} 0 ${closedContacts[component.id] ? 0 : 1} false`)
          break
      }
    }
    componentOrder.push(component.id)
  })

  return { circuit: lines.join('\n'), componentOrder, blocked: false }
}

export function netForHole(document: BreadboardDocument, holeId: string): string | undefined {
  if (!holeById.has(holeId)) return undefined
  return buildConnectivity(document).rootForHole.get(holeId)
}
