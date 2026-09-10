import { useMemo, useState } from 'react'
import { Circle, Group, Path, Rect, Text } from 'react-konva'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'
import { SENSOR_MODELS, endpointPoint, nearestSensorEndpoint, roundedOrthogonalPath, sensorBounds, sensorOutsideBoard, sensorPinPoint, sensorWireRoutes, wireSegmentHandles, moveWireSegment, type SensorWire } from '@/domain/sensors'
import { nearestHole } from '@/domain/board'
import type { Point } from '@/domain/types'
import { SensorBody } from './SensorBody'

type DragPreview = { leaderId: string; delta: Point } | null
export function SensorLayer({ isDark, pointer, selectionDrag, onSelectionDrag }: { isDark: boolean; pointer: Point | null; selectionDrag: DragPreview; onSelectionDrag: (preview: DragPreview) => void }) {
  const document = useWorkbenchStore(s => s.document)
  const activeTool = useWorkbenchStore(s => s.activeTool)
  const activeSensor = useWorkbenchStore(s => s.activeSensor)
  const rotation = useWorkbenchStore(s => s.sensorRotation)
  const start = useWorkbenchStore(s => s.connectionStart)
  const selectedIds = useWorkbenchStore(s => s.selectedIds)
  const select = useWorkbenchStore(s => s.select)
  const moveSelectionTo = useWorkbenchStore(s => s.moveSelectionTo)
  const updateWire = useWorkbenchStore(s => s.updateSensorWire)
  const reconnect = useWorkbenchStore(s => s.reconnectSensorWire)
  const wireColor = useWorkbenchStore(s => s.wireColor)
  const [laneDrag, setLaneDrag] = useState<{ id: string; points: Point[] } | null>(null)
  const [edit, setEdit] = useState<{ id: string; end?: 'from' | 'to'; point?: Point; handleIndex?: number; waypoints?: Point[] } | null>(null)
  const interactive = activeTool === 'select' && !activeSensor
  const previewDocument = useMemo(() => selectionDrag ? { ...document, sensors: document.sensors?.map(s => selectedIds.includes(s.id) ? { ...s, position: { x: s.position.x + selectionDrag.delta.x, y: s.position.y + selectionDrag.delta.y } } : s) } : document, [document, selectionDrag, selectedIds])
  const previewSensor = activeSensor && pointer ? { id: 'preview', kind: activeSensor, position: pointer, rotation } : null
  const targetSensor = useMemo(() => pointer ? nearestSensorEndpoint(document, pointer) : undefined, [document, pointer])
  const targetHole = useMemo(() => pointer ? nearestHole(pointer, 12) : undefined, [pointer])
  const target = useMemo(() => targetSensor ?? (targetHole ? { type: 'hole' as const, holeId: targetHole.id } : undefined), [targetSensor, targetHole])
  const pending = useMemo<SensorWire | null>(() => start && pointer && (start.type === 'sensor' || target?.type === 'sensor') ? { id: 'pending', from: start, to: target ?? { type: 'hole', holeId: '' }, color: wireColor } : null, [start, pointer, target, wireColor])
  const routedDocument = useMemo(() => ({ ...previewDocument, sensorWires: [
    ...(previewDocument.sensorWires ?? []).map(w => edit?.id === w.id && edit.waypoints ? { ...w, waypoints: edit.waypoints } : w),
    ...(pending ? [pending] : []),
  ] }), [previewDocument, edit, pending])
  const endpointPreview = useMemo(() => edit?.end && edit.point ? { wireId: edit.id, end: edit.end, point: edit.point }
    : pending && pointer && !target ? { wireId: pending.id, end: 'to' as const, point: pointer } : undefined, [edit, pending, pointer, target])
  const routes = useMemo(() => sensorWireRoutes(routedDocument, endpointPreview), [routedDocument, endpointPreview])
  return <>
    {(document.sensorWires ?? []).map(wire => {
      const selected = selectedIds.includes(wire.id)
      const current = edit?.id === wire.id ? edit : null
      const points = routes.get(wire.id) ?? []
      const handlePoints = laneDrag?.id === wire.id ? laneDrag.points : points
      const endPoint = (end: 'from' | 'to') => endpointPoint(previewDocument, wire[end])
      return <Group key={wire.id} id={wire.id} name="selectable" listening={interactive} onPointerDown={e => { if (e.evt.button !== 0) return; e.cancelBubble = true; select(wire.id, e.evt.shiftKey) }}>
        <Group name="selection-bounds"><Path data={roundedOrthogonalPath(points)} stroke="#102325" strokeWidth={selected ? 9 : 7} lineCap="round" lineJoin="round" hitStrokeWidth={14} />
          <Path data={roundedOrthogonalPath(points)} stroke={wire.color} strokeWidth={selected ? 6 : 4.5} lineCap="round" lineJoin="round" hitStrokeWidth={14} />
        </Group>
        {selected && interactive && (['from', 'to'] as const).map(end => {
          const p = current?.end === end && current.point ? current.point : endPoint(end)
          return p ? <Circle key={end} x={p.x} y={p.y} radius={6} fill="#f5b83b" stroke="#233536" strokeWidth={2} draggable
            onDragStart={e => { e.cancelBubble = true }}
            onDragMove={e => { e.cancelBubble = true; setEdit({ id: wire.id, end, point: e.target.position() }) }}
            onDragEnd={e => { e.cancelBubble = true; const moved = reconnect(wire.id, end, e.target.position()); setEdit(null); if (!moved) e.target.position(endPoint(end)!) }} /> : null
        })}
        {selected && interactive && wireSegmentHandles(handlePoints).map(({ index, vertical, center }) => {
          const dragged = (point: Point) => moveWireSegment(handlePoints, index, point)
          const handleCenter = laneDrag?.id === wire.id && current?.handleIndex === index && current.point
            ? vertical ? { x: current.point.x, y: center.y } : { x: center.x, y: current.point.y } : center
          return <Circle key={`lane-${index}`} name="wire-segment-handle" x={handleCenter.x} y={handleCenter.y} radius={4} fill="#f6d78d" stroke="#2e413e" strokeWidth={1} hitStrokeWidth={8} draggable
            onDragStart={e => { e.cancelBubble = true; setLaneDrag({ id: wire.id, points }) }}
            onDragMove={e => { e.cancelBubble = true; const point = vertical ? { x: e.target.x(), y: center.y } : { x: center.x, y: e.target.y() }; e.target.position(point); setEdit({ id: wire.id, handleIndex: index, point, waypoints: dragged(point) }) }}
            onDragEnd={e => { e.cancelBubble = true; updateWire(wire.id, { waypoints: dragged(e.target.position()) }); setLaneDrag(null); setEdit(null) }} />
        })}
      </Group>
    })}
    {(document.sensors ?? []).map(sensor => {
      const selected = selectedIds.includes(sensor.id)
      const delta = selected && selectionDrag?.leaderId !== sensor.id ? selectionDrag?.delta : undefined
      const shown = previewDocument.sensors?.find(s => s.id === sensor.id) ?? sensor
      const bounds = sensorBounds(sensor)
      return <Group key={sensor.id} id={sensor.id} name="selectable" x={sensor.position.x + (delta?.x ?? 0)} y={sensor.position.y + (delta?.y ?? 0)} draggable={interactive} listening={interactive}
        onPointerDown={e => { if (e.evt.button !== 0) return; e.cancelBubble = true; select(sensor.id, e.evt.shiftKey) }}
        onDragStart={e => { e.cancelBubble = true }}
        onDragMove={e => { e.cancelBubble = true; onSelectionDrag({ leaderId: sensor.id, delta: { x: e.target.x() - sensor.position.x, y: e.target.y() - sensor.position.y } }) }}
        onDragEnd={e => { e.cancelBubble = true; const point = e.target.position(); onSelectionDrag(null); if (!moveSelectionTo(sensor.id, point)) e.target.position(sensor.position) }}>
        <Rect name="selection-bounds" x={bounds.x - sensor.position.x} y={bounds.y - sensor.position.y} width={bounds.width} height={bounds.height} fill="rgba(0,0,0,0)" />
        <SensorBody sensor={sensor} selected={selected} invalid={!sensorOutsideBoard(shown)} />
        <Text x={-95} y={bounds.y - sensor.position.y - 23} width={190} align="center" text={SENSOR_MODELS[sensor.kind].name} fontSize={13} fontStyle="bold" fill={isDark ? '#e0e8e2' : '#263b30'} listening={false} />
      </Group>
    })}
    {/* Terminal highlights are above the bodies and do not consume pointer gestures. */}
    {(document.sensors ?? []).flatMap(sensor => SENSOR_MODELS[sensor.kind].pins.map((_, pin) => {
      const shown = previewDocument.sensors?.find(s => s.id === sensor.id) ?? sensor
      const p = sensorPinPoint(shown, pin)
      const hover = targetSensor?.type === 'sensor' && targetSensor.sensorId === sensor.id && targetSensor.pin === pin
      const started = start?.type === 'sensor' && start.sensorId === sensor.id && start.pin === pin
      return <Circle key={`${sensor.id}:${pin}`} x={p.x} y={p.y} radius={hover || started ? 6 : 3.5} fill={hover || started ? '#f5b83b' : '#ead199'} stroke="#4c4636" strokeWidth={1} listening={false} />
    }))}
    {pending && pointer && <Path data={roundedOrthogonalPath(routes.get(pending.id) ?? [])} stroke={wireColor} strokeWidth={4} dash={[7, 5]} listening={false} />}
    {previewSensor && <Group x={previewSensor.position.x} y={previewSensor.position.y} opacity={0.7} listening={false}><SensorBody sensor={previewSensor} selected invalid={!sensorOutsideBoard(previewSensor)} /></Group>}
  </>
}
