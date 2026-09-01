import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './document'
import { buildCircuitJsNetlist } from './netlist'
import { validateDocument } from './validation'

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
    expect(result.componentOrder).toEqual(['r1'])
    expect(result.circuit).toContain('\nv ')
    expect(result.circuit).toContain('\ng ')
    expect(result.circuit).toMatch(/\nr \d+ \d+ \d+ \d+ 0 1000/)
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
})
