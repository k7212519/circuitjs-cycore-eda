import { Circle, Group, Line, Path, Rect, Text } from 'react-konva'
import type { Point } from '@/domain/types'
import logoSvg from '../../imgs/logo.svg?raw'

// Reuse the brand's actual vector contours, recolored as PCB silkscreen.
const logoPaths = Array.from(logoSvg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g), (match) => match[1]!)

export function Cd4017Body({ points, selected }: { points: Point[]; selected: boolean }) {
  const bottomLeft = points[0]
  const bottomRight = points[7]
  const topLeft = points[15]
  if (points.length !== 16 || !bottomLeft || !bottomRight || !topLeft) return null
  const center = { x: (bottomLeft.x + bottomRight.x) / 2, y: (bottomLeft.y + topLeft.y) / 2 }
  const halfWidth = (bottomRight.x - bottomLeft.x) / 2 + 24
  const pinRowHalfHeight = (bottomLeft.y - topLeft.y) / 2
  // Add 4px of PCB above and below without changing the electrical footprint.
  const halfHeight = pinRowHalfHeight + 10
  const chipHalfHeight = 20

  return (
    <Group x={center.x} y={center.y}>
      {selected ? <Rect x={-halfWidth - 4} y={-halfHeight - 4} width={halfWidth * 2 + 8} height={halfHeight * 2 + 8} cornerRadius={10} stroke="#f5b83b" strokeWidth={2} /> : null}
      <Rect
        x={-halfWidth} y={-halfHeight} width={halfWidth * 2} height={halfHeight * 2}
        cornerRadius={7} fill="#303633" stroke="#181d1b" strokeWidth={1.5}
        shadowColor="#101512" shadowBlur={5} shadowOffsetY={3} shadowOpacity={0.3}
      />
      <Rect x={-halfWidth + 2} y={-halfHeight + 2} width={halfWidth * 2 - 4} height={halfHeight * 2 - 4} cornerRadius={6} stroke="#59615a" strokeWidth={0.6} opacity={0.7} />

      {points.map((point, index) => {
        const x = point.x - center.x
        const y = point.y - center.y
        const lower = index < 8
        const chipX = -56 + (lower ? index : 15 - index) * 11
        const side = lower ? 1 : -1
        return (
          <Group key={index}>
            <Line points={[x, y, x, side * 37, chipX, side * (chipHalfHeight + 7)]} stroke="#46504a" strokeWidth={1.2} />
            <Rect x={chipX - 2.5} y={lower ? chipHalfHeight - 2 : -chipHalfHeight - 8} width={5} height={10} fill="#b6bbb5" stroke="#d9dcd6" strokeWidth={0.6} cornerRadius={0.8} />
            <Circle x={x} y={y} radius={6.1} fill="#141a16" stroke={index === 0 ? '#d9b56b' : '#72796e'} strokeWidth={1.2} />
            <Circle x={x} y={y} radius={2.8} fill="#babfb3" />
            <Circle x={x - 0.7} y={y - 0.9} radius={1.2} fill="#ecede0" />
          </Group>
        )
      })}

      <Rect x={-64} y={-chipHalfHeight} width={93} height={chipHalfHeight * 2} cornerRadius={3} fill="#111613" stroke="#070b08" strokeWidth={1.2} shadowColor="#000" shadowBlur={3} shadowOffsetY={2} shadowOpacity={0.35} />
      <Line points={[-61, -chipHalfHeight + 3, 26, -chipHalfHeight + 3]} stroke="#424943" strokeWidth={1} />
      <Circle x={-58} y={chipHalfHeight - 7} radius={2.1} fill="#9b9f91" />
      <Text x={-51} y={-4} width={70} text="CD4017" fontFamily="monospace" fontSize={10} letterSpacing={0.7} fill="#d6dacd" align="center" />

      <Group x={35} y={-18} scaleX={0.56} scaleY={0.56} listening={false}>
        {logoPaths.map((data, index) => <Path key={index} data={data} fill="#dde2d5" />)}
      </Group>
      <Text x={31} y={12} width={48} text="CYCORE" align="center" fontFamily="sans-serif" fontStyle="bold" fontSize={8} letterSpacing={0.7} fill="#dde2d5" />

      {[-1, 1].flatMap((horizontal) => [-1, 1].map((vertical) => (
        <Group key={`${horizontal}-${vertical}`} x={horizontal * (halfWidth - 9)} y={vertical * pinRowHalfHeight} listening={false}>
          <Circle
            radius={5} stroke="#141a16" strokeWidth={0.8}
            fillLinearGradientStartPoint={{ x: -3, y: -4 }}
            fillLinearGradientEndPoint={{ x: 3, y: 4 }}
            fillLinearGradientColorStops={[0, '#606864', 0.5, '#363d39', 1, '#242a27']}
          />
          <Path
            data="M-.7-2.8H.7V-.7H2.8V.7H.7V2.8H-.7V.7H-2.8V-.7H-.7Z"
            fill="#111713" stroke="#78807a" strokeWidth={0.35} lineJoin="round"
          />
        </Group>
      )))}

      {/* Silkscreen is drawn last, above every trace and lead, including those
          belonging to adjacent pins. A PCB-colored outline keeps it legible. */}
      <Group listening={false}>
        {points.map((point, index) => (
          <Text
            key={index}
            x={point.x - center.x - 8}
            y={point.y - center.y + (index < 8 ? -15 : 9)}
            width={16} text={String(index + 1)} align="center"
            fontFamily="monospace" fontSize={7} fontStyle={index === 0 ? 'bold' : 'normal'}
            fill={index === 0 ? '#f2cb7f' : '#c4cbbf'}
            stroke="#303633" strokeWidth={1.8} fillAfterStrokeEnabled
          />
        ))}
      </Group>
    </Group>
  )
}
