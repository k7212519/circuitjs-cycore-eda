import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Minimize2, Move, MousePointer2, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { Circle, Group, Layer, Line, Path, Rect, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import {
  BOARD_HEIGHT, BOARD_WIDTH, HOLE_PITCH, HOLE_RADIUS, HOLE_SLEEVE_RADIUS, defaultPinCount, defaultPlacement, holeById, holes, isRigidModule, isTwoPinComponent, nearestHole,
} from '@/domain/board'
import { occupiedHoles } from '@/domain/validation'
import type {
  BreadboardComponent, ComponentKind, ComponentPlacementOptions, ComponentVariant, DiodeVariant, Point, ResistorBandCount, TwoPinComponentKind,
} from '@/domain/types'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'
import { Cd4017Body } from './Cd4017Body'

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
const uprightLeadShorten = 5
const wireWidth = 5
const selectedWireWidth = 6.5
const minViewportScale = 0.25
const maxViewportScale = 3.5

function componentName(kind: ComponentKind): string {
  return ({ resistor: 'R', capacitor: 'C', led: 'LED', diode: 'D', switch: '开关', button: '按键', npn: 'NPN', pnp: 'PNP', 'seven-segment': '数码管', cd4017: 'CD4017' })[kind]
}

const uprightComponentKinds = new Set<ComponentKind>(['capacitor', 'led', 'npn', 'pnp'])

function componentMountDepth(component: BreadboardComponent): number {
  return Math.max(...component.pins.map((pin) => holeById.get(pin)?.y ?? Number.NEGATIVE_INFINITY))
}

function componentMountX(component: BreadboardComponent): number {
  const positions = component.pins.map((pin) => holeById.get(pin)?.x).filter((x): x is number => x !== undefined)
  return positions.length ? positions.reduce((sum, x) => sum + x, 0) / positions.length : Number.POSITIVE_INFINITY
}

function orderComponentsForRendering(components: BreadboardComponent[]): BreadboardComponent[] {
  return components
    .map((component, index) => ({ component, index }))
    .sort((left, right) => {
      const depth = componentMountDepth(left.component) - componentMountDepth(right.component)
      if (depth !== 0) return depth
      const leftUpright = uprightComponentKinds.has(left.component.kind)
      const rightUpright = uprightComponentKinds.has(right.component.kind)
      if (leftUpright !== rightUpright) return leftUpright ? -1 : 1
      if (leftUpright) {
        const horizontal = componentMountX(right.component) - componentMountX(left.component)
        if (horizontal !== 0) return horizontal
      }
      return left.index - right.index
    })
    .map(({ component }) => component)
}

const twoPinCoreWidth: Record<TwoPinComponentKind, number> = {
  resistor: 46,
  capacitor: 12,
  led: 20,
  diode: 34,
  switch: 36,
  button: 32,
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

function twoPinFrame(points: Point[], kind: TwoPinComponentKind, coreWidth = twoPinCoreWidth[kind]): TwoPinFrame | null {
  const [a, b] = points
  if (!a || !b) return null
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  return {
    angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
    length,
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    leadEdge: Math.min(length / 2, coreWidth / 2),
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
      <Rect x={-twoPinCoreWidth.resistor / 2} y={-8} width={twoPinCoreWidth.resistor} height={16} cornerRadius={5} fill="#e1c49d" stroke={selected ? '#f5b83b' : '#8a6d4d'} strokeWidth={selected ? 2 : 1} shadowColor="#000" shadowBlur={5} shadowOpacity={0.3} shadowOffsetY={2} />
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
        attachY={(variant === 'ceramic' ? -15 : -16) + uprightLeadShorten}
      />
      <Group y={uprightLeadShorten}>
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
    </Group>
  )
}

function mutedLedColor(color: string): string {
  const source = color.replace('#', '')
  const hex = source.length === 3 ? source.split('').map((digit) => digit.repeat(2)).join('') : source
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#4b504d'
  const value = Number.parseInt(hex, 16)
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  const gray = channels[0]! * 0.299 + channels[1]! * 0.587 + channels[2]! * 0.114
  return `#${channels.map((channel) => Math.round((channel * 0.08 + gray * 0.92) * 0.62).toString(16).padStart(2, '0')).join('')}`
}

function blendLedColor(color: string, brightness: number): string {
  const lit = color.replace('#', '')
  const muted = mutedLedColor(color).replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(lit) || !/^[0-9a-f]{6}$/i.test(muted)) return '#4b504d'
  const channel = (source: string, index: number) => Number.parseInt(source.slice(index * 2, index * 2 + 2), 16)
  return `#${[0, 1, 2].map((index) => Math.round(
    channel(muted, index) + (channel(lit, index) - channel(muted, index)) * brightness,
  ).toString(16).padStart(2, '0')).join('')}`
}

function LedBody({ points, selected, color, brightness }: { points: Point[]; selected: boolean; color?: string; brightness: number }) {
  const frame = twoPinFrame(points, 'led')
  if (!frame) return null
  const lampColor = color ?? '#ef3d32'
  const intensity = Math.min(1, Math.max(0, brightness))
  const glow = intensity * 42
  const bodyColor = blendLedColor(lampColor, intensity)
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <UprightPinLeads length={frame.length} slots={[-HOLE_PITCH / 2, HOLE_PITCH / 2]} attachY={-16 + uprightLeadShorten} />
      <Group y={uprightLeadShorten}>
        <Rect x={-18} y={-21} width={36} height={6} cornerRadius={2} fill="#b8c0bc" stroke={selected ? '#f5b83b' : '#555f5a'} strokeWidth={selected ? 2 : 1} shadowColor="#000" shadowBlur={5} shadowOpacity={0.38} shadowOffsetY={3} />
        <Path
          data="M -15 -20 L -15 -42 C -15 -51 -8 -57 0 -57 C 8 -57 15 -51 15 -42 L 15 -20 Z"
          fill={bodyColor} opacity={0.94}
          stroke={selected ? '#f5b83b' : '#38413d'} strokeWidth={selected ? 2 : 1}
          shadowColor={lampColor} shadowBlur={glow} shadowOpacity={intensity * 0.95}
        />
        <Path data="M -10 -44 C -10 -50 -7 -54 -3 -55" stroke="#fff" strokeWidth={2.2} opacity={0.18 + intensity * 0.34} lineCap="round" />
        <Line points={[-10, -18, 10, -18]} stroke="#edf2ef" strokeWidth={1} opacity={0.3 + intensity * 0.25} />
        <Text
          x={-HOLE_PITCH / 2 - 7} y={-35} width={14} align="center" text="+"
          fontSize={14} fontStyle="bold" fontFamily="monospace"
          fill="#c8cfca" opacity={0.68} listening={false}
        />
      </Group>
    </Group>
  )
}

function resolveDiodeVariant(variant: ComponentVariant | undefined, label: string | undefined): DiodeVariant {
  if (variant === 'small-signal' || variant === 'rectifier' || variant === 'schottky') return variant
  if (label === '1N4007') return 'rectifier'
  if (label === '1N5819') return 'schottky'
  return 'small-signal'
}

function DiodeBody({ points, selected, variant, label }: { points: Point[]; selected: boolean; variant?: ComponentVariant; label?: string }) {
  const diodeVariant = resolveDiodeVariant(variant, label)
  const smallSignal = diodeVariant === 'small-signal'
  const bodyWidth = smallSignal ? 20 : twoPinCoreWidth.diode - 6
  const bodyHeight = smallSignal ? 12 : 16
  const halfBodyWidth = bodyWidth / 2
  const halfBodyHeight = bodyHeight / 2
  const frame = twoPinFrame(points, 'diode', bodyWidth)
  if (!frame) return null
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <PinLeads length={frame.length} leadEdge={frame.leadEdge} />
      <Rect
        x={-halfBodyWidth} y={-halfBodyHeight} width={bodyWidth} height={bodyHeight} cornerRadius={2}
        fill={smallSignal ? '#d45738' : '#353b3b'}
        stroke={selected ? '#f5b83b' : smallSignal ? '#633126' : '#171b1b'}
        strokeWidth={selected ? 2 : 1}
        shadowColor="#000" shadowBlur={5} shadowOpacity={0.3}
      />
      {smallSignal ? (
        <Rect x={6} y={-halfBodyHeight} width={halfBodyWidth - 6} height={bodyHeight} cornerRadius={[0, 2, 2, 0]} fill="#c7cdca" />
      ) : (
        <Rect x={halfBodyWidth - 5} y={-halfBodyHeight} width={5} height={bodyHeight} cornerRadius={[0, 2, 2, 0]} fill="#c7cdca" />
      )}
    </Group>
  )
}

function PushButtonBody({
  points,
  selected,
  pressed = false,
  onKnobPress,
  onKnobRelease,
}: {
  points: Point[]
  selected: boolean
  pressed?: boolean
  onKnobPress?: (pointerId: number) => void
  onKnobRelease?: (pointerId: number) => void
}) {
  const frame = twoPinFrame(points, 'button')
  if (!frame) return null
  const bodySize = 32
  const edge = selected ? '#f5b83b' : '#353b3b'
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <PinLeads length={frame.length} leadEdge={bodySize / 2} />
      <Rect
        x={-bodySize / 2} y={-bodySize / 2} width={bodySize} height={bodySize} cornerRadius={2.5}
        fillLinearGradientStartPoint={{ x: -16, y: -16 }}
        fillLinearGradientEndPoint={{ x: 16, y: 16 }}
        fillLinearGradientColorStops={[0, '#fbfcfb', 0.2, '#e1e5e3', 0.52, '#aab1ad', 0.78, '#edf0ee', 1, '#969e9a']}
        stroke={edge} strokeWidth={selected ? 2 : 1}
        shadowColor="#000" shadowBlur={5} shadowOpacity={0.36} shadowOffsetY={2}
      />
      {[[-11, -11], [11, -11], [-11, 11], [11, 11]].map(([x, y]) => (
        <Circle key={`${x}-${y}`} x={x} y={y} radius={1.5} fill="#4b5250" shadowColor="#fff" shadowBlur={1} shadowOpacity={0.28} />
      ))}
      <Circle
        name="button-knob"
        x={0} y={pressed ? 1 : 0} radius={8}
        draggable={false}
        fillRadialGradientStartPoint={{ x: -2.5, y: -3 }}
        fillRadialGradientStartRadius={1}
        fillRadialGradientEndPoint={{ x: 1.5, y: 1.5 }}
        fillRadialGradientEndRadius={9}
        fillRadialGradientColorStops={pressed
          ? [0, '#444b4b', 0.42, '#353b3b', 1, '#1c2121']
          : [0, '#596161', 0.34, '#444b4b', 0.78, '#353b3b', 1, '#202525']}
        stroke={selected ? '#f5b83b' : '#171b1b'} strokeWidth={selected ? 1.7 : 1}
        shadowColor="#000" shadowBlur={pressed ? 1 : 3} shadowOpacity={0.4} shadowOffsetY={pressed ? 0.5 : 1.5}
        onPointerDown={onKnobPress ? (event) => { event.cancelBubble = true; onKnobPress(event.evt.pointerId) } : undefined}
        onPointerUp={onKnobRelease ? (event) => {
          if (!pressed) return
          event.cancelBubble = true
          onKnobRelease(event.evt.pointerId)
        } : undefined}
        onPointerCancel={onKnobRelease ? (event) => { event.cancelBubble = true; onKnobRelease(event.evt.pointerId) } : undefined}
        onClick={onKnobPress ? (event) => { event.cancelBubble = true } : undefined}
        onTap={onKnobPress ? (event) => { event.cancelBubble = true } : undefined}
      />
      {!pressed ? <Path data="M -3.8 -3.6 C -2 -5.5 1.2 -5.8 3.5 -4" stroke="#899090" strokeWidth={1.1} opacity={0.55} lineCap="round" listening={false} /> : null}
    </Group>
  )
}

function SwitchBody({ points, selected, closed = false }: { points: Point[]; selected: boolean; closed?: boolean }) {
  const frame = twoPinFrame(points, 'switch')
  if (!frame) return null
  const contactColor = selected ? '#f5b83b' : '#6f7b75'
  const bladePoints = closed ? [-15, 0, 15, 0] : [-15, 0, 12, -13]
  return (
    <Group x={frame.mid.x} y={frame.mid.y} rotation={frame.angle}>
      <PinLeads length={frame.length} leadEdge={18} />
      <Circle x={-15} y={0} radius={3.5} fill="#d9dedb" stroke={contactColor} strokeWidth={selected ? 2 : 1.3} shadowColor="#000" shadowBlur={3} shadowOpacity={0.3} />
      <Circle x={15} y={0} radius={3.5} fill="#d9dedb" stroke={contactColor} strokeWidth={selected ? 2 : 1.3} shadowColor="#000" shadowBlur={3} shadowOpacity={0.3} />
      <Line points={bladePoints} stroke="#67716c" strokeWidth={5} lineCap="round" shadowColor="#000" shadowBlur={3} shadowOpacity={0.3} shadowOffsetY={2} />
      <Line points={bladePoints} stroke="#cbd1ce" strokeWidth={2.2} lineCap="round" />
    </Group>
  )
}

function TwoPinBody({ kind, points, selected, options }: { kind: TwoPinComponentKind; points: Point[]; selected: boolean; options: ComponentPlacementOptions }) {
  if (kind === 'resistor') return <ResistorBody points={points} selected={selected} value={options.value} bandCount={options.bandCount} />
  if (kind === 'capacitor') return <CapacitorBody points={points} selected={selected} variant={options.variant} />
  if (kind === 'diode') return <DiodeBody points={points} selected={selected} variant={options.variant} label={options.label} />
  if (kind === 'switch') return <SwitchBody points={points} selected={selected} />
  if (kind === 'button') return <PushButtonBody points={points} selected={selected} />
  return <LedBody points={points} selected={selected} color={options.color} brightness={0} />
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
            points={[point.x, point.y, leadSlots[index] ?? 0, -20 + uprightLeadShorten]}
            stroke="#525b56"
            strokeWidth={5}
            lineCap="round"
            shadowColor="#000"
            shadowBlur={3}
            shadowOpacity={0.38}
            shadowOffsetY={2}
          />
          <Line
            points={[point.x, point.y, leadSlots[index] ?? 0, -20 + uprightLeadShorten]}
            stroke="#c2cac4"
            strokeWidth={2.4}
            lineCap="round"
          />
        </Group>
      ))}

      <Group y={uprightLeadShorten}>
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
    </Group>
  )
}

function mixSegmentColor(brightness: number): string {
  const amount = Math.min(1, Math.max(0, brightness))
  const off = [239, 238, 230]
  const on = [255, 47, 35]
  const channels = off.map((value, index) => Math.round(value + ((on[index] ?? value) - value) * amount))
  return `rgb(${channels.join(', ')})`
}

function SevenSegmentBody({
  points,
  selected,
  brightness = [],
}: {
  points: Point[]
  selected: boolean
  brightness?: number[]
}) {
  if (points.length !== 10) return null
  const topLeft = points[9]
  const topRight = points[5]
  const bottomLeft = points[0]
  const bottomRight = points[4]
  if (!topLeft || !topRight || !bottomLeft || !bottomRight) return null

  const center = {
    x: (topLeft.x + topRight.x + bottomLeft.x + bottomRight.x) / 4,
    y: (topLeft.y + topRight.y + bottomLeft.y + bottomRight.y) / 4,
  }
  const bodyWidth = Math.abs(topRight.x - topLeft.x) + 8
  const bodyHeight = Math.abs(bottomLeft.y - topLeft.y) - 6
  const bodyTop = center.y - bodyHeight / 2
  const bodyBottom = center.y + bodyHeight / 2
  const segmentRowOffset = 35
  // Leave a 4px gap between the upper/lower side tips and clearance at each bevel.
  const verticalHalfLength = segmentRowOffset / 2 - 2
  const segmentFill = (index: number) => mixSegmentColor(brightness[index] ?? 0)
  const segmentGlow = (index: number) => Math.min(1, Math.max(0, brightness[index] ?? 0))
  const horizontal = (index: number, y: number) => (
    <Line
      key={index}
      points={[-18, y, -13, y - 5, 13, y - 5, 18, y, 13, y + 5, -13, y + 5]}
      closed
      fill={segmentFill(index)}
      shadowColor="#ff3026"
      shadowBlur={segmentGlow(index) * 12}
      shadowOpacity={segmentGlow(index) * 0.85}
      perfectDrawEnabled={false}
    />
  )
  const vertical = (index: number, x: number, y: number) => (
    <Line
      key={index}
      points={[
        x, y - verticalHalfLength,
        x + 5, y - verticalHalfLength + 5,
        x + 5, y + verticalHalfLength - 5,
        x, y + verticalHalfLength,
        x - 5, y + verticalHalfLength - 5,
        x - 5, y - verticalHalfLength + 5,
      ]}
      closed
      fill={segmentFill(index)}
      shadowColor="#ff3026"
      shadowBlur={segmentGlow(index) * 12}
      shadowOpacity={segmentGlow(index) * 0.85}
      perfectDrawEnabled={false}
    />
  )

  return (
    <Group>
      {points.map((point, index) => {
        const topPin = index >= 5
        return (
          <Group key={index}>
            <Line
              points={[point.x, point.y, point.x, topPin ? bodyTop : bodyBottom]}
              stroke="#4f5652"
              strokeWidth={5}
              lineCap="round"
              shadowColor="#000"
              shadowBlur={3}
              shadowOpacity={0.35}
            />
            <Line
              points={[point.x, point.y, point.x, topPin ? bodyTop : bodyBottom]}
              stroke="#c5cbc7"
              strokeWidth={2.2}
              lineCap="round"
            />
          </Group>
        )
      })}
      <Group x={center.x} y={center.y}>
        <Rect
          x={-bodyWidth / 2}
          y={-bodyHeight / 2}
          width={bodyWidth}
          height={bodyHeight}
          cornerRadius={4}
          fill="#080a09"
          stroke={selected ? '#f5b83b' : '#343a36'}
          strokeWidth={selected ? 2.2 : 1.2}
          shadowColor="#000"
          shadowBlur={9}
          shadowOpacity={0.48}
          shadowOffsetY={5}
        />
        <Rect x={-bodyWidth / 2 + 5} y={-bodyHeight / 2 + 5} width={bodyWidth - 10} height={bodyHeight - 10} cornerRadius={2} stroke="#171c19" strokeWidth={1} />
        {/* Shear only the digit rightward (~7°), keeping the package and decimal point upright. */}
        <Group skewX={-0.12}>
          {horizontal(0, -segmentRowOffset)}
          {vertical(1, 21, -segmentRowOffset / 2)}
          {vertical(2, 21, segmentRowOffset / 2)}
          {horizontal(3, segmentRowOffset)}
          {vertical(4, -21, segmentRowOffset / 2)}
          {vertical(5, -21, -segmentRowOffset / 2)}
          {horizontal(6, 0)}
        </Group>
        <Circle
          x={27}
          y={segmentRowOffset + 2}
          radius={5}
          fill={segmentFill(7)}
          shadowColor="#ff3026"
          shadowBlur={segmentGlow(7) * 12}
          shadowOpacity={segmentGlow(7) * 0.85}
          perfectDrawEnabled={false}
        />
      </Group>
    </Group>
  )
}

interface SelectionDragPreview {
  leaderId: string
  delta: Point
}

function ComponentShape({
  component,
  selectionDrag,
  onSelectionDrag,
}: {
  component: BreadboardComponent
  selectionDrag: SelectionDragPreview | null
  onSelectionDrag: (preview: SelectionDragPreview | null) => void
}) {
  const [pinPreview, setPinPreview] = useState<{ index: number; point: Point } | null>(null)
  const activeButtonPointerRef = useRef<number | null>(null)
  const activeTool = useWorkbenchStore((state) => state.activeTool)
  const selectedIds = useWorkbenchStore((state) => state.selectedIds)
  const select = useWorkbenchStore((state) => state.select)
  const moveSelectionTo = useWorkbenchStore((state) => state.moveSelectionTo)
  const movePinTo = useWorkbenchStore((state) => state.movePinTo)
  const contactClosed = useWorkbenchStore((state) => Boolean(state.closedContacts[component.id]))
  const setContactClosed = useWorkbenchStore((state) => state.setContactClosed)
  const toggleSwitch = useWorkbenchStore((state) => state.toggleSwitch)
  const reading = useWorkbenchStore((state) => state.readings[component.id])
  const points = component.pins.map((pin) => holeById.get(pin)).filter((hole): hole is NonNullable<typeof hole> => Boolean(hole))
  const renderedPoints = pinPreview
    ? points.map((point, index) => index === pinPreview.index ? pinPreview.point : point)
    : points
  const selected = selectedIds.includes(component.id)
  const showHandles = selected && selectedIds.length === 1 && !isRigidModule(component.kind) && activeTool !== 'pan'
  const previewOffset = selected && selectionDrag?.leaderId !== component.id ? selectionDrag?.delta : undefined
  const first = points[0]
  const isButton = component.kind === 'button'
  const isSwitch = component.kind === 'switch'

  useEffect(() => {
    if (!isButton || !contactClosed) return
    const release = (event: PointerEvent) => {
      if (activeButtonPointerRef.current !== event.pointerId) return
      activeButtonPointerRef.current = null
      setContactClosed(component.id, false)
    }
    const releaseOnBlur = () => {
      activeButtonPointerRef.current = null
      setContactClosed(component.id, false)
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', releaseOnBlur)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', releaseOnBlur)
    }
  }, [component.id, contactClosed, isButton, setContactClosed])

  if (!first) return null

  const finishMove = (event: KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true
    const delta = event.target.position()
    moveSelectionTo(component.id, { x: first.x + delta.x, y: first.y + delta.y })
    event.target.position({ x: 0, y: 0 })
    onSelectionDrag(null)
  }

  return (
    <Group
      id={component.id}
      name="selectable"
      listening={activeTool !== 'wire' && activeTool !== 'pan'}
      x={previewOffset?.x ?? 0}
      y={previewOffset?.y ?? 0}
      draggable
      onPointerDown={(event) => {
        event.cancelBubble = true
        select(component.id, event.evt.shiftKey)
      }}
      onClick={(event) => { event.cancelBubble = true; if (isSwitch) toggleSwitch(component.id) }}
      onTap={(event) => { event.cancelBubble = true; if (isSwitch) toggleSwitch(component.id) }}
      onDragStart={() => {
        if (!isButton) return
        activeButtonPointerRef.current = null
        setContactClosed(component.id, false)
      }}
      onDragMove={(event) => {
        event.cancelBubble = true
        onSelectionDrag({ leaderId: component.id, delta: event.target.position() })
      }}
      onDragEnd={finishMove}
    >
      <Group name="selection-bounds">
        {component.kind === 'resistor' ? <ResistorBody points={renderedPoints} selected={selected} value={component.value} bandCount={component.bandCount} /> : null}
        {component.kind === 'capacitor' ? <CapacitorBody points={renderedPoints} selected={selected} variant={component.variant} /> : null}
        {component.kind === 'diode' ? <DiodeBody points={renderedPoints} selected={selected} variant={component.variant} label={component.label} /> : null}
        {component.kind === 'led' ? <LedBody points={renderedPoints} selected={selected} color={component.color} brightness={reading?.brightness ?? 0} /> : null}
        {component.kind === 'switch' ? <SwitchBody points={renderedPoints} selected={selected} closed={contactClosed} /> : null}
        {component.kind === 'button' ? (
          <PushButtonBody
            points={renderedPoints}
            selected={selected}
            pressed={contactClosed}
            onKnobPress={(pointerId) => {
              if (activeButtonPointerRef.current !== null && activeButtonPointerRef.current !== pointerId) return
              activeButtonPointerRef.current = pointerId
              setContactClosed(component.id, true)
            }}
            onKnobRelease={(pointerId) => {
              if (activeButtonPointerRef.current !== pointerId) return
              activeButtonPointerRef.current = null
              setContactClosed(component.id, false)
            }}
          />
        ) : null}
        {component.kind === 'npn' || component.kind === 'pnp' ? <TransistorBody points={renderedPoints} selected={selected} kind={component.kind} /> : null}
        {component.kind === 'seven-segment' ? <SevenSegmentBody points={renderedPoints} selected={selected} brightness={reading?.segmentBrightness} /> : null}
        {component.kind === 'cd4017' ? <Cd4017Body points={renderedPoints} selected={selected} /> : null}
      </Group>
      {showHandles ? renderedPoints.map((point, index) => (
        <Circle
          key={component.pins[index]}
          x={point.x}
          y={point.y}
          radius={7}
          fill="#f5b83b"
          stroke="#171a18"
          strokeWidth={2}
          draggable
          onPointerDown={(event) => { event.cancelBubble = true; select(component.id) }}
          onDragStart={(event) => {
            event.cancelBubble = true
            setPinPreview({ index, point: { x: event.target.x(), y: event.target.y() } })
          }}
          onDragMove={(event) => {
            event.cancelBubble = true
            setPinPreview({ index, point: { x: event.target.x(), y: event.target.y() } })
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true
            const targetPoint = { x: event.target.x(), y: event.target.y() }
            const moved = movePinTo(component.id, index, targetPoint)
            setPinPreview(null)
            const originalPoint = points[index]
            if (!moved && originalPoint) event.target.position(originalPoint)
          }}
        />
      )) : null}
    </Group>
  )
}

export function BreadboardCanvas({ isFullscreen, onToggleFullscreen }: {
  isFullscreen: boolean
  onToggleFullscreen: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const boardGroupRef = useRef<Konva.Group>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [pointer, setPointer] = useState<Point | null>(null)
  const [panning, setPanning] = useState(false)
  const [wireEndPreview, setWireEndPreview] = useState<{ wireId: string; end: 'from' | 'to'; point: Point } | null>(null)
  const [selectionDrag, setSelectionDrag] = useState<SelectionDragPreview | null>(null)
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null)
  const panRef = useRef<Point | null>(null)
  const placementDragRef = useRef<{ tool: ComponentKind | 'wire'; screen: Point } | null>(null)
  const pinchRef = useRef<{ distance: number; center: Point } | null>(null)
  const marqueeRef = useRef<{ start: Point; startScreen: Point; additive: boolean } | null>(null)

  const document = useWorkbenchStore((state) => state.document)
  const activeTool = useWorkbenchStore((state) => state.activeTool)
  const wireStart = useWorkbenchStore((state) => state.wireStart)
  const componentStart = useWorkbenchStore((state) => state.componentStart)
  const placementOptions = useWorkbenchStore((state) => state.placementOptions)
  const selectedIds = useWorkbenchStore((state) => state.selectedIds)
  const setViewport = useWorkbenchStore((state) => state.setViewport)
  const setActiveTool = useWorkbenchStore((state) => state.setActiveTool)
  const placeAt = useWorkbenchStore((state) => state.placeAt)
  const componentAt = useWorkbenchStore((state) => state.componentAt)
  const wireAt = useWorkbenchStore((state) => state.wireAt)
  const select = useWorkbenchStore((state) => state.select)
  const selectMany = useWorkbenchStore((state) => state.selectMany)
  const moveSelectionTo = useWorkbenchStore((state) => state.moveSelectionTo)
  const moveWireEndTo = useWorkbenchStore((state) => state.moveWireEndTo)
  const undo = useWorkbenchStore((state) => state.undo)
  const redo = useWorkbenchStore((state) => state.redo)
  const canUndo = useWorkbenchStore((state) => state.past.length > 0)
  const canRedo = useWorkbenchStore((state) => state.future.length > 0)

  const viewport = document.viewport
  const pendingHoleId = activeTool === 'wire' ? wireStart : componentStart
  const pendingStart = pendingHoleId ? holeById.get(pendingHoleId) : undefined
  const pendingEnd = pendingStart && pointer && activeTool === 'button'
    ? { x: pendingStart.x + (pointer.x < pendingStart.x ? -2 : 2) * HOLE_PITCH, y: pendingStart.y }
    : pointer
  const renderedComponents = useMemo(() => orderComponentsForRendering(document.components), [document.components])
  const modulePreviewPoints = useMemo(() => {
    if (activeTool === 'wire' || activeTool === 'select' || activeTool === 'pan' || !isRigidModule(activeTool) || !pointer) return null
    const occupied = occupiedHoles(document)
    const anchor = nearestHole(pointer, 20)
    if (!anchor) return null
    const pins = defaultPlacement(activeTool, anchor, occupied)
    if (!pins) return null
    const resolved = pins.map((pin) => holeById.get(pin)).filter((hole): hole is NonNullable<typeof hole> => Boolean(hole))
    return resolved.length === defaultPinCount(activeTool) ? resolved : null
  }, [activeTool, document, pointer])

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
    const cancelMarquee = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      marqueeRef.current = null
      setMarquee(null)
      panRef.current = null
      pinchRef.current = null
      placementDragRef.current = null
      setPanning(false)
    }
    window.addEventListener('keydown', cancelMarquee)
    return () => window.removeEventListener('keydown', cancelMarquee)
  }, [])

  useEffect(() => {
    if (isFullscreen) return
    if (size.width <= 0 || size.height <= 0) return
    if (viewport.x !== 0 || viewport.y !== 0 || viewport.scale !== 1) return
    const scale = Math.min(1, (size.width - 32) / BOARD_WIDTH, (size.height - 48) / BOARD_HEIGHT)
    if (!Number.isFinite(scale) || scale <= 0) return
    setViewport({
      scale,
      x: (size.width - BOARD_WIDTH * scale) / 2,
      y: (size.height - BOARD_HEIGHT * scale) / 2,
    })
  }, [isFullscreen, setViewport, size.height, size.width, viewport.scale, viewport.x, viewport.y])

  useLayoutEffect(() => {
    if (!isFullscreen || !containerRef.current) return
    // Measure the expanded layout directly, before ResizeObserver updates size.
    const { width, height } = containerRef.current.getBoundingClientRect()
    // Symmetric margins keep the board centered and clear of the bottom controls.
    const scale = Math.min(maxViewportScale, (width - 48) / BOARD_WIDTH, (height - 128) / BOARD_HEIGHT)
    if (!Number.isFinite(scale) || scale <= 0) return
    setViewport({
      scale,
      x: (width - BOARD_WIDTH * scale) / 2,
      y: (height - BOARD_HEIGHT * scale) / 2,
    })
  }, [isFullscreen, setViewport])

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
    if (activeTool === 'pan') {
      event.evt.preventDefault()
      panRef.current = screen
      setPanning(true)
      return
    }
    if (activeTool === 'wire') {
      const beginsGesture = !wireStart
      if (wireAt(world) && beginsGesture) placementDragRef.current = { tool: 'wire', screen }
    } else if (activeTool !== 'select' && isTwoPinComponent(activeTool)) {
      const beginsGesture = !componentStart
      if (componentAt(activeTool, world) && beginsGesture) placementDragRef.current = { tool: activeTool, screen }
    } else if (activeTool !== 'select') placeAt(activeTool, world)
    else {
      marqueeRef.current = { start: world, startScreen: screen, additive: event.evt.shiftKey }
      setMarquee({ start: world, end: world })
    }
  }

  const handlePointerMove = () => {
    const screen = stageRef.current?.getPointerPosition()
    if (!screen) return
    const world = toWorld(screen)
    setPointer(world)
    if (panRef.current) {
      const dx = screen.x - panRef.current.x
      const dy = screen.y - panRef.current.y
      panRef.current = screen
      const current = useWorkbenchStore.getState().document.viewport
      setViewport({ ...current, x: current.x + dx, y: current.y + dy })
    } else if (marqueeRef.current) {
      setMarquee({ start: marqueeRef.current.start, end: world })
    }
  }

  const finishPointerAction = () => {
    const marqueeGesture = marqueeRef.current
    marqueeRef.current = null
    if (marqueeGesture) {
      const screen = stageRef.current?.getPointerPosition()
      const end = screen ? toWorld(screen) : marqueeGesture.start
      const moved = screen ? Math.hypot(screen.x - marqueeGesture.startScreen.x, screen.y - marqueeGesture.startScreen.y) : 0
      setMarquee(null)
      if (moved < 5) {
        if (!marqueeGesture.additive) select(null)
      } else {
        const left = Math.min(marqueeGesture.start.x, end.x)
        const top = Math.min(marqueeGesture.start.y, end.y)
        const right = Math.max(marqueeGesture.start.x, end.x)
        const bottom = Math.max(marqueeGesture.start.y, end.y)
        const boardGroup = boardGroupRef.current
        const ids = boardGroup
          ? boardGroup.find('.selectable').filter((node) => {
            const selectable = node as Konva.Group
            const boundsNode = selectable.findOne('.selection-bounds') ?? selectable
            const bounds = boundsNode.getClientRect({ relativeTo: boardGroup, skipShadow: true })
            return bounds.x >= left
              && bounds.y >= top
              && bounds.x + bounds.width <= right
              && bounds.y + bounds.height <= bottom
          }).map((node) => node.id())
          : []
        selectMany(ids, marqueeGesture.additive)
      }
    }
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
    marqueeRef.current = null
    setMarquee(null)
    setSelectionDrag(null)
    panRef.current = null
    setPanning(false)
  }

  const enterSelectMode = () => {
    cancelPointerAction()
    pinchRef.current = null
    setActiveTool('select')
  }

  const enterPanMode = () => {
    cancelPointerAction()
    pinchRef.current = null
    setActiveTool('pan')
  }

  const zoomAt = (screen: Point, factor: number) => {
    const current = useWorkbenchStore.getState().document.viewport
    const scale = Math.min(maxViewportScale, Math.max(minViewportScale, current.scale * factor))
    const ratio = scale / current.scale
    setViewport({ x: screen.x - (screen.x - current.x) * ratio, y: screen.y - (screen.y - current.y) * ratio, scale })
  }

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const screen = stageRef.current?.getPointerPosition()
    if (screen) zoomAt(screen, event.evt.deltaY > 0 ? 0.9 : 1.1)
  }

  const handleTouchMove = (event: KonvaEventObject<TouchEvent>) => {
    const touches = event.evt.touches
    if (touches.length !== 2) return
    event.evt.preventDefault()
    panRef.current = null
    setPanning(false)
    const rect = containerRef.current?.getBoundingClientRect()
    const a = touches[0]
    const b = touches[1]
    if (!rect || !a || !b) return
    const center = { x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top }
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const previous = pinchRef.current
    if (previous) {
      const world = toWorld(previous.center)
      const scale = Math.min(maxViewportScale, Math.max(minViewportScale, viewport.scale * distance / previous.distance))
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
  const columnLabelFontSize = 10
  const columnLabelTopY = (terminalZoneMinYs[0] ?? 0) - 26
  const columnLabelBottomY = BOARD_HEIGHT - columnLabelTopY - columnLabelFontSize

  return (
    <main
      ref={containerRef}
      className={`canvas-shell tool-${activeTool} ${panning ? 'is-panning' : ''}`}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
      data-testid="breadboard-canvas"
      data-board-interaction="wheel-zoom,middle-pan"
      data-board-transform={`${viewport.x.toFixed(3)},${viewport.y.toFixed(3)},${viewport.scale.toFixed(5)}`}
      data-selected-count={selectedIds.length}
    >
      <div className="canvas-coordinate">X {Math.round(pointer?.x ?? 0).toString().padStart(4, '0')} / Y {Math.round(pointer?.y ?? 0).toString().padStart(4, '0')}</div>
      <div className="canvas-actions" role="group" aria-label="画布操作">
        <div className="canvas-action-group" role="group" aria-label="交互模式">
          <button
            type="button"
            className="canvas-action-button canvas-select-mode"
            aria-label="选择模式"
            title="选择模式（Esc）"
            data-testid="canvas-select-mode"
            onClick={enterSelectMode}
          >
            <MousePointer2 size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="canvas-action-button"
            aria-label="抓手模式"
            title="抓手模式：拖动画布"
            data-testid="canvas-pan-mode"
            onClick={enterPanMode}
          >
            <Move size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="canvas-action-group" role="group" aria-label="历史操作">
          <button type="button" className="canvas-action-button" aria-label="撤销" title="撤销" onClick={undo} disabled={!canUndo}>
            <Undo2 size={17} aria-hidden="true" />
          </button>
          <button type="button" className="canvas-action-button" aria-label="重做" title="重做" onClick={redo} disabled={!canRedo}>
            <Redo2 size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="canvas-action-group" role="group" aria-label="缩放操作">
          <button type="button" className="canvas-action-button" aria-label="放大" title="放大" onClick={() => zoomAt({ x: size.width / 2, y: size.height / 2 }, 1.1)} disabled={viewport.scale >= maxViewportScale}>
            <ZoomIn size={17} aria-hidden="true" />
          </button>
          <button type="button" className="canvas-action-button" aria-label="缩小" title="缩小" onClick={() => zoomAt({ x: size.width / 2, y: size.height / 2 }, 1 / 1.1)} disabled={viewport.scale <= minViewportScale}>
            <ZoomOut size={17} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="canvas-action-button"
          aria-label={isFullscreen ? '退出网页全屏' : '网页内全屏'}
          title={isFullscreen ? '退出网页全屏（Esc）' : '网页内全屏'}
          data-testid="canvas-fullscreen"
          onClick={() => {
            cancelPointerAction()
            pinchRef.current = null
            onToggleFullscreen()
          }}
        >
          {isFullscreen ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
        </button>
      </div>
      {size.width > 0 && size.height > 0 ? (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onPointerDown={handleCanvasAction}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerAction}
          onPointerLeave={cancelPointerAction}
          onPointerCancel={cancelPointerAction}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => { pinchRef.current = null }}
        >
        <Layer>
          <Group ref={boardGroupRef} x={viewport.x} y={viewport.y} scaleX={viewport.scale} scaleY={viewport.scale}>
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

            {[columnLabelTopY, columnLabelBottomY].map((labelY, rowIndex) => (
              <Group key={rowIndex === 0 ? 'column-labels-top' : 'column-labels-bottom'} listening={false}>
                {columnLabels.map((column) => (
                  <Text key={column} x={terminalMinX - 10 + column * HOLE_PITCH} y={labelY} width={20} align="center" text={String(column + 1)} fontFamily="monospace" fontSize={columnLabelFontSize} fill="#7e8881" />
                ))}
              </Group>
            ))}
            {['A', 'B', 'C', 'D'].map((zone, index) => (
              <Text key={zone} x={8} y={(terminalZoneMinYs[index] ?? 0) + 28} width={12} align="center" text={zone} fontFamily="monospace" fontStyle="bold" fontSize={12} fill="#657069" />
            ))}

            {railHoles.map((hole) => (
              <Group key={hole.id} x={hole.x} y={hole.y} listening={false}>
                <Circle radius={HOLE_SLEEVE_RADIUS} fill="#aeb3ac" />
                <Circle radius={HOLE_RADIUS} fill="#3d4641" shadowColor="#000" shadowBlur={2} shadowOpacity={0.34} />
              </Group>
            ))}
            {terminalHoles.map((hole) => (
              <Group key={hole.id} x={hole.x} y={hole.y} listening={false}>
                <Circle radius={HOLE_SLEEVE_RADIUS} fill="#b4b9b2" />
                <Circle radius={HOLE_RADIUS} fill="#3b433f" shadowColor="#000" shadowBlur={2} shadowOpacity={0.32} />
              </Group>
            ))}

            {document.wires.map((wire) => {
              const from = holeById.get(wire.from)
              const to = holeById.get(wire.to)
              if (!from || !to) return null
              const preview = wireEndPreview?.wireId === wire.id ? wireEndPreview : null
              const renderedFrom = preview?.end === 'from' ? preview.point : from
              const renderedTo = preview?.end === 'to' ? preview.point : to
              const selected = selectedIds.includes(wire.id)
              const showHandles = selected && selectedIds.length === 1 && activeTool !== 'pan'
              const previewOffset = selected && selectionDrag?.leaderId !== wire.id ? selectionDrag?.delta : undefined
              const points = [renderedFrom.x, renderedFrom.y, renderedTo.x, renderedTo.y]
              const finishWireMove = (event: KonvaEventObject<DragEvent>) => {
                event.cancelBubble = true
                const delta = event.target.position()
                moveSelectionTo(wire.id, { x: from.x + delta.x, y: from.y + delta.y })
                event.target.position({ x: 0, y: 0 })
                setSelectionDrag(null)
              }
              return (
                <Group
                  key={wire.id}
                  id={wire.id}
                  name="selectable"
                  listening={activeTool !== 'wire' && activeTool !== 'pan'}
                  x={previewOffset?.x ?? 0}
                  y={previewOffset?.y ?? 0}
                  draggable
                  onPointerDown={(event) => { event.cancelBubble = true; select(wire.id, event.evt.shiftKey) }}
                  onClick={(event) => { event.cancelBubble = true }}
                  onTap={(event) => { event.cancelBubble = true }}
                  onDragMove={(event) => {
                    event.cancelBubble = true
                    setSelectionDrag({ leaderId: wire.id, delta: event.target.position() })
                  }}
                  onDragEnd={finishWireMove}
                >
                  <Group name="selection-bounds">
                    <Line points={points} stroke="#070b09" strokeWidth={selected ? 10 : 8} opacity={0.36} lineCap="round" />
                    <Line
                      points={points}
                      stroke={wire.color}
                      strokeWidth={selected ? selectedWireWidth : wireWidth}
                      lineCap="round"
                      shadowColor="#000"
                      shadowBlur={4}
                      shadowOpacity={0.35}
                      hitStrokeWidth={16}
                    />
                  </Group>
                  {showHandles ? ([['from', renderedFrom], ['to', renderedTo]] as const).map(([end, point]) => (
                    <Circle
                      key={end}
                      x={point.x}
                      y={point.y}
                      radius={7}
                      fill="#f5b83b"
                      stroke="#171a18"
                      strokeWidth={2}
                      draggable
                      onPointerDown={(event) => { event.cancelBubble = true; select(wire.id) }}
                      onDragStart={(event) => {
                        event.cancelBubble = true
                        setWireEndPreview({ wireId: wire.id, end, point: { x: event.target.x(), y: event.target.y() } })
                      }}
                      onDragMove={(event) => {
                        event.cancelBubble = true
                        setWireEndPreview({ wireId: wire.id, end, point: { x: event.target.x(), y: event.target.y() } })
                      }}
                      onDragEnd={(event) => {
                        event.cancelBubble = true
                        const targetPoint = { x: event.target.x(), y: event.target.y() }
                        const moved = moveWireEndTo(wire.id, end, targetPoint)
                        setWireEndPreview(null)
                        const originalPoint = end === 'from' ? from : to
                        if (!moved) event.target.position(originalPoint)
                      }}
                    />
                  )) : null}
                </Group>
              )
            })}

            {renderedComponents.map((component) => (
              <ComponentShape
                key={component.id}
                component={component}
                selectionDrag={selectionDrag}
                onSelectionDrag={setSelectionDrag}
              />
            ))}

            {modulePreviewPoints ? (
              <Group opacity={0.72} listening={false}>
                {activeTool === 'cd4017' ? <Cd4017Body points={modulePreviewPoints} selected /> : <SevenSegmentBody points={modulePreviewPoints} selected />}
                {modulePreviewPoints.map((point, index) => (
                  <Circle key={index} x={point.x} y={point.y} radius={5.5} stroke="#f5b83b" strokeWidth={1.8} />
                ))}
              </Group>
            ) : null}

            {pendingStart && pendingEnd ? (
              activeTool !== 'wire' && activeTool !== 'select' && activeTool !== 'pan' && isTwoPinComponent(activeTool) ? (
                <Group opacity={0.78} listening={false}>
                  <TwoPinBody kind={activeTool} points={[pendingStart, pendingEnd]} selected options={placementOptions[activeTool]} />
                  <Circle x={pendingStart.x} y={pendingStart.y} radius={7} fill="#f5b83b" stroke="#171a18" strokeWidth={2} />
                </Group>
              ) : (
                <Line points={[pendingStart.x, pendingStart.y, pendingEnd.x, pendingEnd.y]} stroke="#f5b83b" strokeWidth={3.5} dash={[7, 5]} lineCap="round" listening={false} />
              )
            ) : null}

            {marquee ? (
              <Rect
                x={Math.min(marquee.start.x, marquee.end.x)}
                y={Math.min(marquee.start.y, marquee.end.y)}
                width={Math.abs(marquee.end.x - marquee.start.x)}
                height={Math.abs(marquee.end.y - marquee.start.y)}
                fill="rgba(245, 184, 59, 0.12)"
                stroke="#f5b83b"
                strokeWidth={1.5 / viewport.scale}
                dash={[7 / viewport.scale, 4 / viewport.scale]}
                listening={false}
              />
            ) : null}
          </Group>
        </Layer>
        </Stage>
      ) : null}
      {activeTool !== 'select' ? (
        <div className="active-tool-toast">
          <strong>{activeTool === 'pan'
            ? '拖动画布'
            : activeTool === 'wire'
            ? (wireStart ? '拖到导线终点孔' : '选择导线起点孔')
            : isTwoPinComponent(activeTool)
              ? (componentStart ? `拖到 ${componentName(activeTool)} 终点孔` : `选择 ${componentName(activeTool)} 起点孔`)
              : `放置 ${componentName(activeTool)}`}</strong>
          <span>ESC 退出工具</span>
          <button type="button" onClick={enterSelectMode}>退出</button>
        </div>
      ) : null}
    </main>
  )
}
