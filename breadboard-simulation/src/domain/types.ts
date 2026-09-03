export type ComponentKind = 'resistor' | 'capacitor' | 'led' | 'diode' | 'switch' | 'button' | 'npn' | 'pnp' | 'seven-segment'
export type TwoPinComponentKind = Exclude<ComponentKind, 'npn' | 'pnp' | 'seven-segment'>
export type ToolKind = ComponentKind | 'wire' | 'select' | 'pan'
export type ResistorBandCount = 4 | 5
export type ComponentVariant = 'ceramic' | 'electrolytic' | 'small-signal' | 'rectifier' | 'schottky' | 'common-cathode' | 'common-anode'
export type DiodeVariant = Extract<ComponentVariant, 'small-signal' | 'rectifier' | 'schottky'>

export interface Point {
  x: number
  y: number
}

export interface Hole extends Point {
  id: string
  nodeId: string
  region: 'terminal' | 'rail'
  zone?: number
  row?: number
  column: number
  polarity?: 'positive' | 'negative'
  side?: 'top' | 'bottom'
}

export interface BreadboardComponent {
  id: string
  kind: ComponentKind
  pins: string[]
  rotation: 0 | 90 | 180 | 270
  value: number
  color?: string
  label?: string
  bandCount?: ResistorBandCount
  variant?: ComponentVariant
}

export type ComponentPlacementOptions = Pick<BreadboardComponent, 'value' | 'color' | 'label' | 'bandCount' | 'variant'>

export interface BreadboardWire {
  id: string
  from: string
  to: string
  color: string
}

export interface ViewportState {
  x: number
  y: number
  scale: number
}

export interface BreadboardDocument {
  schemaVersion: 1
  boardId: 'dual-830-trimmed-v1'
  projectName: string
  components: BreadboardComponent[]
  wires: BreadboardWire[]
  viewport: ViewportState
}

export interface SimulationReading {
  voltage: number
  current: number
  power: number
  pinVoltages: number[]
  pinCurrents: number[]
  brightness?: number
  segmentBrightness?: number[]
}

export type SimulationStatus = 'connecting' | 'ready' | 'running' | 'paused' | 'offline' | 'error'

export interface ValidationIssue {
  level: 'error' | 'warning'
  code: 'SHORT_CIRCUIT' | 'SAME_NODE' | 'FLOATING_PIN' | 'OCCUPIED_HOLE' | 'ENGINE_ERROR'
  message: string
  targetId?: string
}
