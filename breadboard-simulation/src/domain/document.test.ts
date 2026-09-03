import { describe, expect, it } from 'vitest'
import { createEmptyDocument, parseDocument, serializeDocument } from './document'

describe('breadboard document schema', () => {
  it('round trips a version one document', () => {
    const document = createEmptyDocument('LED 实验')
    document.components.push({
      id: 'r-1', kind: 'resistor', pins: ['t-0-0-1', 't-0-0-6'], rotation: 0,
      value: 2200, label: '2.2 kΩ', bandCount: 5,
    })
    document.components.push({
      id: 'c-1', kind: 'capacitor', pins: ['t-1-0-1', 't-1-0-4'], rotation: 0,
      value: 10e-6, label: '10 µF', variant: 'electrolytic',
    })
    document.components.push({
      id: 'button-1', kind: 'button', pins: ['t-2-0-1', 't-2-0-6'], rotation: 0,
      value: 1, label: '瞬时按键',
    })
    document.components.push({
      id: 'switch-1', kind: 'switch', pins: ['t-3-0-1', 't-3-0-6'], rotation: 0,
      value: 1, label: '保持型开关',
    })
    expect(parseDocument(JSON.parse(serializeDocument(document)))).toEqual(document)
  })

  it('rejects unknown future schema versions and malformed data', () => {
    expect(() => parseDocument({ ...createEmptyDocument(), schemaVersion: 2 })).toThrow()
    expect(() => parseDocument({ ...createEmptyDocument(), components: 'invalid' })).toThrow()
  })

  it('round trips a ten-pin seven-segment display and rejects the wrong pin count', () => {
    const document = createEmptyDocument('数码管实验')
    const display = {
      id: 'display-1',
      kind: 'seven-segment' as const,
      pins: [
        't-1-1-20', 't-1-1-21', 't-1-1-22', 't-1-1-23', 't-1-1-24',
        't-0-2-24', 't-0-2-23', 't-0-2-22', 't-0-2-21', 't-0-2-20',
      ],
      rotation: 0 as const,
      value: 0.01,
      color: '#ef3d32',
      label: 'SC56-11EWA',
    }
    document.components.push(display)
    expect(parseDocument(JSON.parse(serializeDocument(document)))).toEqual(document)
    expect(() => parseDocument({
      ...document,
      components: [{ ...display, pins: display.pins.slice(0, 9) }],
    })).toThrow()
  })
})
