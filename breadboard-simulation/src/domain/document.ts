import { z } from 'zod'
import { defaultPinCount, holeById, isLegacyCd4017Footprint, rigidModulePlacementFromLowerPin } from './board'
import { occupiedHoles } from './validation'
import type { BreadboardDocument } from './types'

const componentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['resistor', 'capacitor', 'led', 'diode', 'switch', 'button', 'npn', 'pnp', 'seven-segment', 'cd4017']),
  pins: z.array(z.string()).min(2).max(16),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  value: z.number().positive(),
  color: z.string().optional(),
  label: z.string().optional(),
  bandCount: z.union([z.literal(4), z.literal(5)]).optional(),
  variant: z.enum(['ceramic', 'electrolytic', 'small-signal', 'rectifier', 'schottky', 'common-cathode', 'common-anode']).optional(),
}).superRefine((component, context) => {
  const expected = defaultPinCount(component.kind)
  if (component.pins.length !== expected) {
    context.addIssue({
      code: 'custom',
      path: ['pins'],
      message: `${component.kind} requires exactly ${expected} pins`,
    })
  }
})

const wireSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  color: z.string().min(1),
})

export const breadboardDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  boardId: z.literal('dual-830-trimmed-v1'),
  projectName: z.string().min(1).max(100),
  components: z.array(componentSchema),
  wires: z.array(wireSchema),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    scale: z.number().min(0.2).max(4),
  }),
})

export function createEmptyDocument(projectName = '未命名实验'): BreadboardDocument {
  return {
    schemaVersion: 1,
    boardId: 'dual-830-trimmed-v1',
    projectName,
    components: [],
    wires: [],
    viewport: { x: 0, y: 0, scale: 1 },
  }
}

export function parseDocument(value: unknown): BreadboardDocument {
  const document = breadboardDocumentSchema.parse(value) as BreadboardDocument
  compactCd4017Footprints(document)
  return document
}

// Only change owned document copies, and only move pins within their existing
// intrinsic nodes. Occupied target holes leave the legacy footprint intact.
export function compactCd4017Footprints(document: BreadboardDocument): void {
  for (const component of document.components) {
    if (component.kind !== 'cd4017' || !isLegacyCd4017Footprint(component.pins)) continue
    const anchor = holeById.get(component.pins[0]!)!
    const occupied = occupiedHoles(document, component.id)
    const lowerAnchorAbove = holeById.get(`t-${anchor.zone}-${(anchor.row ?? 0) - 1}-${anchor.column}`)
    for (const candidate of [anchor, lowerAnchorAbove]) {
      if (!candidate) continue
      const pins = rigidModulePlacementFromLowerPin('cd4017', candidate, occupied)
      if (!pins || pins.some((pin, index) => holeById.get(pin)?.nodeId !== holeById.get(component.pins[index]!)?.nodeId)) continue
      component.pins = pins
      break
    }
  }
}

export function serializeDocument(document: BreadboardDocument): string {
  return JSON.stringify(breadboardDocumentSchema.parse(document))
}
