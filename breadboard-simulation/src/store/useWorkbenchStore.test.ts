import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain/document'
import { holeById } from '@/domain/board'
import { useWorkbenchStore } from './useWorkbenchStore'

describe('workbench history and placement', () => {
  beforeEach(() => {
    const initial = useWorkbenchStore.getInitialState()
    useWorkbenchStore.setState({
      document: createEmptyDocument(), projectId: null, dirty: false, selectedIds: [],
      activeTool: 'select', wireStart: null, componentStart: null, past: [], future: [], issues: [], readings: {}, closedContacts: {},
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
    expect(useWorkbenchStore.getState().activeTool).toBe('wire')
    useWorkbenchStore.getState().setActiveTool('select')
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

  it('places and moves the seven-segment display as a rigid non-rotating package', () => {
    const anchor = holeById.get('t-1-1-20')!
    expect(useWorkbenchStore.getState().placeAt('seven-segment', anchor)).toBe(true)
    const component = useWorkbenchStore.getState().document.components[0]!
    expect(component).toMatchObject({ kind: 'seven-segment', label: 'SC56-11EWA', rotation: 0 })
    expect(component.pins).toEqual([
      't-1-1-20', 't-1-1-21', 't-1-1-22', 't-1-1-23', 't-1-1-24',
      't-0-2-24', 't-0-2-23', 't-0-2-22', 't-0-2-21', 't-0-2-20',
    ])
    expect(useWorkbenchStore.getState().movePinTo(component.id, 0, holeById.get('t-1-1-30')!)).toBe(false)
    useWorkbenchStore.getState().rotateSelected()
    expect(useWorkbenchStore.getState().document.components[0]?.rotation).toBe(0)
    expect(useWorkbenchStore.getState().moveSelectionTo(component.id, holeById.get('t-3-1-30')!)).toBe(true)
    expect(useWorkbenchStore.getState().document.components[0]?.pins[0]).toBe('t-3-1-30')
    expect(useWorkbenchStore.getState().moveSelectionTo(component.id, holeById.get('t-2-1-30')!)).toBe(true)
  })

  it('clears selection in drawing mode and applies placement options to the new component', () => {
    const selectedAnchor = holeById.get('t-0-0-2')!
    useWorkbenchStore.getState().placeAt('diode', selectedAnchor)
    expect(useWorkbenchStore.getState().selectedIds).toHaveLength(1)

    useWorkbenchStore.getState().setActiveTool('resistor')
    expect(useWorkbenchStore.getState().selectedIds).toEqual([])
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
    expect(useWorkbenchStore.getState().selectedIds).toEqual([component?.id])
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

  it('places a two-pin momentary button and tracks its pressed state outside document history', () => {
    const start = holeById.get('t-2-2-10')!
    const invalidEnd = holeById.get('t-2-2-13')!
    const end = holeById.get('t-2-2-12')!
    useWorkbenchStore.getState().componentAt('button', start)
    expect(useWorkbenchStore.getState().componentAt('button', invalidEnd)).toBe(false)
    expect(useWorkbenchStore.getState().componentStart).toBe(start.id)
    useWorkbenchStore.getState().componentAt('button', end)

    const component = useWorkbenchStore.getState().document.components[0]!
    expect(component).toMatchObject({ kind: 'button', pins: [start.id, end.id], label: '瞬时按键' })
    expect(useWorkbenchStore.getState().movePinTo(component.id, 1, invalidEnd)).toBe(false)
    useWorkbenchStore.getState().rotateSelected()
    expect(useWorkbenchStore.getState().document.components[0]?.rotation).toBe(0)
    const pastLength = useWorkbenchStore.getState().past.length
    useWorkbenchStore.getState().setContactClosed(component.id, true)
    expect(useWorkbenchStore.getState().closedContacts[component.id]).toBe(true)
    expect(useWorkbenchStore.getState().past).toHaveLength(pastLength)
    useWorkbenchStore.getState().setContactClosed(component.id, false)
    expect(useWorkbenchStore.getState().closedContacts[component.id]).toBeUndefined()
  })

  it('keeps the runtime contact state of multiple momentary buttons independent', () => {
    useWorkbenchStore.getState().componentAt('button', holeById.get('t-0-0-10')!)
    useWorkbenchStore.getState().componentAt('button', holeById.get('t-0-0-12')!)
    useWorkbenchStore.getState().setActiveTool('button')
    useWorkbenchStore.getState().componentAt('button', holeById.get('t-0-0-20')!)
    useWorkbenchStore.getState().componentAt('button', holeById.get('t-0-0-22')!)
    const [first, second] = useWorkbenchStore.getState().document.components

    useWorkbenchStore.getState().setContactClosed(first!.id, true)
    useWorkbenchStore.getState().setContactClosed(second!.id, true)
    useWorkbenchStore.getState().setContactClosed(first!.id, false)

    expect(useWorkbenchStore.getState().closedContacts).toEqual({ [second!.id]: true })
  })

  it('toggles a retaining switch without dirtying the document or adding history', () => {
    const start = holeById.get('t-3-1-10')!
    const end = holeById.get('t-3-1-15')!
    useWorkbenchStore.getState().componentAt('switch', start)
    useWorkbenchStore.getState().componentAt('switch', end)
    const component = useWorkbenchStore.getState().document.components[0]!
    useWorkbenchStore.setState({ dirty: false })
    const pastLength = useWorkbenchStore.getState().past.length

    useWorkbenchStore.getState().toggleSwitch(component.id)
    expect(useWorkbenchStore.getState().closedContacts[component.id]).toBe(true)
    expect(useWorkbenchStore.getState().dirty).toBe(false)
    expect(useWorkbenchStore.getState().past).toHaveLength(pastLength)
    useWorkbenchStore.getState().toggleSwitch(component.id)
    expect(useWorkbenchStore.getState().closedContacts[component.id]).toBeUndefined()
  })

  it('clears session contact state when a switch is deleted or a project is replaced', () => {
    const start = holeById.get('t-0-1-20')!
    const end = holeById.get('t-0-1-25')!
    useWorkbenchStore.getState().componentAt('switch', start)
    useWorkbenchStore.getState().componentAt('switch', end)
    const component = useWorkbenchStore.getState().document.components[0]!
    useWorkbenchStore.getState().toggleSwitch(component.id)
    expect(useWorkbenchStore.getState().closedContacts[component.id]).toBe(true)

    useWorkbenchStore.getState().deleteSelected()
    expect(useWorkbenchStore.getState().closedContacts).toEqual({})
    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().closedContacts).toEqual({})

    useWorkbenchStore.getState().toggleSwitch(component.id)
    useWorkbenchStore.getState().loadProject(7, createEmptyDocument('新项目'))
    expect(useWorkbenchStore.getState().closedContacts).toEqual({})
  })

  it('replaces, adds and toggles runtime selections without changing document history', () => {
    useWorkbenchStore.getState().componentAt('resistor', holeById.get('t-0-0-2')!)
    useWorkbenchStore.getState().componentAt('resistor', holeById.get('t-0-0-5')!)
    useWorkbenchStore.getState().componentAt('diode', holeById.get('t-0-1-2')!)
    useWorkbenchStore.getState().componentAt('diode', holeById.get('t-0-1-5')!)
    const [resistor, diode] = useWorkbenchStore.getState().document.components
    expect(resistor && diode).toBeTruthy()
    const pastLength = useWorkbenchStore.getState().past.length
    useWorkbenchStore.setState({ dirty: false })

    useWorkbenchStore.getState().select(resistor!.id)
    expect(useWorkbenchStore.getState().selectedIds).toEqual([resistor!.id])
    useWorkbenchStore.getState().select(diode!.id, true)
    expect(useWorkbenchStore.getState().selectedIds).toEqual([resistor!.id, diode!.id])
    useWorkbenchStore.getState().select(resistor!.id, true)
    expect(useWorkbenchStore.getState().selectedIds).toEqual([diode!.id])
    useWorkbenchStore.getState().selectMany([resistor!.id], true)
    expect(useWorkbenchStore.getState().selectedIds).toEqual([diode!.id, resistor!.id])
    expect(useWorkbenchStore.getState().dirty).toBe(false)
    expect(useWorkbenchStore.getState().past).toHaveLength(pastLength)
  })

  it('moves a mixed component and wire selection atomically with one history entry', () => {
    useWorkbenchStore.getState().componentAt('resistor', holeById.get('t-0-0-2')!)
    useWorkbenchStore.getState().componentAt('resistor', holeById.get('t-0-0-5')!)
    useWorkbenchStore.getState().wireAt(holeById.get('t-0-1-2')!)
    useWorkbenchStore.getState().wireAt(holeById.get('t-0-1-5')!)
    const component = useWorkbenchStore.getState().document.components[0]!
    const wire = useWorkbenchStore.getState().document.wires[0]!
    useWorkbenchStore.getState().selectMany([component.id, wire.id])
    const pastLength = useWorkbenchStore.getState().past.length

    expect(useWorkbenchStore.getState().moveSelectionTo(component.id, holeById.get('t-0-0-8')!)).toBe(true)
    expect(useWorkbenchStore.getState().document.components[0]?.pins).toEqual(['t-0-0-8', 't-0-0-11'])
    expect(useWorkbenchStore.getState().document.wires[0]).toMatchObject({ from: 't-0-1-8', to: 't-0-1-11' })
    expect(useWorkbenchStore.getState().past).toHaveLength(pastLength + 1)
  })

  it('preserves the fixed three-hole button footprint during selection moves', () => {
    useWorkbenchStore.getState().componentAt('button', holeById.get('t-2-2-10')!)
    useWorkbenchStore.getState().componentAt('button', holeById.get('t-2-2-12')!)
    const button = useWorkbenchStore.getState().document.components[0]!

    expect(useWorkbenchStore.getState().moveSelectionTo(button.id, holeById.get('t-2-2-16')!)).toBe(true)
    expect(useWorkbenchStore.getState().document.components[0]?.pins).toEqual(['t-2-2-16', 't-2-2-18'])
    const before = structuredClone(useWorkbenchStore.getState().document)
    expect(useWorkbenchStore.getState().moveSelectionTo(button.id, holeById.get('rail-top-negative-10')!)).toBe(false)
    expect(useWorkbenchStore.getState().document).toEqual(before)
  })

  it('rejects the entire selection move when one target hole is occupied', () => {
    useWorkbenchStore.getState().componentAt('resistor', holeById.get('t-0-0-2')!)
    useWorkbenchStore.getState().componentAt('resistor', holeById.get('t-0-0-5')!)
    useWorkbenchStore.getState().componentAt('diode', holeById.get('t-0-1-8')!)
    useWorkbenchStore.getState().componentAt('diode', holeById.get('t-0-1-11')!)
    useWorkbenchStore.getState().wireAt(holeById.get('t-0-1-2')!)
    useWorkbenchStore.getState().wireAt(holeById.get('t-0-1-5')!)
    const component = useWorkbenchStore.getState().document.components[0]!
    const wire = useWorkbenchStore.getState().document.wires[0]!
    useWorkbenchStore.getState().selectMany([component.id, wire.id])
    const before = structuredClone(useWorkbenchStore.getState().document)
    const pastLength = useWorkbenchStore.getState().past.length

    expect(useWorkbenchStore.getState().moveSelectionTo(component.id, holeById.get('t-0-0-8')!)).toBe(false)
    expect(useWorkbenchStore.getState().document).toEqual(before)
    expect(useWorkbenchStore.getState().past).toHaveLength(pastLength)
  })

  it('deletes a mixed selection and clears contact state with one history entry', () => {
    useWorkbenchStore.getState().componentAt('switch', holeById.get('t-2-0-2')!)
    useWorkbenchStore.getState().componentAt('switch', holeById.get('t-2-0-7')!)
    useWorkbenchStore.getState().wireAt(holeById.get('t-2-1-2')!)
    useWorkbenchStore.getState().wireAt(holeById.get('t-2-1-7')!)
    const component = useWorkbenchStore.getState().document.components[0]!
    const wire = useWorkbenchStore.getState().document.wires[0]!
    useWorkbenchStore.getState().toggleSwitch(component.id)
    useWorkbenchStore.getState().selectMany([component.id, wire.id])
    const pastLength = useWorkbenchStore.getState().past.length

    useWorkbenchStore.getState().deleteSelected()
    expect(useWorkbenchStore.getState().document.components).toEqual([])
    expect(useWorkbenchStore.getState().document.wires).toEqual([])
    expect(useWorkbenchStore.getState().closedContacts).toEqual({})
    expect(useWorkbenchStore.getState().selectedIds).toEqual([])
    expect(useWorkbenchStore.getState().past).toHaveLength(pastLength + 1)
  })
})
