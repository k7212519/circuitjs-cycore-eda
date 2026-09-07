import { beforeEach, describe, expect, it } from 'vitest'
import { defaultPlacement, halfTurnPins, holeById, type RigidModuleKind } from './board'
import { createEmptyDocument, parseDocument, serializeDocument } from './document'
import { ESP32_S3_PINS } from './esp32s3'
import { buildCircuitJsNetlist } from './netlist'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

describe('rigid module half turns', () => {
  beforeEach(() => useWorkbenchStore.setState({ ...useWorkbenchStore.getInitialState(), document: createEmptyDocument(), placementRotation: 0 }))
  const kinds: RigidModuleKind[] = ['cd4017', 'cd4026', 'esp32-s3', 'seven-segment']
  it.each(kinds)('%s keeps physical pin identity through placement, moving, history and saving', (kind) => {
    const anchor = holeById.get('t-1-1-10')!
    const original = defaultPlacement(kind, anchor, new Set())!
    useWorkbenchStore.getState().setActiveTool(kind)
    useWorkbenchStore.getState().rotatePlacement()
    expect(useWorkbenchStore.getState().placeAt(kind, anchor)).toBe(true)
    const component = useWorkbenchStore.getState().document.components[0]!
    expect(component.rotation).toBe(180)
    expect(component.pins).toEqual(halfTurnPins(original))
    const first = holeById.get(component.pins[0]!)!
    const next = holeById.get(`t-${first.zone}-${first.row}-${first.column + 2}`)!
    expect(useWorkbenchStore.getState().moveComponentTo(component.id, next)).toBe(true)
    const moved = useWorkbenchStore.getState().document.components[0]!
    expect(moved.pins[0]).toBe(next.id)
    const nextGroup = holeById.get(`t-${first.zone}-${first.row}-${first.column + 4}`)!
    expect(useWorkbenchStore.getState().moveSelectionTo(component.id, nextGroup)).toBe(true)
    expect(parseDocument(JSON.parse(serializeDocument(useWorkbenchStore.getState().document))).components[0]?.rotation).toBe(180)
    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().document.components[0]?.pins).toEqual(moved.pins)
    useWorkbenchStore.getState().select(component.id)
    useWorkbenchStore.getState().rotateSelected()
    expect(useWorkbenchStore.getState().document.components[0]?.pins).toEqual(halfTurnPins(moved.pins))
    useWorkbenchStore.getState().rotateSelected()
    expect(useWorkbenchStore.getState().document.components[0]?.pins).toEqual(moved.pins)
    expect(useWorkbenchStore.getState().moveComponentTo(component.id, holeById.get('t-0-0-0')!)).toBe(false)
  })

  it('places, moves and restores the board across both a trench and the center join', () => {
    useWorkbenchStore.getState().placeAt('esp32-s3', holeById.get('t-1-1-10')!)
    const id = useWorkbenchStore.getState().document.components[0]!.id
    expect(useWorkbenchStore.getState().moveSelectionTo(id, holeById.get('t-2-0-10')!)).toBe(true)
    const crossed = useWorkbenchStore.getState().document.components[0]!
    expect(crossed.pins[0]).toBe('t-2-0-10')
    expect(crossed.pins[43]).toBe('t-0-4-10')
    expect(parseDocument(JSON.parse(serializeDocument(useWorkbenchStore.getState().document))).components[0]?.pins).toEqual(crossed.pins)
    useWorkbenchStore.getState().rotateSelected()
    expect(useWorkbenchStore.getState().document.components[0]?.pins).toEqual(halfTurnPins(crossed.pins))
    useWorkbenchStore.getState().newProject()
    expect(useWorkbenchStore.getState().placeAt('esp32-s3', holeById.get('t-2-0-10')!)).toBe(true)
    expect(useWorkbenchStore.getState().document.components[0]?.pins).toEqual(crossed.pins)
  })

  it('maps the official headers with USB right, and excludes the board from simulation', () => {
    expect(ESP32_S3_PINS[0]).toEqual({ header: 'J1', number: 1, name: '3V3' })
    expect(ESP32_S3_PINS[21]).toEqual({ header: 'J1', number: 22, name: 'GND' })
    expect(ESP32_S3_PINS[22]).toEqual({ header: 'J3', number: 22, name: 'GND' })
    expect(ESP32_S3_PINS[43]).toEqual({ header: 'J3', number: 1, name: 'GND' })
    const empty = buildCircuitJsNetlist(createEmptyDocument())
    useWorkbenchStore.getState().placeAt('esp32-s3', holeById.get('t-1-1-10')!)
    const document = useWorkbenchStore.getState().document
    expect(new Set(document.components[0]!.pins).size).toBe(44)
    expect(useWorkbenchStore.getState().issues).toEqual([])
    expect(buildCircuitJsNetlist(document)).toEqual(empty)
    expect(parseDocument(JSON.parse(serializeDocument(document)))).toEqual(document)
    useWorkbenchStore.getState().setActiveTool('esp32-s3')
    expect(useWorkbenchStore.getState().placeAt('esp32-s3', holeById.get('t-1-1-10')!)).toBe(false)
    expect(useWorkbenchStore.getState().placeAt('esp32-s3', holeById.get('t-1-1-50')!)).toBe(false)
  })
})
