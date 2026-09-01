import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import {
  BOARD_HEIGHT, BOARD_WIDTH, HOLE_PITCH, HOLE_RADIUS, holeById, holes, isTwoPinComponent,
} from '@/domain/board'
import type { BreadboardComponent, ComponentKind, Point, TwoPinComponentKind } from '@/domain/types'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

const terminalHoles = holes.filter((hole) => hole.region === 'terminal')
const railHoles = holes.filter((hole) => hole.region === 'rail')
const boardInset = 8
const boardJoinY = BOARD_HEIGHT / 2
const terminalMinX = Math.min(...terminalHoles.map((hole) => hole.x))
const terminalMaxX = Math.max(...terminalHoles.map((hole) => hole.x))
const terminalZoneMinYs = Array.from({ length: 4 }, (_, zone) => (
  Math.min(...terminalHoles.filter((hole) => hole.zone === zone).map((hole) => hole.y))
))
const terminalZonePadding = 14
const terminalZoneHeight = 4 * HOLE_PITCH + terminalZonePadding * 2
const terminalTrenchCenters = [0, 2].map((upperZone) => {
  const upperEdge = (terminalZoneMinYs[upperZone] ?? 0) + terminalZoneHeight - terminalZonePadding
  const lowerEdge = (terminalZoneMinYs[upperZone + 1] ?? 0) - terminalZonePadding
  return (upperEdge + lowerEdge) / 2
})
const boardFill = '#e8e8df'
const terminalTrenchFill = '#aeb4ae'
const terminalTrenchHalfHeight = 7
const railLineStart = Math.min(...railHoles.map((hole) => hole.x))
const railLineEnd = Math.max(...railHoles.map((hole) => hole.x))
const railLineOffset = 14
const railLineOverhang = 12
const railPolarityFontSize = 28
const railPolarityLabelOffset = 17
const railPolarityLabelWidth = 24
const railRowY = (side: 'top' | 'bottom', polarity: 'positive' | 'negative') => (
  railHoles.find((hole) => hole.side === side && hole.polarity === polarity)?.y ?? 0
)
const railRows = {
  topPositive: railRowY('top', 'positive'),
  topNegative: railRowY('top', 'negative'),
  bottomPositive: railRowY('bottom', 'positive'),
  bottomNegative: railRowY('bottom', 'negative'),
}

function componentName(kind: ComponentKind): string {
  return ({ resistor: 'R', capacitor: 'C', led: 'LED', diode: 'D', npn: 'NPN', pnp: 'PNP' })[kind]
}

const twoPinCoreWidth: Record<TwoPinComponentKind, number> = {
  resistor: 46,
  capacitor: 12,
  led: 20,
  diode: 34,
}

interface TwoPinFrame {
  angle: number
  length: number
  mid: Point
  leadEdge: number
}

function twoPinFrame(points: Point[], kind: TwoPinComponentKind): TwoPinFrame | null {
  const [a, b] = points
  if (!a || !b) return null
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  return {
    angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
    length,
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    leadEdge: Math.min(length / 2, twoPinCoreWidth[kind] / 2),
  }
}

function PinLeads({ length, leadEdge }: Pick<TwoPinFrame, 'length' | 'leadEdge'>) {
  const half = length / 2
  return (
    <>
      <Line points={[-half, 0, -leadEdge, 0]} stroke="#a99f96" strokeWidth={2.5} lineCap="round" />
      <Line points={[leadEdge, 0, half, 0]} stroke="#a99f96" strokeWidth={2.5} lineCap="round" />
    </>
  )
}

function ResistorBody({ points, selected }: { points: Point[]; selected: boolean }) {
  const frame = twoPinFrame(points, 'resistor')
  if (!frame) return null
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <PinLeads length={frame.length} leadEdge={frame.leadEdge} />
      <Rect x={-twoPinCoreWidth.resistor / 2} y={-8} width={twoPinCoreWidth.resistor} height={16} cornerRadius={7} fill="#e1c49d" stroke={selected ? '#f5b83b' : '#8a6d4d'} strokeWidth={selected ? 2 : 1} shadowColor="#000" shadowBlur={5} shadowOpacity={0.3} shadowOffsetY={2} />
      {[[-13, '#7e4e25'], [-5, '#111b18'], [4, '#d33d32'], [14, '#d2a72e']].map(([x, color]) => (
        <Rect key={String(x)} x={Number(x)} y={-7} width={3} height={14} fill={String(color)} />
      ))}
    </Group>
  )
}

function CapacitorBody({ points, selected }: { points: Point[]; selected: boolean }) {
  const frame = twoPinFrame(points, 'capacitor')
  if (!frame) return null
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <PinLeads length={frame.length} leadEdge={frame.leadEdge} />
      <Line points={[-5, -11, -5, 11]} stroke={selected ? '#f5b83b' : '#d9e2dd'} strokeWidth={3.2} />
      <Line points={[5, -11, 5, 11]} stroke={selected ? '#f5b83b' : '#d9e2dd'} strokeWidth={3.2} />
    </Group>
  )
}

function DiodeBody({ points, selected, led, color, current }: { points: Point[]; selected: boolean; led: boolean; color?: string; current: number }) {
  const kind = led ? 'led' : 'diode'
  const frame = twoPinFrame(points, kind)
  if (!frame) return null
  const glow = led ? Math.min(18, Math.max(0, Math.abs(current) * 4500)) : 0
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <PinLeads length={frame.length} leadEdge={frame.leadEdge} />
      {led ? (
        <Circle radius={10} fill={color ?? '#ef3d32'} opacity={current > 0.0002 ? 1 : 0.45} stroke={selected ? '#f5b83b' : '#72251f'} strokeWidth={selected ? 2 : 1} shadowColor={color ?? '#ef3d32'} shadowBlur={glow} shadowOpacity={glow ? 0.95 : 0} />
      ) : (
        <Rect x={-17} y={-6} width={34} height={12} cornerRadius={5} fill="#d45738" stroke={selected ? '#f5b83b' : '#633126'} strokeWidth={selected ? 2 : 1}>
        </Rect>
      )}
      <Rect x={led ? 7 : 8} y={led ? -8 : -6} width={3} height={led ? 16 : 12} fill="#d9dedb" />
    </Group>
  )
}

function TwoPinBody({ kind, points, selected }: { kind: TwoPinComponentKind; points: Point[]; selected: boolean }) {
  if (kind === 'resistor') return <ResistorBody points={points} selected={selected} />
  if (kind === 'capacitor') return <CapacitorBody points={points} selected={selected} />
  if (kind === 'diode') return <DiodeBody points={points} selected={selected} led={false} current={0} />
  return <DiodeBody points={points} selected={selected} led color="#ef3d32" current={0} />
}

function TransistorBody({ points, selected, kind }: { points: Point[]; selected: boolean; kind: 'npn' | 'pnp' }) {
  if (points.length < 3) return null
  const center = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
  return (
    <Group>
      {points.map((point, index) => <Line key={index} points={[point.x, point.y, center.x, center.y]} stroke="#b8aba0" strokeWidth={2.2} />)}
      <Rect x={center.x - 17} y={center.y - 12} width={34} height={24} cornerRadius={[12, 12, 4, 4]} fill="#202723" stroke={selected ? '#f5b83b' : '#66736d'} strokeWidth={selected ? 2 : 1} shadowColor="#000" shadowBlur={6} shadowOpacity={0.35} />
      <Text x={center.x - 12} y={center.y - 5} width={24} align="center" text={kind.toUpperCase()} fontSize={7} fontFamily="monospace" fill="#d8e0dc" />
    </Group>
  )
}

function ComponentShape({ component }: { component: BreadboardComponent }) {
  const selectedId = useWorkbenchStore((state) => state.selectedId)
  const select = useWorkbenchStore((state) => state.select)
  const moveComponentTo = useWorkbenchStore((state) => state.moveComponentTo)
  const movePinTo = useWorkbenchStore((state) => state.movePinTo)
  const reading = useWorkbenchStore((state) => state.readings[component.id])
  const points = component.pins.map((pin) => holeById.get(pin)).filter((hole): hole is NonNullable<typeof hole> => Boolean(hole))
  const selected = selectedId === component.id
  const first = points[0]
  if (!first) return null

  const finishMove = (event: KonvaEventObject<DragEvent>) => {
    const delta = event.target.position()
    moveComponentTo(component.id, { x: first.x + delta.x, y: first.y + delta.y })
    event.target.position({ x: 0, y: 0 })
  }

  return (
    <Group
      draggable
      onClick={(event) => { event.cancelBubble = true; select(component.id) }}
      onTap={(event) => { event.cancelBubble = true; select(component.id) }}
      onDragEnd={finishMove}
      name={`component-${component.id}`}
    >
      {component.kind === 'resistor' ? <ResistorBody points={points} selected={selected} /> : null}
      {component.kind === 'capacitor' ? <CapacitorBody points={points} selected={selected} /> : null}
      {component.kind === 'diode' ? <DiodeBody points={points} selected={selected} led={false} current={reading?.current ?? 0} /> : null}
      {component.kind === 'led' ? <DiodeBody points={points} selected={selected} led color={component.color} current={reading?.current ?? 0} /> : null}
      {component.kind === 'npn' || component.kind === 'pnp' ? <TransistorBody points={points} selected={selected} kind={component.kind} /> : null}
      {selected ? points.map((point, index) => (
        <Circle
          key={component.pins[index]}
          x={point.x}
          y={point.y}
          radius={7}
          fill="#f5b83b"
          stroke="#171a18"
          strokeWidth={2}
          draggable
          onDragStart={(event) => { event.cancelBubble = true }}
          onDragEnd={(event) => {
            event.cancelBubble = true
            movePinTo(component.id, index, { x: event.target.x(), y: event.target.y() })
          }}
        />
      )) : null}
    </Group>
  )
}

export function BreadboardCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [pointer, setPointer] = useState<Point | null>(null)
  const [panning, setPanning] = useState(false)
  const panRef = useRef<Point | null>(null)
  const placementDragRef = useRef<{ tool: ComponentKind | 'wire'; screen: Point } | null>(null)
  const pinchRef = useRef<{ distance: number; center: Point } | null>(null)

  const document = useWorkbenchStore((state) => state.document)
  const activeTool = useWorkbenchStore((state) => state.activeTool)
  const wireStart = useWorkbenchStore((state) => state.wireStart)
  const componentStart = useWorkbenchStore((state) => state.componentStart)
  const selectedId = useWorkbenchStore((state) => state.selectedId)
  const setViewport = useWorkbenchStore((state) => state.setViewport)
  const setActiveTool = useWorkbenchStore((state) => state.setActiveTool)
  const placeAt = useWorkbenchStore((state) => state.placeAt)
  const componentAt = useWorkbenchStore((state) => state.componentAt)
  const wireAt = useWorkbenchStore((state) => state.wireAt)
  const select = useWorkbenchStore((state) => state.select)
  const moveWireEndTo = useWorkbenchStore((state) => state.moveWireEndTo)

  const viewport = document.viewport
  const pendingHoleId = activeTool === 'wire' ? wireStart : componentStart
  const pendingStart = pendingHoleId ? holeById.get(pendingHoleId) : undefined

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return
    if (viewport.x !== 0 || viewport.y !== 0 || viewport.scale !== 1) return
    const scale = Math.min(1, (size.width - 32) / BOARD_WIDTH, (size.height - 48) / BOARD_HEIGHT)
    if (!Number.isFinite(scale) || scale <= 0) return
    setViewport({
      scale,
      x: (size.width - BOARD_WIDTH * scale) / 2,
      y: (size.height - BOARD_HEIGHT * scale) / 2,
    })
  }, [setViewport, size.height, size.width, viewport.scale, viewport.x, viewport.y])

  const toWorld = (screen: Point): Point => ({
    x: (screen.x - viewport.x) / viewport.scale,
    y: (screen.y - viewport.y) / viewport.scale,
  })

  const pointerWorld = (): Point | null => {
    const position = stageRef.current?.getPointerPosition()
    return position ? toWorld(position) : null
  }

  const handleCanvasAction = (event: KonvaEventObject<PointerEvent>) => {
    if (event.evt.button === 1) {
      event.evt.preventDefault()
      panRef.current = stageRef.current?.getPointerPosition() ?? null
      setPanning(Boolean(panRef.current))
      return
    }
    if (event.evt.button !== 0) return
    const screen = stageRef.current?.getPointerPosition()
    const world = pointerWorld()
    if (!world || !screen) return
    if (activeTool === 'wire') {
      const beginsGesture = !wireStart
      if (wireAt(world) && beginsGesture) placementDragRef.current = { tool: 'wire', screen }
    } else if (activeTool !== 'select' && isTwoPinComponent(activeTool)) {
      const beginsGesture = !componentStart
      if (componentAt(activeTool, world) && beginsGesture) placementDragRef.current = { tool: activeTool, screen }
    } else if (activeTool !== 'select') placeAt(activeTool, world)
    else select(null)
  }

  const handlePointerMove = () => {
    const screen = stageRef.current?.getPointerPosition()
    if (!screen) return
    setPointer(toWorld(screen))
    if (panRef.current) {
      const dx = screen.x - panRef.current.x
      const dy = screen.y - panRef.current.y
      panRef.current = screen
      const current = useWorkbenchStore.getState().document.viewport
      setViewport({ ...current, x: current.x + dx, y: current.y + dy })
    }
  }

  const finishPointerAction = () => {
    const gesture = placementDragRef.current
    placementDragRef.current = null
    const screen = stageRef.current?.getPointerPosition()
    if (gesture && screen && Math.hypot(screen.x - gesture.screen.x, screen.y - gesture.screen.y) >= 6) {
      const world = toWorld(screen)
      if (gesture.tool === 'wire') wireAt(world)
      else componentAt(gesture.tool, world)
    }
    panRef.current = null
    setPanning(false)
  }

  const cancelPointerAction = () => {
    placementDragRef.current = null
    panRef.current = null
    setPanning(false)
  }

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const screen = stageRef.current?.getPointerPosition()
    if (!screen) return
    const world = toWorld(screen)
    const factor = event.evt.deltaY > 0 ? 0.9 : 1.1
    const scale = Math.min(3.5, Math.max(0.25, viewport.scale * factor))
    setViewport({ x: screen.x - world.x * scale, y: screen.y - world.y * scale, scale })
  }

  const handleTouchMove = (event: KonvaEventObject<TouchEvent>) => {
    const touches = event.evt.touches
    if (touches.length !== 2) return
    event.evt.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    const a = touches[0]
    const b = touches[1]
    if (!rect || !a || !b) return
    const center = { x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top }
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const previous = pinchRef.current
    if (previous) {
      const world = toWorld(previous.center)
      const scale = Math.min(3.5, Math.max(0.25, viewport.scale * distance / previous.distance))
      setViewport({ x: center.x - world.x * scale, y: center.y - world.y * scale, scale })
    }
    pinchRef.current = { distance, center }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const kind = event.dataTransfer.getData('application/x-breadboard-component') as ComponentKind
    if (!kind || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const point = toWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    if (isTwoPinComponent(kind)) componentAt(kind, point)
    else placeAt(kind, point)
  }

  const columnLabels = useMemo(() => Array.from({ length: 63 }, (_, index) => index).filter((index) => index === 0 || (index + 1) % 5 === 0), [])

  return (
    <main
      ref={containerRef}
      className={`canvas-shell tool-${activeTool} ${panning ? 'is-panning' : ''}`}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
      data-testid="breadboard-canvas"
      data-board-interaction="wheel-zoom,middle-pan"
      data-board-transform={`${viewport.x.toFixed(3)},${viewport.y.toFixed(3)},${viewport.scale.toFixed(5)}`}
    >
      <div className="canvas-coordinate">X {Math.round(pointer?.x ?? 0).toString().padStart(4, '0')} / Y {Math.round(pointer?.y ?? 0).toString().padStart(4, '0')}</div>
      <div className="canvas-tag">BOARD / DUAL-830 MOD</div>
      {size.width > 0 && size.height > 0 ? (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onPointerDown={handleCanvasAction}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerAction}
          onPointerLeave={cancelPointerAction}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => { pinchRef.current = null }}
        >
        <Layer>
          <Group x={viewport.x} y={viewport.y} scaleX={viewport.scale} scaleY={viewport.scale}>
            <Rect x={boardInset} y={boardInset} width={BOARD_WIDTH - boardInset * 2} height={BOARD_HEIGHT - boardInset * 2} cornerRadius={12} fill={boardFill} stroke="#7f8981" strokeWidth={2} shadowColor="#000" shadowBlur={28} shadowOpacity={0.45} shadowOffsetY={12} />

            {[0, 1, 2, 3].map((zone) => {
              const minY = terminalZoneMinYs[zone] ?? 0
              return (
                <Rect
                  key={zone}
                  x={terminalMinX - terminalZonePadding}
                  y={minY - terminalZonePadding}
                  width={terminalMaxX - terminalMinX + terminalZonePadding * 2}
                  height={terminalZoneHeight}
                  cornerRadius={8}
                  fill={zone % 2 ? '#dedfd8' : '#e4e5de'}
                  stroke="#b9beb7"
                />
              )
            })}

            {terminalTrenchCenters.map((centerY, index) => (
              <Rect
                key={`terminal-trench-${index}`}
                x={boardInset + 1}
                y={centerY - terminalTrenchHalfHeight}
                width={BOARD_WIDTH - (boardInset + 1) * 2}
                height={terminalTrenchHalfHeight * 2}
                fill={terminalTrenchFill}
                listening={false}
              />
            ))}

            <Line
              points={[boardInset, boardJoinY, BOARD_WIDTH - boardInset, boardJoinY]}
              stroke="#899189"
              strokeWidth={2}
              opacity={0.9}
              shadowColor="#5f675f"
              shadowBlur={2}
              shadowOpacity={0.45}
              listening={false}
            />
            <Line
              points={[boardInset, boardJoinY + 2, BOARD_WIDTH - boardInset, boardJoinY + 2]}
              stroke="#f6f6ee"
              strokeWidth={1}
              opacity={0.72}
              listening={false}
            />

            <Line points={[railLineStart - railLineOverhang, railRows.topNegative - railLineOffset, railLineEnd + railLineOverhang, railRows.topNegative - railLineOffset]} stroke="#315fae" strokeWidth={4} lineCap="round" />
            <Line points={[railLineStart - railLineOverhang, railRows.topPositive + railLineOffset, railLineEnd + railLineOverhang, railRows.topPositive + railLineOffset]} stroke="#dd3d37" strokeWidth={4} lineCap="round" />
            <Line points={[railLineStart - railLineOverhang, railRows.bottomNegative - railLineOffset, railLineEnd + railLineOverhang, railRows.bottomNegative - railLineOffset]} stroke="#315fae" strokeWidth={4} lineCap="round" />
            <Line points={[railLineStart - railLineOverhang, railRows.bottomPositive + railLineOffset, railLineEnd + railLineOverhang, railRows.bottomPositive + railLineOffset]} stroke="#dd3d37" strokeWidth={4} lineCap="round" />
            {[
              { x: railLineStart - 50, align: 'right' as const },
              { x: railLineEnd + 26, align: 'left' as const },
            ].map((edge) => (
              <Group key={edge.align} listening={false}>
                <Text x={edge.x} y={railRows.topPositive - railPolarityLabelOffset} width={railPolarityLabelWidth} align={edge.align} text="+" fontFamily="monospace" fontStyle="bold" fontSize={railPolarityFontSize} fill="#c52d2a" />
                <Text x={edge.x} y={railRows.topNegative - railPolarityLabelOffset} width={railPolarityLabelWidth} align={edge.align} text="-" fontFamily="monospace" fontStyle="bold" fontSize={railPolarityFontSize} fill="#28569e" />
                <Text x={edge.x} y={railRows.bottomPositive - railPolarityLabelOffset} width={railPolarityLabelWidth} align={edge.align} text="+" fontFamily="monospace" fontStyle="bold" fontSize={railPolarityFontSize} fill="#c52d2a" />
                <Text x={edge.x} y={railRows.bottomNegative - railPolarityLabelOffset} width={railPolarityLabelWidth} align={edge.align} text="-" fontFamily="monospace" fontStyle="bold" fontSize={railPolarityFontSize} fill="#28569e" />
              </Group>
            ))}

            {columnLabels.map((column) => (
              <Text key={column} x={terminalMinX - 7 + column * HOLE_PITCH} y={(terminalZoneMinYs[0] ?? 0) - 18} width={16} align="center" text={String(column + 1)} fontFamily="monospace" fontSize={7} fill="#7e8881" />
            ))}
            {['A', 'B', 'C', 'D'].map((zone, index) => (
              <Text key={zone} x={8} y={(terminalZoneMinYs[index] ?? 0) + 28} width={12} align="center" text={zone} fontFamily="monospace" fontStyle="bold" fontSize={12} fill="#657069" />
            ))}

            {railHoles.map((hole) => (
              <Group key={hole.id} x={hole.x} y={hole.y} listening={false}>
                <Circle radius={7} fill="#aeb3ac" />
                <Circle radius={HOLE_RADIUS} fill="#252b28" shadowColor="#000" shadowBlur={2} shadowOpacity={0.5} />
              </Group>
            ))}
            {terminalHoles.map((hole) => (
              <Group key={hole.id} x={hole.x} y={hole.y} listening={false}>
                <Circle radius={7} fill="#b4b9b2" />
                <Circle radius={HOLE_RADIUS} fill="#242a27" shadowColor="#000" shadowBlur={2} shadowOpacity={0.45} />
              </Group>
            ))}

            {document.wires.map((wire) => {
              const from = holeById.get(wire.from)
              const to = holeById.get(wire.to)
              if (!from || !to) return null
              const selected = selectedId === wire.id
              const lift = Math.min(35, Math.abs(to.x - from.x) * 0.08 + Math.abs(to.y - from.y) * 0.04)
              const points = [from.x, from.y, (from.x + to.x) / 2, (from.y + to.y) / 2 - lift, to.x, to.y]
              return (
                <Group key={wire.id}>
                  <Line points={points} tension={0.45} stroke="#070b09" strokeWidth={selected ? 8 : 6} opacity={0.36} lineCap="round" />
                  <Line
                    points={points}
                    tension={0.45}
                    stroke={wire.color}
                    strokeWidth={selected ? 5 : 3.5}
                    lineCap="round"
                    shadowColor="#000"
                    shadowBlur={4}
                    shadowOpacity={0.35}
                    hitStrokeWidth={16}
                    onClick={(event) => { event.cancelBubble = true; select(wire.id) }}
                    onTap={(event) => { event.cancelBubble = true; select(wire.id) }}
                  />
                  {selected ? ([['from', from], ['to', to]] as const).map(([end, point]) => (
                    <Circle
                      key={end}
                      x={point.x}
                      y={point.y}
                      radius={7}
                      fill="#f5b83b"
                      stroke="#171a18"
                      strokeWidth={2}
                      draggable
                      onDragStart={(event) => { event.cancelBubble = true }}
                      onDragEnd={(event) => {
                        event.cancelBubble = true
                        moveWireEndTo(wire.id, end, { x: event.target.x(), y: event.target.y() })
                      }}
                    />
                  )) : null}
                </Group>
              )
            })}

            {document.components.map((component) => <ComponentShape key={component.id} component={component} />)}

            {pendingStart && pointer ? (
              activeTool !== 'wire' && activeTool !== 'select' && isTwoPinComponent(activeTool) ? (
                <Group opacity={0.78} listening={false}>
                  <TwoPinBody kind={activeTool} points={[pendingStart, pointer]} selected />
                  <Circle x={pendingStart.x} y={pendingStart.y} radius={7} fill="#f5b83b" stroke="#171a18" strokeWidth={2} />
                </Group>
              ) : (
                <Line points={[pendingStart.x, pendingStart.y, pointer.x, pointer.y]} stroke="#f5b83b" strokeWidth={2} dash={[7, 5]} lineCap="round" listening={false} />
              )
            ) : null}
          </Group>
        </Layer>
        </Stage>
      ) : null}
      {activeTool !== 'select' ? (
        <div className="active-tool-toast">
          <strong>{activeTool === 'wire'
            ? (wireStart ? '拖到导线终点孔' : '选择导线起点孔')
            : isTwoPinComponent(activeTool)
              ? (componentStart ? `拖到 ${componentName(activeTool)} 终点孔` : `选择 ${componentName(activeTool)} 起点孔`)
              : `放置 ${componentName(activeTool)}`}</strong>
          <span>ESC 退出工具</span>
          <button type="button" onClick={() => setActiveTool('select')}>退出</button>
        </div>
      ) : null}
    </main>
  )
}
