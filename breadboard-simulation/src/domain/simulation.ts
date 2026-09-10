import type { BreadboardComponent, BreadboardDocument } from './types'

// Keep one explicit capability list for netlist construction and the reading bridge.
// New visual-only models must not implicitly become simulated components.
const simulatedKinds = new Set<BreadboardComponent['kind']>([
  'resistor', 'capacitor', 'led', 'diode', 'switch', 'button',
  'npn', 'pnp', 'seven-segment', 'cd4017', 'cd4026',
])

export function isSimulationComponent(component: Pick<BreadboardComponent, 'kind'>): boolean {
  return simulatedKinds.has(component.kind)
}

export function simulationDocument(document: BreadboardDocument): BreadboardDocument {
  return {
    ...document,
    components: document.components.filter(isSimulationComponent),
    // External modules and their visual connections do not create solver nodes,
    // loads, supplies, or validation failures. Ordinary breadboard wires remain.
    sensors: [],
    sensorWires: [],
  }
}
