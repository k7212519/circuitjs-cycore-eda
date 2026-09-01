import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain/document'
import { holeById } from '@/domain/board'
import { useWorkbenchStore } from './useWorkbenchStore'

describe('workbench history and placement', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
      document: createEmptyDocument(), projectId: null, dirty: false, selectedId: null,
      activeTool: 'select', wireStart: null, componentStart: null, past: [], future: [], issues: [], readings: {},
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
})
