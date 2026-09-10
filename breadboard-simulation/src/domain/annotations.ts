import type { Point } from './types'

export type AnnotationTool = 'text' | 'pen' | 'rectangle' | 'arrow' | 'eraser'
export interface AnnotationStyle {
  color: string
  strokeWidth: number
  fontSize: number
}
interface AnnotationBase { id: string; color: string }
export type Annotation =
  | (AnnotationBase & { kind: 'text'; position: Point; text: string; fontSize: number })
  | (AnnotationBase & { kind: 'pen'; points: number[]; strokeWidth: number })
  | (AnnotationBase & { kind: 'rectangle'; position: Point; width: number; height: number; strokeWidth: number })
  | (AnnotationBase & { kind: 'arrow'; from: Point; to: Point; strokeWidth: number })

export const defaultAnnotationStyle: AnnotationStyle = { color: '#ef4444', strokeWidth: 3, fontSize: 24 }

export function drawAnnotation(tool: Exclude<AnnotationTool, 'text' | 'eraser'>, start: Point, end: Point, style: AnnotationStyle, id: string): Annotation {
  const base = { id, color: style.color, strokeWidth: style.strokeWidth }
  if (tool === 'pen') return { ...base, kind: tool, points: [start.x, start.y] }
  if (tool === 'arrow') return { ...base, kind: tool, from: start, to: end }
  return { ...base, kind: tool, position: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) }, width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }
}
