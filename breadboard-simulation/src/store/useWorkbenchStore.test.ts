import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain/document'
import { holeById } from '@/domain/board'
import { useWorkbenchStore } from './useWorkbenchStore'

describe('workbench history and placement', () => {
  beforeEach(() => {
    const initial = useWorkbenchStore.getInitialState()
    useWorkbenchStore.setState({
      document: createEmptyDocument(), projectId: null, dirty: false, selectedId: null,
      activeTool: 'select', wireStart: null, componentStart: null, past: [], future: [], issues: [], readings: {},
      wireColor: initial.wireColor,
      placementOptions: structuredClone(initial.placementOptions),
    })
  })

  it('places, selects, deletes and restores a component', () => {
    const anchor = holeById.get('t-2-1-10')!
    expect(useWorkbenchStore.getState().placeAt('resistor', anchor)).toBe(true)
    expect(useWorkbenchStore.getState().document.components).toHaveLength(1)
    useWorkbenchStore.getState().rotateSelected()
    expect(useWorkbenchStore.getState().document.components[0]?.rotation).toBe(90)
    expect(useWorkbenchStore.getState().document.components[0]?.pins).toEqual(['t-2-1-10', 't-3-1-10'])
    useWorkbenchStore.getState().deleteSelected()
    expect(useWorkbenchStore.getState().document.components).toHaveLength(0)
    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().document.components).toHaveLength(1)
    useWorkbenchStore.getState().redo()
    expect(useWorkbenchStore.getState().document.components).toHaveLength(0)
  })

  it('draws a wire through two separate click targets', () => {
    const start = holeById.get('t-0-0-1')!
    const end = holeById.get('t-0-0-8')!
    expect(useWorkbenchStore.getState().wireAt(start)).toBe(true)
    expect(useWorkbenchStore.getState().wireStart).toBe(start.id)
    expect(useWorkbenchStore.getState().wireAt(end)).toBe(true)
    expect(useWorkbenchStore.getState().document.wires[0]).toMatchObject({ from: start.id, to: end.id })
    expect(useWorkbenchStore.getState().activeTool).toBe('select')
    const moved = holeById.get('t-0-0-12')!
    expect(useWorkbenchStore.getState().moveWireEndTo(useWorkbenchStore.getState().document.wires[0]!.id, 'to', moved)).toBe(true)
    expect(useWorkbenchStore.getState().document.wires[0]?.to).toBe(moved.id)
  })

  it('places a two-pin component at the exact dragged endpoints', () => {
    const start = holeById.get('t-1-0-4')!
    const end = holeById.get('t-2-3-17')!

    expect(useWorkbenchStore.getState().componentAt('resistor', start)).toBe(true)
    expect(useWorkbenchStore.getState().componentStart).toBe(start.id)
    expect(useWorkbenchStore.getState().document.components).toHaveLength(0)

    expect(useWorkbenchStore.getState().componentAt('resistor', end)).toBe(true)
    expect(useWorkbenchStore.getState().componentStart).toBeNull()
    expect(useWorkbenchStore.getState().document.components[0]?.pins).toEqual([start.id, end.id])
  })

  it('keeps a custom two-pin span when moving the whole component', () => {
    const start = holeById.get('t-0-0-5')!
    const end = holeById.get('t-0-0-14')!
    useWorkbenchStore.getState().componentAt('capacitor', start)
    useWorkbenchStore.getState().componentAt('capacitor', end)
    const component = useWorkbenchStore.getState().document.components[0]!

    const movedStart = holeById.get('t-1-2-7')!
    expect(useWorkbenchStore.getState().moveComponentTo(component.id, movedStart)).toBe(true)
    expect(useWorkbenchStore.getState().document.components[0]?.pins).toEqual([
      't-1-2-7',
      't-1-2-16',
    ])
  })

  it('clears selection in drawing mode and applies placement options to the new component', () => {
    const selectedAnchor = holeById.get('t-0-0-2')!
    useWorkbenchStore.getState().placeAt('diode', selectedAnchor)
    expect(useWorkbenchStore.getState().selectedId).not.toBeNull()

    useWorkbenchStore.getState().setActiveTool('resistor')
    expect(useWorkbenchStore.getState().selectedId).toBeNull()
    useWorkbenchStore.getState().updatePlacementOptions('resistor', {
      value: 2200,
      label: '2.2 kΩ',
      bandCount: 5,
    })

    const start = holeById.get('t-1-0-8')!
    const end = holeById.get('t-1-0-18')!
    useWorkbenchStore.getState().componentAt('resistor', start)
    useWorkbenchStore.getState().componentAt('resistor', end)

    const component = useWorkbenchStore.getState().document.components.at(-1)
    expect(component).toMatchObject({ kind: 'resistor', value: 2200, label: '2.2 kΩ', bandCount: 5 })
    expect(useWorkbenchStore.getState().activeTool).toBe('select')
    expect(useWorkbenchStore.getState().selectedId).toBe(component?.id)
  })

  it('keeps the capacitor subtype selected on the left and copies it into the placed component', () => {
    useWorkbenchStore.getState().updatePlacementOptions('capacitor', {
      variant: 'electrolytic',
      value: 10e-6,
      label: '10 µF',
    })
    useWorkbenchStore.getState().setActiveTool('capacitor')

    const start = holeById.get('t-1-1-8')!
    const end = holeById.get('t-1-1-14')!
    useWorkbenchStore.getState().componentAt('capacitor', start)
    useWorkbenchStore.getState().componentAt('capacitor', end)

    expect(useWorkbenchStore.getState().document.components[0]).toMatchObject({
      kind: 'capacitor', variant: 'electrolytic', value: 10e-6, label: '10 µF',
    })
  })
})
