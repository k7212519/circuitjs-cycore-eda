import { holeById } from './board'
import { buildConnectivity, validateDocument } from './validation'
import type { BreadboardComponent, BreadboardDocument } from './types'

export interface ComponentBinding {
  componentId: string
  elementIndex: number
  expectedType: string
}

export interface NetlistBuildResult {
  circuit: string
  componentBindings: ComponentBinding[]
  blocked: boolean
}

interface XY { x: number; y: number }

export function circuitElementType(component: Pick<BreadboardComponent, 'kind' | 'variant'>): string {
  switch (component.kind) {
    case 'resistor': return 'ResistorElm'
    case 'capacitor': return component.variant === 'electrolytic' ? 'PolarCapacitorElm' : 'CapacitorElm'
    case 'led': return 'LEDElm'
    case 'diode': return 'DiodeElm'
    case 'switch': return 'SwitchElm'
    case 'button': return 'SwitchElm'
    case 'npn':
    case 'pnp': return 'TransistorElm'
  }
}

function ledRgb(color: string | undefined): [number, number, number] {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color ?? '')
  if (!match) return [1, 0, 0]
  return [1, 2, 3].map((index) => Number.parseInt(match[index] as string, 16) / 255) as [number, number, number]
}

export function buildCircuitJsNetlist(
  document: BreadboardDocument,
  closedContacts: Readonly<Record<string, boolean>> = {},
): NetlistBuildResult {
  const issues = validateDocument(document)
  if (issues.some((issue) => issue.level === 'error')) {
    return { circuit: '', componentBindings: [], blocked: true }
  }

  const connectivity = buildConnectivity(document)
  const roots = Array.from(new Set(connectivity.rootForHole.values())).sort()
  const points = new Map<string, XY>()
  roots.forEach((root, index) => {
    points.set(root, { x: 80 + (index % 36) * 32, y: 128 + Math.floor(index / 36) * 32 })
  })

  const lines = ['$ 1 0.000005 10.20027730826997 50 5 50 5e-11']
  let elementCount = 0
  const addElement = (line: string): number => {
    const elementIndex = elementCount
    elementCount += 1
    lines.push(line)
    return elementIndex
  }
  const sourcePositive = { x: 32, y: 48 }
  const sourceGround = { x: 32, y: 80 }
  // CircuitJS defines the second post as V(first) + source voltage.
  addElement(`v ${sourceGround.x} ${sourceGround.y} ${sourcePositive.x} ${sourcePositive.y} 0 0 40 5 0 0 0.5`)
  addElement(`g ${sourceGround.x} ${sourceGround.y} ${sourceGround.x} ${sourceGround.y + 16} 0`)

  const wireTo = (from: XY, to: XY) => addElement(`w ${from.x} ${from.y} ${to.x} ${to.y} 0`)
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

  const componentBindings: ComponentBinding[] = []
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
      const elementIndex = addElement(`t ${base.x} ${base.y} ${body.x} ${body.y} 0 ${pnp} 0 0 ${component.value} default`)
      componentBindings.push({ componentId: component.id, elementIndex, expectedType: circuitElementType(component) })
    } else {
      const end = { x: origin.x + 64, y: origin.y }
      wireTo(pinPoints[0] as XY, origin)
      wireTo(pinPoints[1] as XY, end)
      switch (component.kind) {
        case 'resistor':
          componentBindings.push({
            componentId: component.id,
            elementIndex: addElement(`r ${origin.x} ${origin.y} ${end.x} ${end.y} 0 ${component.value}`),
            expectedType: circuitElementType(component),
          })
          break
        case 'capacitor':
          componentBindings.push({
            componentId: component.id,
            elementIndex: component.variant === 'electrolytic'
              ? addElement(`209 ${origin.x} ${origin.y} ${end.x} ${end.y} 0 ${component.value} 0 0.001 1`)
              : addElement(`c ${origin.x} ${origin.y} ${end.x} ${end.y} 0 ${component.value} 0 0.001`),
            expectedType: circuitElementType(component),
          })
          break
        case 'led': {
          const [red, green, blue] = ledRgb(component.color)
          componentBindings.push({
            componentId: component.id,
            elementIndex: addElement(`162 ${origin.x} ${origin.y} ${end.x} ${end.y} 2 default-led ${red} ${green} ${blue} ${component.value}`),
            expectedType: circuitElementType(component),
          })
          break
        }
        case 'diode':
          componentBindings.push({
            componentId: component.id,
            elementIndex: addElement(`d ${origin.x} ${origin.y} ${end.x} ${end.y} 2 default`),
            expectedType: circuitElementType(component),
          })
          break
        case 'switch':
        case 'button':
          // CircuitJS switch position: 0 = closed, 1 = open. The workbench owns
          // the momentary interaction, so the imported switch itself is not toggled.
          componentBindings.push({
            componentId: component.id,
            elementIndex: addElement(`s ${origin.x} ${origin.y} ${end.x} ${end.y} 0 ${closedContacts[component.id] ? 0 : 1} false`),
            expectedType: circuitElementType(component),
          })
          break
      }
    }
  })

  return { circuit: lines.join('\n'), componentBindings, blocked: false }
}

export function netForHole(document: BreadboardDocument, holeId: string): string | undefined {
  if (!holeById.has(holeId)) return undefined
  return buildConnectivity(document).rootForHole.get(holeId)
}
