import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './document'
import { buildCircuitJsNetlist } from './netlist'
import { buildConnectivity, validateDocument } from './validation'

describe('connectivity validation and CircuitJS adapter', () => {
  it('blocks a direct 5V to ground short', () => {
    const document = createEmptyDocument()
    document.wires.push({ id: 'short', from: 'rail-top-positive-2', to: 'rail-top-negative-2', color: '#f00' })
    expect(validateDocument(document)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SHORT_CIRCUIT', level: 'error' }),
    ]))
    expect(buildCircuitJsNetlist(document).blocked).toBe(true)
  })

  it('emits a powered resistor netlist with stable component mapping', () => {
    const document = createEmptyDocument()
    document.components.push({
      id: 'r1', kind: 'resistor', pins: ['t-0-0-2', 't-0-0-7'], rotation: 0, value: 1000,
    })
    const result = buildCircuitJsNetlist(document)
    expect(result.blocked).toBe(false)
    expect(result.componentBindings).toEqual([
      expect.objectContaining({ componentId: 'r1', expectedType: 'ResistorElm' }),
    ])
    expect(result.circuit).toContain('\nv ')
    expect(result.circuit).toContain('\ng ')
    expect(result.circuit).toMatch(/\nr \d+ \d+ \d+ \d+ 0 1000/)
  })

  it('emits a normally-open switch that closes only while its button is pressed', () => {
    const document = createEmptyDocument()
    document.components.push({
      id: 'button1', kind: 'button', pins: ['t-0-0-2', 't-0-0-7'], rotation: 0, value: 1,
    })

    expect(buildCircuitJsNetlist(document).circuit).toMatch(/\ns \d+ \d+ \d+ \d+ 0 1 false/)
    expect(buildCircuitJsNetlist(document, { button1: true }).circuit).toMatch(/\ns \d+ \d+ \d+ \d+ 0 0 false/)
    expect(buildCircuitJsNetlist(document).componentBindings).toEqual([
      expect.objectContaining({ componentId: 'button1', expectedType: 'SwitchElm' }),
    ])
  })

  it('maps a retaining switch to the same runtime-controlled CircuitJS contact', () => {
    const document = createEmptyDocument()
    document.components.push({
      id: 'switch1', kind: 'switch', pins: ['t-1-0-2', 't-1-0-7'], rotation: 0, value: 1,
    })

    expect(buildCircuitJsNetlist(document).circuit).toMatch(/\ns \d+ \d+ \d+ \d+ 0 1 false/)
    expect(buildCircuitJsNetlist(document, { switch1: true }).circuit).toMatch(/\ns \d+ \d+ \d+ \d+ 0 0 false/)
  })

  it('detects a two-terminal component placed on one intrinsic node', () => {
    const document = createEmptyDocument()
    document.components.push({
      id: 'bad-led', kind: 'led', pins: ['t-0-0-4', 't-0-4-4'], rotation: 0, value: 0.01,
    })
    expect(validateDocument(document)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SAME_NODE', targetId: 'bad-led' }),
    ]))
  })

  it('warns when a component pin is electrically floating', () => {
    const document = createEmptyDocument()
    document.components.push({
      id: 'floating-r', kind: 'resistor', pins: ['t-2-0-1', 't-2-0-8'], rotation: 0, value: 1000,
    })
    expect(validateDocument(document)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FLOATING_PIN', level: 'warning', targetId: 'floating-r' }),
    ]))
  })

  it('maps every supported component category to exactly one CircuitJS element', () => {
    const cases = [
      { id: 'r', kind: 'resistor' as const, value: 1000, expectedType: 'ResistorElm', token: 'r ' },
      { id: 'c', kind: 'capacitor' as const, value: 1e-6, variant: 'ceramic' as const, expectedType: 'CapacitorElm', token: 'c ' },
      { id: 'ce', kind: 'capacitor' as const, value: 10e-6, variant: 'electrolytic' as const, expectedType: 'PolarCapacitorElm', token: '209 ' },
      { id: 'led', kind: 'led' as const, value: 0.02, color: '#48b96b', expectedType: 'LEDElm', token: '162 ' },
      { id: 'd', kind: 'diode' as const, value: 1, expectedType: 'DiodeElm', token: 'd ' },
      { id: 's', kind: 'switch' as const, value: 1, expectedType: 'SwitchElm', token: 's ' },
      { id: 'b', kind: 'button' as const, value: 1, expectedType: 'SwitchElm', token: 's ' },
      { id: 'q1', kind: 'npn' as const, value: 120, expectedType: 'TransistorElm', token: 't ' },
      { id: 'q2', kind: 'pnp' as const, value: 80, expectedType: 'TransistorElm', token: 't ' },
    ]

    for (const component of cases) {
      const document = createEmptyDocument()
      document.components.push({
        ...component,
        pins: component.kind === 'npn' || component.kind === 'pnp'
          ? ['t-0-0-2', 't-0-0-3', 't-0-0-4']
          : ['t-0-0-2', 't-0-0-7'],
        rotation: 0,
      })
      const result = buildCircuitJsNetlist(document)
      expect(result.componentBindings).toHaveLength(1)
      const binding = result.componentBindings[0]!
      expect(binding).toMatchObject({ componentId: component.id, expectedType: component.expectedType })
      expect(result.circuit.split('\n')[binding.elementIndex + 1]).toMatch(new RegExp(`^${component.token}`))
    }
  })

  it('maps the ten physical display pins to one common-cathode SevenSegElm', () => {
    const document = createEmptyDocument()
    const physicalPins = [
      't-1-1-20', 't-1-1-21', 't-1-1-22', 't-1-1-23', 't-1-1-24',
      't-0-2-24', 't-0-2-23', 't-0-2-22', 't-0-2-21', 't-0-2-20',
    ]
    document.components.push({
      id: 'display-1', kind: 'seven-segment', pins: physicalPins, rotation: 0,
      value: 0.01, color: '#ef3d32', label: 'SC56-11EWA',
    })
    const connectivity = buildConnectivity(document)
    const roots = Array.from(new Set(connectivity.rootForHole.values())).sort()
    const pointFor = (pin: string) => {
      const root = connectivity.rootForHole.get(pin)!
      const index = roots.indexOf(root)
      return `${80 + (index % 36) * 32} ${128 + Math.floor(index / 36) * 32}`
    }
    const result = buildCircuitJsNetlist(document)
    const binding = result.componentBindings[0]!
    expect(binding).toMatchObject({ componentId: 'display-1', expectedType: 'SevenSegElm' })
    expect(result.circuit.split('\n')[binding.elementIndex + 1]).toBe('157 1600 480 1728 480 0 7 1 1')
    const connectorLines = result.circuit.split('\n').slice(binding.elementIndex - 9, binding.elementIndex + 1)
    const sourceOrder = [6, 5, 3, 1, 0, 8, 9, 4, 2, 7]
    expect(connectorLines.map((line) => line.split(' ').slice(1, 3).join(' '))).toEqual(
      sourceOrder.map((physicalIndex) => pointFor(physicalPins[physicalIndex]!)),
    )
    expect(connectorLines.slice(-2).map((line) => line.split(' ').slice(3, 5).join(' '))).toEqual(['1600 608', '1600 608'])
  })

  it('allows shared segment nets and unused pins on a seven-segment display', () => {
    const document = createEmptyDocument()
    document.components.push({
      id: 'display-1', kind: 'seven-segment',
      pins: [
        't-1-1-20', 't-1-1-21', 't-1-1-22', 't-1-1-23', 't-1-1-24',
        't-0-2-24', 't-0-2-23', 't-0-2-22', 't-0-2-21', 't-0-2-20',
      ],
      rotation: 0, value: 0.01,
    })
    document.wires.push(
      { id: 'shared-ab', from: 't-0-0-23', to: 't-0-0-24', color: '#f00' },
      { id: 'common-3', from: 't-1-0-22', to: 'rail-top-negative-0', color: '#000' },
      { id: 'common-8', from: 't-0-0-22', to: 'rail-top-negative-1', color: '#000' },
    )
    expect(validateDocument(document).filter((issue) => issue.targetId === 'display-1')).toEqual([])
    expect(buildCircuitJsNetlist(document).blocked).toBe(false)
  })

  it('writes LED color and maximum brightness current into the CircuitJS LED', () => {
    const document = createEmptyDocument()
    document.components.push({
      id: 'green-led', kind: 'led', pins: ['t-0-0-2', 't-0-0-7'], rotation: 0,
      value: 0.02, color: '#48b96b', label: '绿色 LED',
    })
    const result = buildCircuitJsNetlist(document)
    const binding = result.componentBindings[0]!
    const tokens = result.circuit.split('\n')[binding.elementIndex + 1]!.split(' ')
    expect(tokens[0]).toBe('162')
    expect(Number(tokens.at(-4))).toBeCloseTo(72 / 255)
    expect(Number(tokens.at(-3))).toBeCloseTo(185 / 255)
    expect(Number(tokens.at(-2))).toBeCloseTo(107 / 255)
    expect(Number(tokens.at(-1))).toBe(0.02)
  })

  it('maps physical E-B-C transistor pins to CircuitJS B-C-E nodes', () => {
    const document = createEmptyDocument()
    const physicalPins = ['t-0-0-20', 't-0-0-21', 't-0-0-22']
    document.components.push({
      id: 'q1', kind: 'npn', pins: physicalPins, rotation: 0, value: 100,
    })
    const connectivity = buildConnectivity(document)
    const roots = Array.from(new Set(connectivity.rootForHole.values())).sort()
    const pointFor = (pin: string) => {
      const root = connectivity.rootForHole.get(pin)!
      const index = roots.indexOf(root)
      return { x: 80 + (index % 36) * 32, y: 128 + Math.floor(index / 36) * 32 }
    }
    const [emitterPoint, basePoint, collectorPoint] = physicalPins.map(pointFor)
    const result = buildCircuitJsNetlist(document)
    const binding = result.componentBindings[0]!
    const transistorLineIndex = binding.elementIndex + 1
    const connectorLines = result.circuit.split('\n').slice(transistorLineIndex - 3, transistorLineIndex)

    expect(connectorLines[0]).toMatch(new RegExp(`^w ${basePoint!.x} ${basePoint!.y} `))
    expect(connectorLines[1]).toMatch(new RegExp(`^w ${collectorPoint!.x} ${collectorPoint!.y} `))
    expect(connectorLines[2]).toMatch(new RegExp(`^w ${emitterPoint!.x} ${emitterPoint!.y} `))
    expect(result.circuit.split('\n')[transistorLineIndex]).toMatch(/^t /)
  })

  it('gives duplicate component types distinct stable element bindings', () => {
    const document = createEmptyDocument()
    document.components.push(
      { id: 'r1', kind: 'resistor', pins: ['t-0-0-2', 't-0-0-7'], rotation: 0, value: 1000 },
      { id: 'r2', kind: 'resistor', pins: ['t-0-0-12', 't-0-0-17'], rotation: 0, value: 2200 },
    )
    const result = buildCircuitJsNetlist(document)
    expect(result.componentBindings.map(({ componentId }) => componentId)).toEqual(['r1', 'r2'])
    expect(new Set(result.componentBindings.map(({ elementIndex }) => elementIndex)).size).toBe(2)
    for (const binding of result.componentBindings) {
      expect(result.circuit.split('\n')[binding.elementIndex + 1]).toMatch(/^r /)
    }
  })
})
