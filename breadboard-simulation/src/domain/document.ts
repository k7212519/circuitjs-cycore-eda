import { z } from 'zod'
import type { BreadboardDocument } from './types'

const componentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['resistor', 'capacitor', 'led', 'diode', 'switch', 'button', 'npn', 'pnp']),
  pins: z.array(z.string()).min(2).max(3),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  value: z.number().positive(),
  color: z.string().optional(),
  label: z.string().optional(),
  bandCount: z.union([z.literal(4), z.literal(5)]).optional(),
  variant: z.enum(['ceramic', 'electrolytic', 'small-signal', 'rectifier', 'schottky']).optional(),
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
  return breadboardDocumentSchema.parse(value) as BreadboardDocument
}

export function serializeDocument(document: BreadboardDocument): string {
  return JSON.stringify(breadboardDocumentSchema.parse(document))
}
