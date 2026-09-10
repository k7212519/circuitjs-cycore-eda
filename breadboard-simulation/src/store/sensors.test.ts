import { beforeEach, describe, expect, it } from 'vitest'
import { holeById } from '@/domain/board'
import { sensorPinPoint, type ExternalSensor } from '@/domain/sensors'
import { serializeDocument, parseDocument } from '@/domain/document'
import { useWorkbenchStore } from './useWorkbenchStore'
const state = () => useWorkbenchStore.getState()
const hole = (id = 't-0-0-6') => holeById.get(id)!
const place = (kind: ExternalSensor['kind'] = 'dht11', x = 220, y = -180) => {
  expect(state().placeSensorAt(kind, { x, y })).toBe(true)
  return state().document.sensors!.at(-1)!
}
const connect = (a: ExternalSensor, pin: number, target = hole()) => {
  state().setActiveTool('wire')
  expect(state().wireAt(sensorPinPoint(a, pin))).toBe(true)
  expect(state().wireAt(target)).toBe(true)
  return state().document.sensorWires!.at(-1)!
}
beforeEach(() => useWorkbenchStore.setState(useWorkbenchStore.getInitialState(), true))
describe('external module editing', () => {
  it('places outside only, rotates, cancels and records one move per undo', () => {
    expect(state().placeSensorAt('dht11', { x: 200, y: 200 })).toBe(false)
    const sensor = place()
    state().rotateSelected()
    expect(state().document.sensors![0]!.rotation).toBe(90)
    expect(state().moveSensorTo(sensor.id, { x: 200, y: 200 })).toBe(false)
    expect(state().moveSensorTo(sensor.id, { x: 300, y: -190 })).toBe(true)
    state().undo()
    expect(state().document.sensors![0]!.position).toEqual(sensor.position)
    state().chooseSensor('relay'); state().rotateSensorPlacement(); state().setActiveTool('select')
    expect(state().activeSensor).toBeNull()
  })
  it('connects in either direction and rejects occupied holes and pins through all move paths', () => {
    const sensor = place(), wire = connect(sensor, 0)
    state().setActiveTool('select')
    state().placeAt('resistor', hole())
    expect(state().document.components.every(c => !c.pins.includes(hole().id))).toBe(true)
    state().setActiveTool('wire')
    expect(state().wireAt(sensorPinPoint(sensor, 0))).toBe(false)
    expect(state().wireAt(hole())).toBe(false)
    expect(state().wireAt(hole('t-0-0-9'))).toBe(true)
    expect(state().wireAt(sensorPinPoint(sensor, 1))).toBe(true)
    expect(state().document.sensorWires).toHaveLength(2)
    expect(state().reconnectSensorWire(wire.id, 'to', hole('t-0-0-9'))).toBe(false)
    expect(state().reconnectSensorWire(wire.id, 'to', hole('t-0-0-20'))).toBe(true)
    state().select(wire.id); state().deleteSelected()
    expect(state().wireAt(hole('t-0-0-20'))).toBe(true)
  })
  it('connects modules, follows moves, preserves bends and cascades delete/undo', () => {
    const a = place('relay'), b = place('motor', 520)
    const wire = connect(a, 4, sensorPinPoint(b, 0) as ReturnType<typeof hole>)
    expect(wire.to).toEqual({ type: 'sensor', sensorId: b.id, pin: 0 })
    state().updateSensorWire(wire.id, { waypoints: [{ x: 400, y: -300 }], color: '#123456' })
    state().select(a.id)
    expect(state().moveSelectionTo(a.id, { x: 260, y: -210 })).toBe(true)
    expect(state().document.sensorWires![0]!.waypoints).toEqual([{ x: 400, y: -300 }])
    const saved = parseDocument(JSON.parse(serializeDocument(state().document)))
    expect(saved).toEqual(state().document)
    state().rotateSelected()
    expect(state().document.sensorWires![0]!.waypoints).toBeUndefined()
    state().deleteSelected()
    expect(state().document.sensors).toHaveLength(1)
    expect(state().document.sensorWires).toHaveLength(0)
    state().undo()
    expect(state().document.sensors).toHaveLength(2)
    expect(state().document.sensorWires).toHaveLength(1)
  })
  it('moves mixed selections by board pitch and never frees a fixed external wire hole', () => {
    const a = place()
    const wire = connect(a, 0)
    state().setActiveTool('select')
    expect(state().placeAt('resistor', hole('t-1-1-15'))).toBe(true)
    const resistor = state().document.components[0]!
    state().selectMany([a.id, resistor.id, wire.id])
    expect(state().moveSelectionTo(a.id, { x: a.position.x + 18, y: a.position.y })).toBe(true)
    expect(state().document.components[0]!.pins[0]).toBe('t-1-1-16')
    expect(state().document.sensors![0]!.position.x).toBe(a.position.x + 18)
    expect(state().document.sensorWires![0]!.to).toEqual(wire.to)
    state().select(resistor.id); state().selectMany([resistor.id])
    state().moveSelectionTo(resistor.id, hole())
    expect(state().document.components[0]!.pins).not.toContain(hole().id)
  })
  it('rotates with terminal clearance and cancels pending wires on undo and project changes', () => {
    const a = place('hc-sr04', 300, -68)
    state().rotateSelected()
    expect(state().document.sensors![0]!.rotation).toBe(0)
    state().setActiveTool('wire'); state().wireAt(sensorPinPoint(a, 0)); state().undo()
    expect(state().connectionStart).toBeNull()
    state().newProject()
    expect(state().activeSensor).toBeNull()
  })
})
