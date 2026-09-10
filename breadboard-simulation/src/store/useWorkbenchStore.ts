import { endpointKey, nearestSensorEndpoint, sensorEndpointUsed, sensorOutsideBoard, endpointPoint, type SensorKind, type WireEndpoint, type SensorWire, type ExternalSensor } from '@/domain/sensors'
import { create } from 'zustand'
import { halfTurnPins, defaultPlacement, holeById, isLegacyCd4017Footprint, isRigidModule, isTwoPinComponent, isValidButtonPinPair, legacyCd4017PlacementFromLowerPin, nearestHole, rigidModulePlacementFromLowerPin } from '@/domain/board'
import { compactCd4017Footprints, createEmptyDocument, parseDocument } from '@/domain/document'
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
  resistor: { value: 500, label: '500 Ω', bandCount: 4 },
  buzzer: { value: 1, label: '无源压电蜂鸣器' },
  capacitor: { value: 100e-9, label: '100 nF', variant: 'ceramic' },
  led: { value: 0.01, color: '#ef3d32', label: '红色 LED' },
  diode: { value: 1, label: '1N4148', variant: 'small-signal' },
  switch: { value: 1, label: '保持型开关' },
  button: { value: 1, label: '瞬时按键' },
  npn: { value: 100, label: '2N3904' },
  pnp: { value: 100, label: '2N3906' },
  'seven-segment': { value: 0.01, color: '#ef3d32', label: 'SC56-11EWA', variant: 'common-cathode' },
  cd4017: { value: 1, label: 'CD4017' },
  cd4026: { value: 1, label: 'CD4026' },
  'esp32-s3': { value: 1, label: 'ESP32-S3-WROOM-1-N16R8' },
}

interface WorkbenchState {
  document: BreadboardDocument
  projectId: number | null
  dirty: boolean
  selectedIds: string[]
  activeTool: ToolKind
  activeSensor: SensorKind | null
  sensorRotation: ExternalSensor['rotation']
  connectionStart: WireEndpoint | null
  chooseSensor: (kind: SensorKind) => void
  placeSensorAt: (kind: SensorKind, point: Point) => boolean
  rotateSensorPlacement: () => void
  moveSensorTo: (id: string, point: Point) => boolean
  updateSensorWire: (id: string, patch: Partial<Pick<SensorWire, 'color' | 'waypoints'>>) => void
  reconnectSensorWire: (id: string, end: 'from' | 'to', point: Point) => boolean
  wireStart: string | null
  componentStart: string | null
  placementRotation: 0 | 180
  rotatePlacement: () => void
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
  compactCd4017Footprints(next)
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
  for (const wire of document.sensorWires ?? []) if (!ignoredIds.has(wire.id)) {
    for (const endpoint of [wire.from, wire.to]) occupied.add(endpointKey(endpoint))
  }
  return occupied
}

function connectionAt(document: BreadboardDocument, point: Point): WireEndpoint | undefined {
  const sensor = nearestSensorEndpoint(document, point)
  if (sensor) return sensor
  const hole = nearestHole(point, 12)
  return hole ? { type: 'hole', holeId: hole.id } : undefined
}
function availableEndpoint(document: BreadboardDocument, endpoint: WireEndpoint, ignoreId?: string): boolean {
  return !!endpointPoint(document, endpoint) && !occupiedHoles(document, ignoreId).has(endpointKey(endpoint)) && !sensorEndpointUsed(document, endpoint, ignoreId)
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  document: createEmptyDocument(),
  projectId: null,
  dirty: false,
  selectedIds: [],
  activeTool: 'select',
  activeSensor: null,
  sensorRotation: 0,
  connectionStart: null,
  wireStart: null,
  componentStart: null,
  placementRotation: 0,
  rotatePlacement: () => set((state) => ({ placementRotation: state.placementRotation === 0 ? 180 : 0 })),
  wireColor: '#f28c28',
  placementOptions: structuredClone(defaults),
  past: [],
  future: [],
  readings: {},
  closedContacts: {},
  issues: [],
  simulationStatus: 'connecting',
  running: true,

  chooseSensor: (activeSensor) => set({ activeSensor, sensorRotation: 0, activeTool: 'select', selectedIds: [], wireStart: null, connectionStart: null, componentStart: null }),
  rotateSensorPlacement: () => set(state => ({ sensorRotation: ((state.sensorRotation + 90) % 360) as ExternalSensor['rotation'] })),
  placeSensorAt: (kind, position) => {
    const state = get()
    const sensor: ExternalSensor = { id: id(kind), kind, position, rotation: state.sensorRotation }
    if (!sensorOutsideBoard(sensor)) return false
    set({ ...withDocument(state, document => { (document.sensors ??= []).push(sensor) }), selectedIds: [sensor.id], activeSensor: null, activeTool: 'select' })
    return true
  },
  moveSensorTo: (sensorId, position) => {
    const state = get(), sensor = state.document.sensors?.find(s => s.id === sensorId)
    if (!sensor || !sensorOutsideBoard({ ...sensor, position })) return false
    set(withDocument(state, document => { document.sensors!.find(s => s.id === sensorId)!.position = position }))
    return true
  },
  updateSensorWire: (wireId, patch) => {
    const state = get()
    if (!state.document.sensorWires?.some(w => w.id === wireId)) return
    set(withDocument(state, document => { Object.assign(document.sensorWires!.find(w => w.id === wireId)!, patch) }))
  },
  reconnectSensorWire: (wireId, end, point) => {
    const state = get(), wire = state.document.sensorWires?.find(w => w.id === wireId), endpoint = connectionAt(state.document, point)
    if (!wire || !endpoint || !availableEndpoint(state.document, endpoint, wireId)) return false
    const other = wire[end === 'from' ? 'to' : 'from']
    if (endpointKey(endpoint) === endpointKey(other) || (endpoint.type === 'hole' && other.type === 'hole')) return false
    set(withDocument(state, document => { const target = document.sensorWires!.find(w => w.id === wireId)!; target[end] = endpoint; delete target.waypoints }))
    return true
  },

  setActiveTool: (activeTool) => set((state) => ({
    activeTool,
    activeSensor: null,
    connectionStart: activeTool === 'wire' ? state.connectionStart : null,
    placementRotation: activeTool === state.activeTool ? state.placementRotation : 0,
    selectedIds: activeTool === 'select' || activeTool === 'pan' ? state.selectedIds : [],
    wireStart: activeTool === 'wire' ? state.wireStart : null,
    componentStart: activeTool === state.activeTool && activeTool !== 'select'
      ? state.componentStart
      : null,
  })),

  placeAt: (kind, point) => {
    const state = get()
    const occupied = occupiedHoles(state.document)
    const anchor = nearestHole(point, 20, isRigidModule(kind) ? new Set() : occupied)
    if (!anchor) return false
    const footprint = defaultPlacement(kind, anchor, occupied)
    const pins = footprint && isRigidModule(kind) && state.placementRotation === 180 ? halfTurnPins(footprint) : footprint
    if (!pins) return false
    const component: BreadboardComponent = {
      id: id(kind),
      kind,
      pins,
      rotation: isRigidModule(kind) ? state.placementRotation : 0,
      ...state.placementOptions[kind],
    }
    set({
      ...withDocument(state, (document) => document.components.push(component)),
      selectedIds: [component.id],
      activeTool: 'select',
      wireStart: null,
      connectionStart: null,
      activeSensor: null,
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
    const state = get(), endpoint = connectionAt(state.document, point)
    if (!endpoint || !availableEndpoint(state.document, endpoint)) return false
    const from = state.connectionStart ?? (state.wireStart ? { type: 'hole' as const, holeId: state.wireStart } : null)
    if (!from) {
      set({ activeTool: 'wire', activeSensor: null, connectionStart: endpoint, wireStart: endpoint.type === 'hole' ? endpoint.holeId : null, componentStart: null, selectedIds: [] })
      return true
    }
    if (endpointKey(from) === endpointKey(endpoint) || !availableEndpoint(state.document, from)) return false
    if (from.type === 'hole' && endpoint.type === 'hole') {
      if (holeById.get(from.holeId)?.nodeId === holeById.get(endpoint.holeId)?.nodeId) return false
      const wire = { id: id('wire'), from: from.holeId, to: endpoint.holeId, color: state.wireColor }
      set({ ...withDocument(state, document => { document.wires.push(wire) }), connectionStart: null, wireStart: null, selectedIds: [], activeTool: 'wire' })
    } else {
      const wire: SensorWire = { id: id('sensor-wire'), from, to: endpoint, color: state.wireColor }
      set({ ...withDocument(state, document => { (document.sensorWires ??= []).push(wire) }), connectionStart: null, wireStart: null, selectedIds: [], activeTool: 'wire' })
    }
    return true
  },

  moveComponentTo: (componentId, point) => {
    const state = get()
    const component = state.document.components.find((item) => item.id === componentId)
    if (!component) return false
    const occupied = occupiedHoles(state.document, componentId)
    const anchor = nearestHole(point, 24, isRigidModule(component.kind) ? new Set() : occupied)
    if (!anchor) return false
    if (isRigidModule(component.kind)) {
      const pins = component.kind === 'cd4017' && isLegacyCd4017Footprint(component.pins)
        ? legacyCd4017PlacementFromLowerPin(anchor, occupied, component.rotation)
        : rigidModulePlacementFromLowerPin(component.kind, anchor, occupied, component.rotation)
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
    if (isRigidModule(component.kind)) return false
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
      ...(state.document.sensors ?? []).map(s => s.id),
      ...(state.document.sensorWires ?? []).map(w => w.id),
    ])
    const selectedIds = state.selectedIds.includes(anchorId)
      ? state.selectedIds.filter((id) => allIds.has(id))
      : allIds.has(anchorId) ? [anchorId] : []
    if (!selectedIds.length) return false
    const selected = new Set(selectedIds)
    const anchorComponent = state.document.components.find((component) => component.id === anchorId)
    const anchorWire = state.document.wires.find((wire) => wire.id === anchorId)
    const anchorSensor = state.document.sensors?.find(s => s.id === anchorId)
    const boardSelected = state.document.components.some(c => selected.has(c.id)) || state.document.wires.some(w => selected.has(w.id))
    if (anchorSensor && !boardSelected) {
      const delta = { x: point.x - anchorSensor.position.x, y: point.y - anchorSensor.position.y }
      const moved = (state.document.sensors ?? []).filter(s => selected.has(s.id)).map(s => ({ ...s, position: { x: s.position.x + delta.x, y: s.position.y + delta.y } }))
      if (!moved.every(sensorOutsideBoard) || (!delta.x && !delta.y)) return false
      set(withDocument(state, document => { for (const sensor of moved) Object.assign(document.sensors!.find(s => s.id === sensor.id)!, sensor) }))
      return true
    }
    const anchorPin = anchorComponent?.pins[0] ?? anchorWire?.from
    const firstBoardPin = state.document.components.find(c => selected.has(c.id))?.pins[0] ?? state.document.wires.find(w => selected.has(w.id))?.from
    const sourceAnchor = holeById.get(anchorPin ?? firstBoardPin ?? '')
    if (!sourceAnchor) return false
    const desired = anchorSensor ? { x: sourceAnchor.x + point.x - anchorSensor.position.x, y: sourceAnchor.y + point.y - anchorSensor.position.y } : point
    const occupied = occupiedHolesExcept(state.document, selected)
    // A selected external wire does not free its fixed board endpoint during group movement.
    for (const wire of state.document.sensorWires ?? []) for (const e of [wire.from, wire.to]) if (e.type === 'hole') occupied.add(e.holeId)
    const targetAnchor = nearestHole(desired, 24, anchorComponent && isRigidModule(anchorComponent.kind) ? new Set() : occupied)
    if (!targetAnchor || targetAnchor.id === sourceAnchor.id) return false
    if (selectedIds.length === 1 && anchorComponent?.kind === 'esp32-s3') return get().moveComponentTo(anchorId, point)
    const offset = { x: targetAnchor.x - sourceAnchor.x, y: targetAnchor.y - sourceAnchor.y }
    const movedSensors = (state.document.sensors ?? []).filter(s => selected.has(s.id)).map(s => ({ ...s, position: { x: s.position.x + offset.x, y: s.position.y + offset.y } }))
    if (!movedSensors.every(sensorOutsideBoard)) return false
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
      if (isRigidModule(component.kind)) {
        const expected = component.kind === 'cd4017' && isLegacyCd4017Footprint(component.pins)
          ? legacyCd4017PlacementFromLowerPin(resolved[0]!, occupied, component.rotation)
          : rigidModulePlacementFromLowerPin(component.kind, resolved[0]!, occupied, component.rotation)
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
      for (const sensor of movedSensors) Object.assign(document.sensors!.find(s => s.id === sensor.id)!, sensor)
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
      return additive ? state : { selectedIds: [], activeTool: 'select', activeSensor: null, connectionStart: null, wireStart: null, componentStart: null }
    }
    const alreadySelected = state.selectedIds.includes(selectedId)
    const selectedIds = additive
      ? alreadySelected ? state.selectedIds.filter((id) => id !== selectedId) : [...state.selectedIds, selectedId]
      : alreadySelected ? state.selectedIds : [selectedId]
    return { selectedIds, activeTool: 'select', activeSensor: null, connectionStart: null, wireStart: null, componentStart: null }
  }),

  selectMany: (ids, additive = false) => set((state) => {
    const validIds = new Set([
      ...state.document.components.map((component) => component.id),
      ...state.document.wires.map((wire) => wire.id),
      ...(state.document.sensors ?? []).map(s => s.id),
      ...(state.document.sensorWires ?? []).map(w => w.id),
    ])
    const incoming = [...new Set(ids)].filter((id) => validIds.has(id))
    return {
      selectedIds: additive ? [...new Set([...state.selectedIds, ...incoming])] : incoming,
      activeTool: 'select',
      wireStart: null,
      connectionStart: null,
      activeSensor: null,
      componentStart: null,
    }
  }),

  deleteSelected: () => {
    const state = get()
    const selectedIds = new Set(state.selectedIds)
    const hasSelectedObjects = state.document.components.some((item) => selectedIds.has(item.id))
      || state.document.wires.some((item) => selectedIds.has(item.id))
      || (state.document.sensors ?? []).some(s => selectedIds.has(s.id))
      || (state.document.sensorWires ?? []).some(w => selectedIds.has(w.id))
    if (!hasSelectedObjects) return
    const closedContacts = { ...state.closedContacts }
    for (const selectedId of selectedIds) delete closedContacts[selectedId]
    set({
      ...withDocument(state, (document) => {
        document.components = document.components.filter((item) => !selectedIds.has(item.id))
        document.wires = document.wires.filter((item) => !selectedIds.has(item.id))
        document.sensors = document.sensors?.filter(s => !selectedIds.has(s.id))
        document.sensorWires = document.sensorWires?.filter(w => !selectedIds.has(w.id) && ![w.from, w.to].some(e => e.type === 'sensor' && selectedIds.has(e.sensorId)))
      }),
      selectedIds: [],
      closedContacts,
    })
  },

  rotateSelected: () => {
    const state = get()
    if (state.selectedIds.length !== 1) return
    const sensor = state.document.sensors?.find(s => s.id === state.selectedIds[0])
    if (sensor) {
      const rotation = ((sensor.rotation + 90) % 360) as ExternalSensor['rotation']
      if (!sensorOutsideBoard({ ...sensor, rotation })) return
      set(withDocument(state, document => {
        document.sensors!.find(s => s.id === sensor.id)!.rotation = rotation
        for (const wire of document.sensorWires ?? []) if ([wire.from, wire.to].some(e => e.type === 'sensor' && e.sensorId === sensor.id)) delete wire.waypoints
      }))
      return
    }
    const component = state.document.components.find((item) => item.id === state.selectedIds[0])
    if (!component) return
    if (isRigidModule(component.kind)) {
      set(withDocument(state, (document) => {
        const target = document.components.find((item) => item.id === component.id)!
        target.pins = halfTurnPins(target.pins)
        target.rotation = target.rotation === 180 ? 0 : 180
      }))
      return
    }
    if (component.kind === 'button') return
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
      connectionStart: null,
      activeSensor: null,
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
      connectionStart: null,
      activeSensor: null,
      componentStart: null,
      issues: validateDocument(next),
      closedContacts: retainSwitchContacts(state.closedContacts, next),
    })
  },

  newProject: () => set({
    document: createEmptyDocument(), projectId: null, dirty: false, selectedIds: [],
    past: [], future: [], issues: [], readings: {}, closedContacts: {}, wireStart: null, connectionStart: null, activeSensor: null, componentStart: null,
  }),

  loadProject: (projectId, value) => {
    const document = parseDocument(value)
    set({
      document, projectId, dirty: false, selectedIds: [], past: [], future: [],
      issues: validateDocument(document), readings: {}, closedContacts: {}, wireStart: null, connectionStart: null, activeSensor: null, componentStart: null,
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
