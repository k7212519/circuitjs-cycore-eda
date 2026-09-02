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
    expect(parseDocument(JSON.parse(serializeDocument(document)))).toEqual(document)
  })

  it('rejects unknown future schema versions and malformed data', () => {
    expect(() => parseDocument({ ...createEmptyDocument(), schemaVersion: 2 })).toThrow()
    expect(() => parseDocument({ ...createEmptyDocument(), components: 'invalid' })).toThrow()
  })
})
