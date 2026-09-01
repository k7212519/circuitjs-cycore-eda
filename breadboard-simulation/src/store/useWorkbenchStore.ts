import { create } from 'zustand'
import { defaultPlacement, holeById, nearestHole } from '@/domain/board'
import { createEmptyDocument, parseDocument } from '@/domain/document'
import { occupiedHoles, validateDocument } from '@/domain/validation'
import type {
  BreadboardComponent,
  BreadboardDocument,
  ComponentKind,
  Point,
  SimulationReading,
  SimulationStatus,
  ToolKind,
  ValidationIssue,
  ViewportState,
} from '@/domain/types'

const clone = (document: BreadboardDocument): BreadboardDocument => structuredClone(document)
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const defaults: Record<ComponentKind, Pick<BreadboardComponent, 'value' | 'color' | 'label'>> = {
  resistor: { value: 1000, label: '1 kΩ' },
  capacitor: { value: 100e-9, label: '100 nF' },
  led: { value: 0.01, color: '#ef3d32', label: '红色 LED' },
  diode: { value: 1, label: '1N4148' },
  npn: { value: 100, label: '2N3904' },
  pnp: { value: 100, label: '2N3906' },
}

interface WorkbenchState {
  document: BreadboardDocument
  projectId: number | null
  dirty: boolean
  selectedId: string | null
  activeTool: ToolKind
  wireStart: string | null
  wireColor: string
  past: BreadboardDocument[]
  future: BreadboardDocument[]
  readings: Record<string, SimulationReading>
  issues: ValidationIssue[]
  simulationStatus: SimulationStatus
  running: boolean
  setActiveTool: (tool: ToolKind) => void
  placeAt: (kind: ComponentKind, point: Point) => boolean
  wireAt: (point: Point) => boolean
  moveComponentTo: (componentId: string, point: Point) => boolean
  movePinTo: (componentId: string, pinIndex: number, point: Point) => boolean
  moveWireEndTo: (wireId: string, end: 'from' | 'to', point: Point) => boolean
  select: (id: string | null) => void
  deleteSelected: () => void
  rotateSelected: () => void
  updateSelected: (patch: Partial<Pick<BreadboardComponent, 'value' | 'color' | 'label'>>) => void
  setWireColor: (color: string) => void
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

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  document: createEmptyDocument(),
  projectId: null,
  dirty: false,
  selectedId: null,
  activeTool: 'select',
  wireStart: null,
  wireColor: '#e4523d',
  past: [],
  future: [],
  readings: {},
  issues: [],
  simulationStatus: 'connecting',
  running: true,

  setActiveTool: (activeTool) => set({ activeTool, wireStart: activeTool === 'wire' ? get().wireStart : null }),

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
      ...defaults[kind],
    }
    set({
      ...withDocument(state, (document) => document.components.push(component)),
      selectedId: component.id,
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
      set({ wireStart: hole.id })
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
      selectedId: wire.id,
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
    const pins = defaultPlacement(component.kind, anchor, occupied)
    if (!pins) return false
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
    const occupied = occupiedHoles(state.document, componentId)
    component.pins.forEach((pin, index) => { if (index !== pinIndex) occupied.add(pin) })
    const hole = nearestHole(point, 24, occupied)
    if (!hole) return false
    const otherNodes = component.pins
      .filter((_, index) => index !== pinIndex)
      .map((pin) => holeById.get(pin)?.nodeId)
    if (otherNodes.includes(hole.nodeId)) return false
    set(withDocument(state, (document) => {
      const target = document.components.find((item) => item.id === componentId)
      if (target) target.pins[pinIndex] = hole.id
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

  select: (selectedId) => set({ selectedId }),

  deleteSelected: () => {
    const state = get()
    if (!state.selectedId) return
    set({
      ...withDocument(state, (document) => {
        document.components = document.components.filter((item) => item.id !== state.selectedId)
        document.wires = document.wires.filter((item) => item.id !== state.selectedId)
      }),
      selectedId: null,
    })
  },

  rotateSelected: () => {
    const state = get()
    const component = state.document.components.find((item) => item.id === state.selectedId)
    if (!component) return
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
    set(withDocument(state, (document) => {
      const target = document.components.find((item) => item.id === state.selectedId)
      if (target) Object.assign(target, patch)
    }))
  },

  setWireColor: (wireColor) => set({ wireColor }),
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
      selectedId: null,
      issues: validateDocument(previous),
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
      selectedId: null,
      issues: validateDocument(next),
    })
  },

  newProject: () => set({
    document: createEmptyDocument(), projectId: null, dirty: false, selectedId: null,
    past: [], future: [], issues: [], readings: {}, wireStart: null,
  }),

  loadProject: (projectId, value) => {
    const document = parseDocument(value)
    set({
      document, projectId, dirty: false, selectedId: null, past: [], future: [],
      issues: validateDocument(document), readings: {}, wireStart: null,
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
