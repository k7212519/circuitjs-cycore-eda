import { Circle, Group, Line, Path, Rect, Text } from 'react-konva'
import { SENSOR_MODELS, sensorPcbTop, sensorPinLocal, type ExternalSensor } from '@/domain/sensors'

// All bodies and terminal hit targets share the catalog's local coordinates.
export function SensorBody({ sensor, selected = false, invalid = false }: { sensor: ExternalSensor; selected?: boolean; invalid?: boolean }) {
  const m = SENSOR_MODELS[sensor.kind], w = m.width, h = m.height, kind = sensor.kind
  const pcbTop = sensorPcbTop(kind)
  const hasPcb = kind !== 'motor' && kind !== 'buzzer'
  const metal = (x: number, y: number, radius: number) => <Group x={x} y={y}>
    <Circle radius={radius} fill="#adb9bb" stroke="#e7edeb" strokeWidth={3} />
    <Circle radius={radius - 5} fill="#384448" stroke="#76858a" strokeWidth={2} />
    {Array.from({ length: 7 }, (_, i) => <Line key={i} points={[-radius + 9, (i - 3) * 4, radius - 9, (i - 3) * 4]} stroke="#839398" strokeWidth={1} />)}
  </Group>
  const simple = !['dht11', 'hc-sr04', 'motor', 'sg90', 'traffic-light', 'relay', 'potentiometer', 'mq2', 'hc-sr501', 'buzzer'].includes(kind)
  return <Group rotation={sensor.rotation} listening={false}>
    {/* Render terminal hardware behind the PCB and motor body; labels stay above. */}
    {m.pins.map((name, pin) => {
      const p = sensorPinLocal(sensor, pin), top = p.direction.y < 0
      return <Group key={`terminal-${name}`}>
        {hasPcb && <Rect x={p.x - 5} y={top ? p.y : h / 2 - 4} width={10} height={16} fill="#232f2d" />}
        <Line points={[p.x, kind === 'motor' ? 2 : kind === 'buzzer' ? 22 : p.y - p.direction.y * 12, p.x, p.y]} stroke={kind === 'buzzer' ? '#bdc3c5' : '#ddbe77'} strokeWidth={kind === 'buzzer' ? 3 : 5} />
      </Group>
    })}
    {hasPcb && <Rect x={-w / 2} y={pcbTop} width={w} height={h / 2 - pcbTop} cornerRadius={5} fill={m.color} stroke={invalid ? '#ff5a50' : selected ? '#f5b83b' : '#102f3b'} strokeWidth={selected || invalid ? 3 : 2} shadowColor="#000" shadowOpacity={0.28} shadowBlur={6} shadowOffsetY={3} />}
    {simple && <>
      {[-17, -10, -3, 4].map(x => <Line key={x} points={[x, 13, x, 34]} stroke="#b7c2be" strokeWidth={2} />)}
      <Rect x={-21} y={17} width={27} height={14} fill="#111516" cornerRadius={2} />
      <Group x={w / 2 - 29} y={-14}>
        <Rect width={19} height={19} fill="#247fd7" stroke="#80b6e3" cornerRadius={2} />
        <Circle x={9.5} y={9.5} radius={5} fill="#d6d8bd" />
        <Line points={[6, 9.5, 13, 9.5]} stroke="#435159" strokeWidth={2} />
      </Group>
      <Circle x={-w / 2 + 10} y={3} radius={3} fill="#923426" stroke="#c6ad80" />
    </>}
    {kind === 'dht11' && <>
      <Rect x={-29} y={-h / 2 + 7} width={58} height={63} fill="#32a0ce" stroke="#76c9ec" cornerRadius={4} />
      {Array.from({ length: 6 }, (_, i) => <Rect key={i} x={-22} y={-h / 2 + 15 + i * 8} width={44} height={3} fill="#12618b" cornerRadius={1} />)}
    </>}
    {kind === 'hc-sr04' && <>{metal(-43, -5, 29)}{metal(43, -5, 29)}</>}
    {(kind === 'sound' || kind === 'mq2') && metal(0, kind === 'mq2' ? -h / 2 + 40 : -h / 2 + 24, kind === 'mq2' ? 33 : 20)}
    {kind === 'light' && <>
      <Circle x={-6} y={-h / 2 + 17} radius={17} fill="#e5c382" stroke="#ad7b3e" strokeWidth={2} />
      <Line points={[-17, -47, 3, -47, 3, -42, -16, -42, -16, -37, 4, -37, 4, -32, -16, -32]} stroke="#995c43" strokeWidth={2} />
    </>}
    {(kind === 'thermistor' || kind === 'hall' || kind === 'flame') && <>
      <Line points={[-6, pcbTop + 8, -6, -h / 2 + 12, 6, -h / 2 + 12, 6, pcbTop + 8]} stroke="#bdc3b7" strokeWidth={2} />
      <Circle y={-h / 2 + 10} radius={10} fill={kind === 'thermistor' ? '#3d4245' : '#192022'} stroke="#66756f" strokeWidth={2} />
    </>}
    {kind === 'obstacle' && [-18, 18].map((x, i) => <Group x={x} y={-h / 2 + 15} key={x}><Line points={[-4, 12, -4, 30, 4, 30, 4, 12]} stroke="#bdc3b7" strokeWidth={2} /><Rect x={-10} y={-15} width={20} height={31} cornerRadius={8} fill={i ? '#202629' : '#c9e0dd'} stroke="#829a99" strokeWidth={2} /><Line points={[-4, -10, -4, 5]} stroke="#fff" opacity={0.45} /></Group>)}
    {kind === 'vibration' && <Rect x={-25} y={-h / 2} width={50} height={25} cornerRadius={10} fill="#2475bb" stroke="#64aed7" strokeWidth={2} />}
    {kind === 'hc-sr501' && <Circle y={-9} radius={39} fill="#e8ece3" stroke="#a9b8b0" strokeWidth={3} />}
    {kind === 'motor' && <>
      {/* Top view: yellow propeller over the round 130 motor end cap. */}
      <Circle y={-18} radius={23} fill="#bac5c1" stroke="#687977" strokeWidth={2} />
      <Circle y={-18} radius={17} fill="#7d8d88" />
      {[0, 120, 240].map(angle => <Group key={angle} y={-18} rotation={angle}>
        <Path data="M -5 -5 C -19 -12 -31 -27 -22 -37 C -12 -47 14 -43 18 -34 C 22 -24 8 -11 5 -4 Z" fill="#f6d332" stroke={invalid ? '#ff5a50' : selected ? '#ffe88a' : '#b88d13'} strokeWidth={2} />
        <Path data="M -17 -33 C -8 -39 5 -37 11 -32" stroke="#fff09a" strokeWidth={2} lineCap="round" />
      </Group>)}
      <Circle y={-18} radius={10} fill="#edbd1e" stroke="#ac810c" strokeWidth={2} />
      <Circle y={-18} radius={3} fill="#737d78" />
    </>}
    {kind === 'buzzer' && <>
      <Circle radius={37} fill="#151619" stroke={invalid ? '#ff5a50' : selected ? '#f5b83b' : '#08090a'} strokeWidth={2} shadowColor="#000" shadowOpacity={0.3} shadowBlur={6} shadowOffsetY={3} />
      <Circle y={-3} radius={33} fillLinearGradientStartPoint={{ x: -25, y: -30 }} fillLinearGradientEndPoint={{ x: 24, y: 30 }} fillLinearGradientColorStops={[0, '#424448', 0.45, '#292b2e', 1, '#1d1e21']} stroke="#535559" strokeWidth={1} />
      <Circle y={-3} radius={8} fill="#08090a" stroke="#17181a" strokeWidth={2} />
      <Text x={-29} y={-12} width={18} height={18} verticalAlign="middle" align="center" text="+" fontSize={17} fontStyle="bold" fill="#c9cbcc" />
    </>}
    {kind === 'sg90' && <>
      <Rect x={-40} y={-44} width={80} height={67} cornerRadius={6} fill="#255397" stroke="#5494d4" strokeWidth={2} />
      <Circle y={-17} radius={22} fill="#163b72" stroke="#86b4e1" />
      <Rect x={-39} y={-25} width={78} height={16} cornerRadius={8} fill="#e5e5dc" stroke="#929d9c" />
      <Circle y={-17} radius={8} fill="#b6c0bb" stroke="#5c6b70" />
      {[-29, 29].map(x => <Circle key={x} x={x} y={-17} radius={3} fill="#465967" />)}
    </>}
    {kind === 'traffic-light' && <>
      <Rect x={-25} y={-h / 2 + 12} width={50} height={121} cornerRadius={12} fill="#192122" stroke="#43514d" />
      {['#d34b41', '#deb83f', '#459a65'].map((color, i) => <Group key={color} y={-h / 2 + 34 + i * 38}><Circle radius={16} fill="#111a19" /><Circle radius={12} fill={color} /><Circle x={-4} y={-4} radius={4} fill="#fff" opacity={0.18} /></Group>)}
    </>}
    {kind === 'relay' && <>
      <Rect x={-25} y={-20} width={50} height={62} fill="#1671b9" stroke="#68a5ce" cornerRadius={3} />
      <Rect x={-26} y={-h / 2 + 19} width={52} height={23} fill="#3489ba" stroke="#72b0cf" cornerRadius={2} />
      {[-18, 0, 18].map(x => <Group key={x} x={x} y={-h / 2 + 30}><Circle radius={5} fill="#b9c1ba" /><Line points={[-3, 0, 3, 0]} stroke="#46585a" strokeWidth={2} /></Group>)}
    </>}
    {kind === 'potentiometer' && <>
      <Circle y={-10} radius={34} fill="#999f99" stroke="#d7dbca" strokeWidth={2} />
      <Circle y={-10} radius={28} fill="#283031" stroke="#454f4c" strokeWidth={4} />
      {Array.from({ length: 16 }, (_, i) => <Line key={i} x={0} y={-10} rotation={i * 22.5} points={[0, -22, 0, -27]} stroke="#87938c" strokeWidth={2} />)}
      <Line points={[0, -12, 0, -32]} stroke="#eee5c8" strokeWidth={3} />
    </>}
    {m.pins.map((name, pin) => {
      const p = sensorPinLocal(sensor, pin), top = p.direction.y < 0
      return <Group key={name}>
        <Text x={p.x - 13} y={kind === 'motor' ? 35 : kind === 'buzzer' ? p.y + 4 : top ? pcbTop + 5 : h / 2 - 14} width={26} align="center" fontSize={7} text={name} fill="#fff0bd" />
      </Group>
    })}
  </Group>
}
