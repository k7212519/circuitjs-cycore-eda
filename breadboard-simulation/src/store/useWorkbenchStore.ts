import { create } from 'zustand'
import { defaultPlacement, holeById, isTwoPinComponent, isValidButtonPinPair, nearestHole, sevenSegmentPlacementFromLowerPin } from '@/domain/board'
import { createEmptyDocument, parseDocument } from '@/domain/document'
import { occupiedHoles, validateDocument } from '@/domain/validation'
import type {
  BreadboardComponent,
  BreadboardDocument,
  ComponentKind,
  ComponentPlacementOptions,
  Point,
  SimulationReading,
  SimulationStatus,
  ToolKind,
  ValidationIssue,
  ViewportState,
} from '@/domain/types'

const clone = (document: BreadboardDocument): BreadboardDocument => structuredClone(document)
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const defaults: Record<ComponentKind, ComponentPlacementOptions> = {
  resistor: { value: 1000, label: '1 kΩ', bandCount: 4 },
  capacitor: { value: 100e-9, label: '100 nF', variant: 'ceramic' },
  led: { value: 0.01, color: '#ef3d32', label: '红色 LED' },
  diode: { value: 1, label: '1N4148', variant: 'small-signal' },
  switch: { value: 1, label: '保持型开关' },
  button: { value: 1, label: '瞬时按键' },
  npn: { value: 100, label: '2N3904' },
  pnp: { value: 100, label: '2N3906' },
  'seven-segment': { value: 0.01, color: '#ef3d32', label: 'SC56-11EWA', variant: 'common-cathode' },
}

interface WorkbenchState {
  document: BreadboardDocument
  projectId: number | null
  dirty: boolean
  selectedIds: string[]
  activeTool: ToolKind
  wireStart: string | null
  componentStart: string | null
  wireColor: string
  placementOptions: Record<ComponentKind, ComponentPlacementOptions>
  past: BreadboardDocument[]
  future: BreadboardDocument[]
  readings: Record<string, SimulationReading>
  closedContacts: Record<string, boolean>
  issues: ValidationIssue[]
  simulationStatus: SimulationStatus
  running: boolean
  setActiveTool: (tool: ToolKind) => void
  placeAt: (kind: ComponentKind, point: Point) => boolean
  componentAt: (kind: ComponentKind, point: Point) => boolean
  wireAt: (point: Point) => boolean
  moveComponentTo: (componentId: string, point: Point) => boolean
  movePinTo: (componentId: string, pinIndex: number, point: Point) => boolean
  moveWireTo: (wireId: string, point: Point) => boolean
  moveWireEndTo: (wireId: string, end: 'from' | 'to', point: Point) => boolean
  moveSelectionTo: (anchorId: string, point: Point) => boolean
  select: (id: string | null, additive?: boolean) => void
  selectMany: (ids: string[], additive?: boolean) => void
  deleteSelected: () => void
  rotateSelected: () => void
  updateSelected: (patch: Partial<Pick<BreadboardComponent, 'value' | 'color' | 'label' | 'bandCount' | 'variant'>>) => void
  updatePlacementOptions: (kind: ComponentKind, patch: Partial<ComponentPlacementOptions>) => void
  setWireColor: (color: string) => void
  setContactClosed: (componentId: string, closed: boolean) => void
  toggleSwitch: (componentId: string) => void
  setViewport: (viewport: ViewportState) => void
  undo: () => void
  redo: () => void
  newProject: () => void
  loadProject: (projectId: number, document: unknown) => void
  setProjectIdentity: (projectId: number | null, projectName: string) => void
  markSaved: () => void
  setReadings: (readings: Record<string, SimulationReading>) => void
  setSimulationStatus: (status: SimulationStatus) => void
  toggleRunning: () => void
}

function withDocument(
  state: WorkbenchState,
  mutate: (document: BreadboardDocument) => void,
): Partial<WorkbenchState> {
  const next = clone(state.document)
  mutate(next)
  return {
    document: next,
    dirty: true,
    past: [...state.past.slice(-49), clone(state.document)],
    future: [],
    issues: validateDocument(next),
  }
}

function retainSwitchContacts(
  closedContacts: Record<string, boolean>,
  document: BreadboardDocument,
): Record<string, boolean> {
  const switchIds = new Set(document.components
    .filter((component) => component.kind === 'switch')
    .map((component) => component.id))
  return Object.fromEntries(Object.entries(closedContacts)
    .filter(([componentId, closed]) => closed && switchIds.has(componentId)))
}

function occupiedHolesExcept(document: BreadboardDocument, ignoredIds: ReadonlySet<string>): Set<string> {
  const occupied = new Set<string>()
  for (const component of document.components) {
    if (!ignoredIds.has(component.id)) component.pins.forEach((pin) => occupied.add(pin))
  }
  for (const wire of document.wires) {
    if (!ignoredIds.has(wire.id)) {
      occupied.add(wire.from)
      occupied.add(wire.to)
    }
  }
  return occupied
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  document: createEmptyDocument(),
  projectId: null,
  dirty: false,
  selectedIds: [],
  activeTool: 'select',
  wireStart: null,
  componentStart: null,
  wireColor: '#e4523d',
  placementOptions: structuredClone(defaults),
  past: [],
  future: [],
  readings: {},
  closedContacts: {},
  issues: [],
  simulationStatus: 'connecting',
  running: true,

  setActiveTool: (activeTool) => set((state) => ({
    activeTool,
    selectedIds: activeTool === 'select' ? state.selectedIds : [],
    wireStart: activeTool === 'wire' ? state.wireStart : null,
    componentStart: activeTool === state.activeTool && activeTool !== 'select'
      ? state.componentStart
      : null,
  })),

  placeAt: (kind, point) => {
    const state = get()
    const occupied = occupiedHoles(state.document)
    const anchor = nearestHole(point, 20, occupied)
    if (!anchor) return false
    const pins = defaultPlacement(kind, anchor, occupied)
    if (!pins) return false
    const component: BreadboardComponent = {
      id: id(kind),
      kind,
      pins,
      rotation: 0,
      ...state.placementOptions[kind],
    }
    set({
      ...withDocument(state, (document) => document.components.push(component)),
      selectedIds: [component.id],
      activeTool: 'select',
      wireStart: null,
      componentStart: null,
    })
    return true
  },

  componentAt: (kind, point) => {
    if (!isTwoPinComponent(kind)) return false
    const state = get()
    const occupied = occupiedHoles(state.document)
    const hole = nearestHole(point, 20, kind === 'button' ? new Set() : occupied)
    if (kind === 'button' && (!hole || occupied.has(hole.id) || hole.region !== 'terminal')) return false
    if (!hole) return false
    if (!state.componentStart || state.activeTool !== kind) {
      set({ activeTool: kind, componentStart: hole.id, wireStart: null, selectedIds: [] })
      return true
    }
    const fromHole = holeById.get(state.componentStart)
    if (kind === 'button' && fromHole && !isValidButtonPinPair(fromHole, hole)) return false
    if (!fromHole || fromHole.nodeId === hole.nodeId) {
      set({ componentStart: null })
      return false
    }
    const component: BreadboardComponent = {
      id: id(kind),
      kind,
      pins: [state.componentStart, hole.id],
      rotation: 0,
      ...state.placementOptions[kind],
    }
    set({
      ...withDocument(state, (document) => document.components.push(component)),
      componentStart: null,
      wireStart: null,
      selectedIds: [component.id],
      activeTool: 'select',
    })
    return true
  },

  wireAt: (point) => {
    const state = get()
    const occupied = occupiedHoles(state.document)
    const hole = nearestHole(point, 20, occupied)
    if (!hole) return false
    if (!state.wireStart) {
      set({ activeTool: 'wire', wireStart: hole.id, componentStart: null, selectedIds: [] })
      return true
    }
    const fromHole = holeById.get(state.wireStart)
    if (!fromHole || fromHole.nodeId === hole.nodeId) {
      set({ wireStart: null })
      return false
    }
    const wire = { id: id('wire'), from: state.wireStart, to: hole.id, color: state.wireColor }
    set({
      ...withDocument(state, (document) => document.wires.push(wire)),
      wireStart: null,
      selectedIds: [wire.id],
      activeTool: 'select',
    })
    return true
  },

  moveComponentTo: (componentId, point) => {
    const state = get()
    const component = state.document.components.find((item) => item.id === componentId)
    if (!component) return false
    const occupied = occupiedHoles(state.document, componentId)
    const anchor = nearestHole(point, 24, occupied)
    if (!anchor) return false
    if (component.kind === 'seven-segment') {
      const pins = sevenSegmentPlacementFromLowerPin(anchor, occupied)
      if (!pins) return false
      set(withDocument(state, (document) => {
        const target = document.components.find((item) => item.id === componentId)
        if (target) target.pins = pins
      }))
      return true
    }
    const sourcePoints = component.pins
      .map((pin) => holeById.get(pin))
      .filter((hole): hole is NonNullable<typeof hole> => Boolean(hole))
    if (sourcePoints.length !== component.pins.length || !sourcePoints[0]) return false
    const offset = { x: anchor.x - sourcePoints[0].x, y: anchor.y - sourcePoints[0].y }
    const reserved = new Set(occupied)
    const pins: string[] = []
    const nodes = new Set<string>()
    for (const source of sourcePoints) {
      const target = nearestHole({ x: source.x + offset.x, y: source.y + offset.y }, 24, reserved)
      if (!target || nodes.has(target.nodeId)) return false
      reserved.add(target.id)
      nodes.add(target.nodeId)
      pins.push(target.id)
    }
    if (component.kind === 'button') {
      const [firstPin, secondPin] = pins.map((pin) => holeById.get(pin))
      if (!firstPin || !secondPin || !isValidButtonPinPair(firstPin, secondPin)) return false
    }
    set(withDocument(state, (document) => {
      const target = document.components.find((item) => item.id === componentId)
      if (target) target.pins = pins
    }))
    return true
  },

  movePinTo: (componentId, pinIndex, point) => {
    const state = get()
    const component = state.document.components.find((item) => item.id === componentId)
    if (!component) return false
    if (component.kind === 'seven-segment') return false
    const occupied = occupiedHoles(state.document, componentId)
    component.pins.forEach((pin, index) => { if (index !== pinIndex) occupied.add(pin) })
    const hole = nearestHole(point, 24, component.kind === 'button' ? new Set() : occupied)
    if (component.kind === 'button' && (!hole || occupied.has(hole.id))) return false
    if (!hole) return false
    const otherNodes = component.pins
      .filter((_, index) => index !== pinIndex)
      .map((pin) => holeById.get(pin)?.nodeId)
    if (otherNodes.includes(hole.nodeId)) return false
    if (component.kind === 'button') {
      const otherPin = component.pins.find((_, index) => index !== pinIndex)
      const otherHole = otherPin ? holeById.get(otherPin) : undefined
      if (!otherHole || !isValidButtonPinPair(otherHole, hole)) return false
    }
    set(withDocument(state, (document) => {
      const target = document.components.find((item) => item.id === componentId)
      if (target) target.pins[pinIndex] = hole.id
    }))
    return true
  },

  moveWireTo: (wireId, point) => {
    const state = get()
    const wire = state.document.wires.find((item) => item.id === wireId)
    if (!wire) return false
    const from = holeById.get(wire.from)
    const to = holeById.get(wire.to)
    if (!from || !to) return false
    const occupied = occupiedHoles(state.document, wireId)
    const nextFrom = nearestHole(point, 24, occupied)
    if (!nextFrom) return false
    const offset = { x: nextFrom.x - from.x, y: nextFrom.y - from.y }
    const reserved = new Set(occupied)
    reserved.add(nextFrom.id)
    const nextTo = nearestHole({ x: to.x + offset.x, y: to.y + offset.y }, 24, reserved)
    if (!nextTo || nextFrom.nodeId === nextTo.nodeId) return false
    set(withDocument(state, (document) => {
      const target = document.wires.find((item) => item.id === wireId)
      if (target) {
        target.from = nextFrom.id
        target.to = nextTo.id
      }
    }))
    return true
  },

  moveWireEndTo: (wireId, end, point) => {
    const state = get()
    const wire = state.document.wires.find((item) => item.id === wireId)
    if (!wire) return false
    const occupied = occupiedHoles(state.document, wireId)
    occupied.add(end === 'from' ? wire.to : wire.from)
    const hole = nearestHole(point, 24, occupied)
    const otherHole = holeById.get(end === 'from' ? wire.to : wire.from)
    if (!hole || !otherHole || hole.nodeId === otherHole.nodeId) return false
    set(withDocument(state, (document) => {
      const target = document.wires.find((item) => item.id === wireId)
      if (target) target[end] = hole.id
    }))
    return true
  },

  moveSelectionTo: (anchorId, point) => {
    const state = get()
    const allIds = new Set([
      ...state.document.components.map((component) => component.id),
      ...state.document.wires.map((wire) => wire.id),
    ])
    const selectedIds = state.selectedIds.includes(anchorId)
      ? state.selectedIds.filter((id) => allIds.has(id))
      : allIds.has(anchorId) ? [anchorId] : []
    if (!selectedIds.length) return false
    const selected = new Set(selectedIds)
    const anchorComponent = state.document.components.find((component) => component.id === anchorId)
    const anchorWire = state.document.wires.find((wire) => wire.id === anchorId)
    const anchorPin = anchorComponent?.pins[0] ?? anchorWire?.from
    const sourceAnchor = anchorPin ? holeById.get(anchorPin) : undefined
    if (!sourceAnchor) return false

    const occupied = occupiedHolesExcept(state.document, selected)
    const targetAnchor = nearestHole(point, 24, occupied)
    if (!targetAnchor || targetAnchor.id === sourceAnchor.id) return false
    const offset = { x: targetAnchor.x - sourceAnchor.x, y: targetAnchor.y - sourceAnchor.y }
    const reserved = new Set(occupied)
    const resolveTarget = (pin: string) => {
      const source = holeById.get(pin)
      if (!source) return undefined
      const target = nearestHole({ x: source.x + offset.x, y: source.y + offset.y }, 1, reserved)
      if (!target) return undefined
      reserved.add(target.id)
      return target
    }

    const componentPins = new Map<string, string[]>()
    for (const component of state.document.components) {
      if (!selected.has(component.id)) continue
      const targets = component.pins.map(resolveTarget)
      if (targets.some((target) => !target)) return false
      const resolved = targets.filter((target): target is NonNullable<typeof target> => Boolean(target))
      if (new Set(resolved.map((target) => target.nodeId)).size !== resolved.length) return false
      if (component.kind === 'button') {
        const [first, second] = resolved
        if (!first || !second || !isValidButtonPinPair(first, second)) return false
      }
      if (component.kind === 'seven-segment') {
        const expected = sevenSegmentPlacementFromLowerPin(resolved[0]!, occupied)
        if (!expected || expected.some((pin, index) => pin !== resolved[index]?.id)) return false
      }
      componentPins.set(component.id, resolved.map((target) => target.id))
    }

    const wirePins = new Map<string, [string, string]>()
    for (const wire of state.document.wires) {
      if (!selected.has(wire.id)) continue
      const from = resolveTarget(wire.from)
      const to = resolveTarget(wire.to)
      if (!from || !to || from.nodeId === to.nodeId) return false
      wirePins.set(wire.id, [from.id, to.id])
    }

    set(withDocument(state, (document) => {
      for (const component of document.components) {
        const pins = componentPins.get(component.id)
        if (pins) component.pins = pins
      }
      for (const wire of document.wires) {
        const pins = wirePins.get(wire.id)
        if (pins) [wire.from, wire.to] = pins
      }
    }))
    return true
  },

  select: (selectedId, additive = false) => set((state) => {
    if (!selectedId) {
      return additive ? state : { selectedIds: [], activeTool: 'select', wireStart: null, componentStart: null }
    }
    const alreadySelected = state.selectedIds.includes(selectedId)
    const selectedIds = additive
      ? alreadySelected ? state.selectedIds.filter((id) => id !== selectedId) : [...state.selectedIds, selectedId]
      : alreadySelected ? state.selectedIds : [selectedId]
    return { selectedIds, activeTool: 'select', wireStart: null, componentStart: null }
  }),

  selectMany: (ids, additive = false) => set((state) => {
    const validIds = new Set([
      ...state.document.components.map((component) => component.id),
      ...state.document.wires.map((wire) => wire.id),
    ])
    const incoming = [...new Set(ids)].filter((id) => validIds.has(id))
    return {
      selectedIds: additive ? [...new Set([...state.selectedIds, ...incoming])] : incoming,
      activeTool: 'select',
      wireStart: null,
      componentStart: null,
    }
  }),

  deleteSelected: () => {
    const state = get()
    const selectedIds = new Set(state.selectedIds)
    const hasSelectedObjects = state.document.components.some((item) => selectedIds.has(item.id))
      || state.document.wires.some((item) => selectedIds.has(item.id))
    if (!hasSelectedObjects) return
    const closedContacts = { ...state.closedContacts }
    for (const selectedId of selectedIds) delete closedContacts[selectedId]
    set({
      ...withDocument(state, (document) => {
        document.components = document.components.filter((item) => !selectedIds.has(item.id))
        document.wires = document.wires.filter((item) => !selectedIds.has(item.id))
      }),
      selectedIds: [],
      closedContacts,
    })
  },

  rotateSelected: () => {
    const state = get()
    if (state.selectedIds.length !== 1) return
    const component = state.document.components.find((item) => item.id === state.selectedIds[0])
    if (!component) return
    if (component.kind === 'button' || component.kind === 'seven-segment') return
    const points = component.pins.map((pin) => holeById.get(pin)).filter(Boolean)
    if (points.length !== component.pins.length || !points[0]) return
    const occupied = occupiedHoles(state.document, component.id)
    const anchor = points[0]
    let rotated: Array<string | undefined>
    const terminalPoints = points.every((point) => point?.region === 'terminal')
    const horizontal = terminalPoints && points.every((point) => point?.zone === anchor.zone && point?.row === anchor.row)
    if (terminalPoints && horizontal && anchor.zone !== undefined && anchor.row !== undefined) {
      if (points.length === 3) {
        const direction = anchor.zone <= 1 ? 1 : -1
        rotated = [0, 1, 2].map((step) => `t-${anchor.zone! + step * direction}-${anchor.row}-${anchor.column}`)
      } else {
        const targetZone = anchor.zone < 3 ? anchor.zone + 1 : anchor.zone - 1
        rotated = [anchor.id, `t-${targetZone}-${anchor.row}-${anchor.column}`]
      }
    } else if (terminalPoints && anchor.zone !== undefined && anchor.row !== undefined) {
      const spans = points.length === 3 ? [0, 1, 2] : [0, 5]
      const direction = anchor.column + Math.max(...spans) < 63 ? 1 : -1
      rotated = spans.map((span) => `t-${anchor.zone}-${anchor.row}-${anchor.column + span * direction}`)
    } else {
      rotated = points.map((point, index) => {
        if (!point || index === 0) return anchor.id
        const dx = point.x - anchor.x
        const dy = point.y - anchor.y
        return nearestHole({ x: anchor.x - dy, y: anchor.y + dx }, 30, occupied)?.id
      })
    }
    const resolved = rotated.map((pin) => pin ? holeById.get(pin) : undefined)
    if (rotated.some((pin) => !pin || occupied.has(pin))
        || resolved.some((hole) => !hole)
        || new Set(rotated).size !== rotated.length
        || new Set(resolved.map((hole) => hole?.nodeId)).size !== resolved.length) return
    set(withDocument(state, (document) => {
      const target = document.components.find((item) => item.id === component.id)
      if (target) {
        target.pins = rotated as string[]
        target.rotation = ((target.rotation + 90) % 360) as 0 | 90 | 180 | 270
      }
    }))
  },

  updateSelected: (patch) => {
    const state = get()
    if (state.selectedIds.length !== 1) return
    set(withDocument(state, (document) => {
      const target = document.components.find((item) => item.id === state.selectedIds[0])
      if (target) Object.assign(target, patch)
    }))
  },

  updatePlacementOptions: (kind, patch) => set((state) => ({
    placementOptions: {
      ...state.placementOptions,
      [kind]: { ...state.placementOptions[kind], ...patch },
    },
  })),

  setWireColor: (wireColor) => set({ wireColor }),
  setContactClosed: (componentId, closed) => set((state) => {
    if (!closed && !state.closedContacts[componentId]) return state
    const closedContacts = { ...state.closedContacts }
    if (closed) closedContacts[componentId] = true
    else delete closedContacts[componentId]
    return { closedContacts }
  }),
  toggleSwitch: (componentId) => set((state) => {
    const component = state.document.components.find((item) => item.id === componentId)
    if (component?.kind !== 'switch') return state
    const closedContacts = { ...state.closedContacts }
    if (closedContacts[componentId]) delete closedContacts[componentId]
    else closedContacts[componentId] = true
    return { closedContacts }
  }),
  setViewport: (viewport) => set((state) => ({ document: { ...state.document, viewport } })),

  undo: () => {
    const state = get()
    const previous = state.past.at(-1)
    if (!previous) return
    set({
      document: clone(previous),
      past: state.past.slice(0, -1),
      future: [clone(state.document), ...state.future].slice(0, 50),
      dirty: true,
      selectedIds: [],
      wireStart: null,
      componentStart: null,
      issues: validateDocument(previous),
      closedContacts: retainSwitchContacts(state.closedContacts, previous),
    })
  },

  redo: () => {
    const state = get()
    const next = state.future[0]
    if (!next) return
    set({
      document: clone(next),
      past: [...state.past, clone(state.document)].slice(-50),
      future: state.future.slice(1),
      dirty: true,
      selectedIds: [],
      wireStart: null,
      componentStart: null,
      issues: validateDocument(next),
      closedContacts: retainSwitchContacts(state.closedContacts, next),
    })
  },

  newProject: () => set({
    document: createEmptyDocument(), projectId: null, dirty: false, selectedIds: [],
    past: [], future: [], issues: [], readings: {}, closedContacts: {}, wireStart: null, componentStart: null,
  }),

  loadProject: (projectId, value) => {
    const document = parseDocument(value)
    set({
      document, projectId, dirty: false, selectedIds: [], past: [], future: [],
      issues: validateDocument(document), readings: {}, closedContacts: {}, wireStart: null, componentStart: null,
    })
  },

  setProjectIdentity: (projectId, projectName) => set((state) => ({
    projectId,
    document: { ...state.document, projectName },
    dirty: true,
  })),
  markSaved: () => set({ dirty: false }),
  setReadings: (readings) => set({ readings }),
  setSimulationStatus: (simulationStatus) => set({ simulationStatus }),
  toggleRunning: () => set((state) => ({ running: !state.running })),
}))
