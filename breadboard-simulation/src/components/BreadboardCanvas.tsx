import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Group, Layer, Line, Path, Rect, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import {
  BOARD_HEIGHT, BOARD_WIDTH, HOLE_PITCH, HOLE_RADIUS, holeById, holes, isTwoPinComponent,
} from '@/domain/board'
import type {
  BreadboardComponent, ComponentKind, ComponentPlacementOptions, ComponentVariant, Point, ResistorBandCount, TwoPinComponentKind,
} from '@/domain/types'
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
const componentLeadWidth = 4
const wireWidth = 5
const selectedWireWidth = 6.5

function componentName(kind: ComponentKind): string {
  return ({ resistor: 'R', capacitor: 'C', led: 'LED', diode: 'D', npn: 'NPN', pnp: 'PNP' })[kind]
}

const twoPinCoreWidth: Record<TwoPinComponentKind, number> = {
  resistor: 46,
  capacitor: 12,
  led: 20,
  diode: 34,
}
const resistorDigitColors = ['#111b18', '#7e4e25', '#d33d32', '#e17b2d', '#d2a72e', '#4a9b65', '#277fbc', '#71508e', '#8b918d', '#f1eee0']

function resistorBandColors(value: number, bandCount: ResistorBandCount): string[] {
  const digitCount = bandCount === 5 ? 3 : 2
  const safeValue = Math.max(Math.abs(value), 0.01)
  let exponent = Math.floor(Math.log10(safeValue)) - digitCount + 1
  let significant = Math.round(safeValue / 10 ** exponent)
  if (significant >= 10 ** digitCount) {
    significant = Math.round(significant / 10)
    exponent += 1
  }
  const digits = String(significant).padStart(digitCount, '0').slice(0, digitCount)
    .split('').map((digit) => resistorDigitColors[Number(digit)] ?? '#111b18')
  const multiplier = exponent === -2
    ? '#c4c8c4'
    : exponent === -1
      ? '#d2a72e'
      : resistorDigitColors[Math.min(9, Math.max(0, exponent))] ?? '#111b18'
  return [...digits, multiplier, bandCount === 5 ? '#7e4e25' : '#d2a72e']
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
      <Line points={[-half, 0, -leadEdge, 0]} stroke="#a99f96" strokeWidth={componentLeadWidth} lineCap="round" />
      <Line points={[leadEdge, 0, half, 0]} stroke="#a99f96" strokeWidth={componentLeadWidth} lineCap="round" />
    </>
  )
}

function UprightPinLeads({ length, slots, attachY }: { length: number; slots: [number, number]; attachY: number }) {
  const half = length / 2
  return (
    <>
      {[
        { from: -half, to: slots[0] },
        { from: half, to: slots[1] },
      ].map(({ from, to }) => (
        <Group key={from}>
          <Line
            points={[from, 0, to, attachY]}
            stroke="#59625d"
            strokeWidth={componentLeadWidth + 1}
            lineCap="round"
            shadowColor="#000"
            shadowBlur={3}
            shadowOpacity={0.35}
            shadowOffsetY={2}
          />
          <Line points={[from, 0, to, attachY]} stroke="#c8cfca" strokeWidth={2.2} lineCap="round" />
        </Group>
      ))}
    </>
  )
}

function ResistorBody({ points, selected, value = 1000, bandCount = 4 }: { points: Point[]; selected: boolean; value?: number; bandCount?: ResistorBandCount }) {
  const frame = twoPinFrame(points, 'resistor')
  if (!frame) return null
  const bandPositions = bandCount === 5 ? [-15, -9, -3, 5, 14] : [-13, -5, 4, 14]
  const colors = resistorBandColors(value, bandCount)
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <PinLeads length={frame.length} leadEdge={frame.leadEdge} />
      <Rect x={-twoPinCoreWidth.resistor / 2} y={-8} width={twoPinCoreWidth.resistor} height={16} cornerRadius={7} fill="#e1c49d" stroke={selected ? '#f5b83b' : '#8a6d4d'} strokeWidth={selected ? 2 : 1} shadowColor="#000" shadowBlur={5} shadowOpacity={0.3} shadowOffsetY={2} />
      {bandPositions.map((x, index) => (
        <Rect key={x} x={x} y={-7} width={3} height={14} fill={colors[index]} />
      ))}
    </Group>
  )
}

function CapacitorBody({ points, selected, variant = 'ceramic' }: { points: Point[]; selected: boolean; variant?: ComponentVariant }) {
  const frame = twoPinFrame(points, 'capacitor')
  if (!frame) return null
  const edge = selected ? '#f5b83b' : variant === 'electrolytic' ? '#243641' : '#845b20'
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <UprightPinLeads
        length={frame.length}
        slots={variant === 'ceramic' ? [-12, 12] : [-9, 9]}
        attachY={variant === 'ceramic' ? -15 : -16}
      />
      {variant === 'electrolytic' ? (
        <>
          <Rect
            x={-21} y={-66} width={42} height={50} cornerRadius={4}
            fillLinearGradientStartPoint={{ x: -21, y: 0 }}
            fillLinearGradientEndPoint={{ x: 21, y: 0 }}
            fillLinearGradientColorStops={[0, '#293d4a', 0.22, '#56718a', 0.58, '#3f586d', 1, '#243742']}
            stroke={edge} strokeWidth={selected ? 2 : 1}
            shadowColor="#000" shadowBlur={8} shadowOpacity={0.42} shadowOffsetY={4}
          />
          <Rect x={13} y={-63} width={6} height={46} cornerRadius={1} fill="#d5dcdd" opacity={0.88} />
          <Line points={[14, -55, 18, -55]} stroke="#56656a" strokeWidth={1.2} />
          <Line points={[14, -47, 18, -47]} stroke="#56656a" strokeWidth={1.2} />
          <Line points={[14, -39, 18, -39]} stroke="#56656a" strokeWidth={1.2} />
          <Line points={[14, -31, 18, -31]} stroke="#56656a" strokeWidth={1.2} />
          <Line points={[14, -23, 18, -23]} stroke="#56656a" strokeWidth={1.2} />
          <Path data="M -21 -63 C -20 -72 -10 -77 0 -77 C 10 -77 20 -72 21 -63 C 13 -57 -13 -57 -21 -63 Z" fill="#607b91" stroke={edge} strokeWidth={selected ? 2 : 1} />
          <Path data="M -15 -63 C -10 -68 10 -68 15 -63 C 9 -59 -9 -59 -15 -63 Z" fill="#91a4b1" opacity={0.52} />
          <Text x={-18} y={-50} width={27} align="center" text="10µF" fontSize={8.5} fontStyle="bold" fontFamily="monospace" fill="#e8eef0" opacity={0.9} />
          <Text x={-17} y={-35} width={15} align="center" text="+" fontSize={10} fontStyle="bold" fontFamily="monospace" fill="#f3f5f3" />
        </>
      ) : (
        <>
          <Circle
            x={0} y={-29} radius={18}
            fillRadialGradientStartPoint={{ x: -6, y: -7 }}
            fillRadialGradientStartRadius={1}
            fillRadialGradientEndPoint={{ x: 1, y: 1 }}
            fillRadialGradientEndRadius={19}
            fillRadialGradientColorStops={[0, '#ffe384', 0.35, '#efbc3f', 0.78, '#d79a24', 1, '#aa6d16']}
            stroke={edge} strokeWidth={selected ? 2 : 1}
            shadowColor="#000" shadowBlur={6} shadowOpacity={0.38} shadowOffsetY={4}
          />
          <Path data="M -11 -35 Q -6 -42 1 -44" stroke="#fff0af" strokeWidth={1.6} opacity={0.7} lineCap="round" />
          <Text x={-15} y={-33} width={30} align="center" text="104" fontSize={8} fontStyle="bold" fontFamily="monospace" fill="#513413" />
        </>
      )}
    </Group>
  )
}

function LedBody({ points, selected, color, current }: { points: Point[]; selected: boolean; color?: string; current: number }) {
  const frame = twoPinFrame(points, 'led')
  if (!frame) return null
  const lampColor = color ?? '#ef3d32'
  const glow = Math.min(20, Math.max(0, Math.abs(current) * 4500))
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <UprightPinLeads length={frame.length} slots={[-5, 6]} attachY={-16} />
      <Rect x={-14} y={-21} width={28} height={6} cornerRadius={2} fill="#b8c0bc" stroke={selected ? '#f5b83b' : '#555f5a'} strokeWidth={selected ? 2 : 1} shadowColor="#000" shadowBlur={5} shadowOpacity={0.38} shadowOffsetY={3} />
      <Path
        data="M -11 -20 L -11 -37 C -11 -47 -6 -53 0 -53 C 6 -53 11 -47 11 -37 L 11 -20 Z"
        fill={lampColor} opacity={current > 0.0002 ? 0.94 : 0.7}
        stroke={selected ? '#f5b83b' : '#38413d'} strokeWidth={selected ? 2 : 1}
        shadowColor={lampColor} shadowBlur={glow} shadowOpacity={glow ? 0.95 : 0.18}
      />
      <Path data="M -7 -39 C -7 -46 -4 -49 -1 -50" stroke="#fff" strokeWidth={2.2} opacity={0.52} lineCap="round" />
      <Line points={[-4, -21, -4, -31, 3, -31, 3, -21]} stroke="#f4f0d7" strokeWidth={1.2} opacity={0.7} />
      <Line points={[-7, -18, 7, -18]} stroke="#edf2ef" strokeWidth={1} opacity={0.55} />
    </Group>
  )
}

function DiodeBody({ points, selected }: { points: Point[]; selected: boolean }) {
  const frame = twoPinFrame(points, 'diode')
  if (!frame) return null
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <PinLeads length={frame.length} leadEdge={frame.leadEdge} />
      <Rect x={-17} y={-6} width={34} height={12} cornerRadius={5} fill="#d45738" stroke={selected ? '#f5b83b' : '#633126'} strokeWidth={selected ? 2 : 1} shadowColor="#000" shadowBlur={5} shadowOpacity={0.3} />
      <Rect x={8} y={-6} width={3} height={12} fill="#d9dedb" />
    </Group>
  )
}

function TwoPinBody({ kind, points, selected, options }: { kind: TwoPinComponentKind; points: Point[]; selected: boolean; options: ComponentPlacementOptions }) {
  if (kind === 'resistor') return <ResistorBody points={points} selected={selected} value={options.value} bandCount={options.bandCount} />
  if (kind === 'capacitor') return <CapacitorBody points={points} selected={selected} variant={options.variant} />
  if (kind === 'diode') return <DiodeBody points={points} selected={selected} />
  return <LedBody points={points} selected={selected} color={options.color} current={0} />
}

function TransistorBody({ points, selected, kind }: { points: Point[]; selected: boolean; kind: 'npn' | 'pnp' }) {
  if (points.length < 3) return null
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return null
  const center = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
  const radians = Math.atan2(last.y - first.y, last.x - first.x)
  const angle = radians * 180 / Math.PI
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const localPoints = points.map((point) => {
    const dx = point.x - center.x
    const dy = point.y - center.y
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos }
  })
  const leadSlots = [-13, 0, 13]
  const edge = selected ? '#f5b83b' : '#59645e'
  return (
    <Group x={center.x} y={center.y} rotation={angle}>
      {localPoints.map((point, index) => (
        <Group key={index}>
          <Line
            points={[point.x, point.y, leadSlots[index] ?? 0, -20]}
            stroke="#525b56"
            strokeWidth={5}
            lineCap="round"
            shadowColor="#000"
            shadowBlur={3}
            shadowOpacity={0.38}
            shadowOffsetY={2}
          />
          <Line
            points={[point.x, point.y, leadSlots[index] ?? 0, -20]}
            stroke="#c2cac4"
            strokeWidth={2.4}
            lineCap="round"
          />
        </Group>
      ))}

      <Path
        data="M -17 -45 L -17 -49 C -16 -56 -9 -60 0 -60 C 9 -60 16 -56 17 -49 L 17 -45 Z"
        fill="#45514b"
        stroke={edge}
        strokeWidth={selected ? 2 : 1}
        shadowColor="#000"
        shadowBlur={7}
        shadowOpacity={0.4}
        shadowOffsetY={4}
      />
      <Path
        data="M -17 -45 L 17 -45 L 17 -23 Q 17 -19 13 -19 L -13 -19 Q -17 -19 -17 -23 Z"
        fill="#202723"
        stroke={edge}
        strokeWidth={selected ? 2 : 1}
      />
      <Line points={[-13, -22, 13, -22]} stroke="#101512" strokeWidth={1} opacity={0.7} />
      <Text x={-14} y={-34} width={28} align="center" text={kind.toUpperCase()} fontSize={7} fontStyle="bold" fontFamily="monospace" fill="#d8e0dc" />
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
      {component.kind === 'resistor' ? <ResistorBody points={points} selected={selected} value={component.value} bandCount={component.bandCount} /> : null}
      {component.kind === 'capacitor' ? <CapacitorBody points={points} selected={selected} variant={component.variant} /> : null}
      {component.kind === 'diode' ? <DiodeBody points={points} selected={selected} /> : null}
      {component.kind === 'led' ? <LedBody points={points} selected={selected} color={component.color} current={reading?.current ?? 0} /> : null}
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
  const placementOptions = useWorkbenchStore((state) => state.placementOptions)
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
                <Circle radius={HOLE_RADIUS} fill="#3d4641" shadowColor="#000" shadowBlur={2} shadowOpacity={0.34} />
              </Group>
            ))}
            {terminalHoles.map((hole) => (
              <Group key={hole.id} x={hole.x} y={hole.y} listening={false}>
                <Circle radius={7} fill="#b4b9b2" />
                <Circle radius={HOLE_RADIUS} fill="#3b433f" shadowColor="#000" shadowBlur={2} shadowOpacity={0.32} />
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
                  <Line points={points} tension={0.45} stroke="#070b09" strokeWidth={selected ? 10 : 8} opacity={0.36} lineCap="round" />
                  <Line
                    points={points}
                    tension={0.45}
                    stroke={wire.color}
                    strokeWidth={selected ? selectedWireWidth : wireWidth}
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
                  <TwoPinBody kind={activeTool} points={[pendingStart, pointer]} selected options={placementOptions[activeTool]} />
                  <Circle x={pendingStart.x} y={pendingStart.y} radius={7} fill="#f5b83b" stroke="#171a18" strokeWidth={2} />
                </Group>
              ) : (
                <Line points={[pendingStart.x, pendingStart.y, pointer.x, pointer.y]} stroke="#f5b83b" strokeWidth={3.5} dash={[7, 5]} lineCap="round" listening={false} />
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
