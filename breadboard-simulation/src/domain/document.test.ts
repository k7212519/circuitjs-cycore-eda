import { describe, expect, it } from 'vitest'
import { createEmptyDocument, parseDocument, serializeDocument } from './document'

describe('breadboard document schema', () => {
  it('round trips a version one document', () => {
    const document = createEmptyDocument('LED 实验')
    expect(parseDocument(JSON.parse(serializeDocument(document)))).toEqual(document)
  })

  it('rejects unknown future schema versions and malformed data', () => {
    expect(() => parseDocument({ ...createEmptyDocument(), schemaVersion: 2 })).toThrow()
    expect(() => parseDocument({ ...createEmptyDocument(), components: 'invalid' })).toThrow()
  })
})
