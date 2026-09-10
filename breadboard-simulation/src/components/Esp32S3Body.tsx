import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { ESP32_S3_PINS } from '@/domain/esp32s3'
import type { Point } from '@/domain/types'

export function Esp32S3Body({ points, selected }: { points: Point[]; selected: boolean }) {
  if (points.length !== 44) return null
  const left = points[0]!.x - 7
  const right = points[21]!.x + 7
  const top = points[43]!.y - 10
  const bottom = points[0]!.y + 10
  const antennaLeft = left - 40
  const centerY = (top + bottom) / 2
  return (
    <Group>
      {selected && <Rect x={antennaLeft - 4} y={top - 4} width={right - antennaLeft + 12} height={bottom - top + 8} cornerRadius={10} stroke="#f5b83b" strokeWidth={2} />}
      <Rect x={left} y={top} width={right - left} height={bottom - top} cornerRadius={7} fill="#202d29" stroke="#101b17" strokeWidth={2} shadowColor="#000" shadowBlur={6} shadowOpacity={0.3} shadowOffsetY={3} />
      <Rect x={left + 3} y={top + 3} width={right - left - 6} height={bottom - top - 6} cornerRadius={5} stroke="#52645a" strokeWidth={0.7} />
      {/* PCB antenna projects beyond the left edge; the metal shield intentionally has no model text. */}
      <Rect x={antennaLeft} y={centerY - 66} width={40} height={132} fill="#17201b" stroke="#938563" strokeWidth={0.8} cornerRadius={2} />
      <Line
        points={[
          left - 4, centerY - 54,
          antennaLeft + 5, centerY - 54, antennaLeft + 5, centerY - 36, left - 5, centerY - 36,
          left - 5, centerY - 18, antennaLeft + 5, centerY - 18, antennaLeft + 5, centerY,
          left - 5, centerY, left - 5, centerY + 18, antennaLeft + 5, centerY + 18,
          antennaLeft + 5, centerY + 36, left - 5, centerY + 36, left - 5, centerY + 54,
        ]}
        stroke="#bc9a51" strokeWidth={3.2} lineJoin="miter"
      />
      <Rect x={left + 2} y={centerY - 65} width={158} height={130} cornerRadius={4} stroke="#a2aaa5" strokeWidth={1.5} fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 158, y: 130 }} fillLinearGradientColorStops={[0, '#e0e3de', 0.45, '#b7bfbb', 1, '#8d9994']} />
      <Rect x={left + 6} y={centerY - 61} width={150} height={122} cornerRadius={3} stroke="#edf0e9" strokeWidth={0.6} />
      {/* Long two-row USB bridge package, to the right of the buttons. */}
      <Group x={left + 298} y={centerY - 48} scaleX={1.1} scaleY={1.1}>
        {[-1, 1].flatMap((side) => Array.from({ length: 8 }, (_, index) => (
          <Rect key={`${side}-${index}`} x={-26 + index * 7} y={side < 0 ? -17 : 10} width={4} height={7} cornerRadius={0.6} fill="#bac2ba" stroke="#7f8c81" strokeWidth={0.5} />
        )))}
        <Rect x={-31} y={-11} width={62} height={22} fill="#101612" stroke="#606e62" strokeWidth={1} cornerRadius={2} />
        <Line points={[-27, -8, 27, -8]} stroke="#354239" strokeWidth={1} />
        <Circle x={-25} y={6} radius={1.6} fill="#798778" />
      </Group>
      {/* Reset and boot buttons stack vertically in the former LED area. */}
      {['RST', 'BOOT'].map((label, index) => (
        <Group key={label} x={right - 86} y={centerY + 20 + index * 38} scaleX={1.1} scaleY={1.1}>
          <Rect x={-15} y={-11} width={30} height={22} fill="#a8aea2" stroke="#070e09" cornerRadius={3} />
          <Rect x={-9} y={-6} width={18} height={12} cornerRadius={6} fill="#f5f5ef" stroke="#d0d4ca" strokeWidth={1} />
          <Text x={-42} y={-3.5} width={24} text={label} fontSize={7} align="right" fill="#d7dfce" />
        </Group>
      ))}
      {[-1, 1].map((side) => (
        <Group key={side}>
          <Text x={right - 60} y={centerY + side * 46 - 7} width={18} height={14} verticalAlign="middle" text={side < 0 ? 'UART' : 'USB'} fontFamily="monospace" fontSize={7} align="right" fill="#d7dfce" />
          <Rect x={right - 38} y={centerY + side * 46 - 28} width={46} height={56} cornerRadius={4} fill="#bdc6c1" stroke="#85928a" strokeWidth={1} />
        </Group>
      ))}
      {/* Simple yellow tantalum capacitor beside the RGB LED. */}
      <Group x={right - 205} y={centerY + 46}>
        <Rect x={-7} y={-18} width={14} height={36} cornerRadius={1} fill="#b9bdb1" />
        <Rect x={-9} y={-15} width={18} height={30} cornerRadius={2} fill="#dfb849" stroke="#b38c2f" strokeWidth={0.8} />
        <Line points={[-7, -10, 7, -10]} stroke="#876623" strokeWidth={2.5} />
      </Group>
      {/* 1117 LDO, SOT-223: wide metal tab opposite three leads.
          Package reference: https://www.ti.com/lit/ds/symlink/lm1117.pdf */}
      <Group x={left + 193} y={centerY - 48} scaleX={1.1} scaleY={1.1}>
        <Rect x={-11} y={-19} width={22} height={11} cornerRadius={1} fill="#bdc5bd" stroke="#859187" strokeWidth={0.7} />
        {[-12, 0, 12].map((x) => (
          <Rect key={x} x={x - 2.5} y={8} width={5} height={11} cornerRadius={0.6} fill="#bdc5bd" stroke="#859187" strokeWidth={0.7} />
        ))}
        <Rect x={-18} y={-10} width={36} height={20} cornerRadius={2} fill="#171d19" stroke="#59665b" strokeWidth={0.8} />
        <Line points={[-15, -7, 15, -7]} stroke="#3c473f" strokeWidth={1} />
      </Group>
      {/* White square RGB LED package in the lower-right area of the PCB. */}
      <Group x={right - 156} y={centerY + 46} scaleX={1.54} scaleY={1.54}>
        <Rect x={-12} y={-12} width={24} height={24} cornerRadius={2} fill="#f4f4ed" stroke="#b7c0b3" strokeWidth={1} />
        <Rect x={-8} y={-8} width={16} height={16} cornerRadius={1} fill="#e7e5d5" stroke="#d0d0bc" strokeWidth={0.8} />
        <Rect x={-5} y={-2} width={3} height={4} fill="#bd9590" />
        <Rect x={-1} y={-2} width={3} height={4} fill="#9cad91" />
        <Rect x={3} y={-2} width={3} height={4} fill="#93a7b8" />
      </Group>
      {points.map((point, index) => {
        const pin = ESP32_S3_PINS[index]!
        const lower = index < 22
        return <Group key={index}>
          <Rect x={point.x - 6} y={point.y - 6} width={12} height={12} cornerRadius={1.5} fill="#111c16" stroke="#526153" strokeWidth={0.7} />
          <Circle x={point.x} y={point.y} radius={3.8} fill="#b9a05c" stroke="#dbce98" strokeWidth={0.7} />
          <Rect x={point.x - 1.7} y={point.y - 1.7} width={3.4} height={3.4} fill="#eef0dc" />
          <Text x={point.x - 9} y={point.y + (lower ? -16 : 9)} width={18} text={pin.name} align="center" fontFamily="monospace" fontSize={6.5} fill={pin.name === '3V3' || pin.name === '5V' ? '#edc58b' : '#d1d9c9'} />
        </Group>
      })}
    </Group>
  )
}
