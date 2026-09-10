import { ArrowUpRight, Eraser, Pencil, Square, Trash2, Type } from 'lucide-react'
import { Arrow, Circle, Group, Layer, Line, Rect, Text } from 'react-konva'
import type { Annotation } from '@/domain/annotations'
import type { ViewportState } from '@/domain/types'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

const tools = [ ['text', '文字', Type], ['pen', '画笔', Pencil], ['rectangle', '方框', Square], ['arrow', '箭头', ArrowUpRight] ] as const
const colors = [['红色', '#ef4444'], ['黄色', '#facc15'], ['蓝色', '#2563eb'], ['绿色', '#16a34a'], ['黑色', '#111827'], ['白色', '#ffffff']] as const

export function AnnotationToolbar() {
  const tool = useWorkbenchStore(s => s.annotationTool)
  const style = useWorkbenchStore(s => s.annotationStyle)
  const empty = useWorkbenchStore(s => s.annotations.length === 0)
  const setTool = useWorkbenchStore(s => s.setAnnotationTool)
  const setStyle = useWorkbenchStore(s => s.setAnnotationStyle)
  const clear = useWorkbenchStore(s => s.clearAnnotations)
  return <div className="annotation-toolbar" role="toolbar" aria-label="标注工具">
    <div className="annotation-tool-choices" role="group" aria-label="标注类型">
      {tools.map(([kind, label, Icon]) => <button key={kind} type="button" aria-label={label} aria-pressed={tool === kind} onClick={() => setTool(kind)}><Icon size={17} /><span>{label}</span></button>)}
    </div>
    <div className="annotation-colors" role="group" aria-label="标注颜色">
      {colors.map(([label, color]) => <button key={color} type="button" className="annotation-color" aria-label={label} aria-pressed={style.color === color} style={{ backgroundColor: color }} onClick={() => setStyle({ color })} />)}
    </div>
    <label>粗细<select aria-label="标注粗细" value={style.strokeWidth} onChange={e => setStyle({ strokeWidth: Number(e.target.value) })}>{[2, 3, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    <label>字号<select aria-label="标注字号" value={style.fontSize} onChange={e => setStyle({ fontSize: Number(e.target.value) })}>{[18, 24, 32].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    <button type="button" aria-label="橡皮擦" title="橡皮擦：点击或拖动擦除整个标注" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}><Eraser size={17} /><span>橡皮擦</span></button>
    <button type="button" aria-label="清空标注" disabled={empty} onClick={clear}><Trash2 size={16} /><span>清空</span></button>
  </div>
}

function AnnotationShape({ annotation: a, scale }: { annotation: Annotation; scale: number }) {
  const hitProps = { id: a.id, hitStrokeWidth: Math.max('strokeWidth' in a ? a.strokeWidth : 0, 12 / scale) }
  if (a.kind === 'text') return <Text {...hitProps} x={a.position.x} y={a.position.y} text={a.text} fontSize={a.fontSize} fill={a.color} fontFamily="sans-serif" lineHeight={1.3} />
  if (a.kind === 'pen') return a.points.length === 2
    ? <Circle {...hitProps} x={a.points[0]} y={a.points[1]} radius={a.strokeWidth / 2} fill={a.color} hitFunc={(context, shape) => {
      // Tiny dots need an opaque hit area even when the board is zoomed out.
      context.beginPath()
      context.arc(0, 0, Math.max(a.strokeWidth / 2, 6 / scale), 0, Math.PI * 2)
      context.closePath()
      context.fillShape(shape)
    }} />
    : <Line {...hitProps} points={a.points} stroke={a.color} strokeWidth={a.strokeWidth} lineCap="round" lineJoin="round" />
  if (a.kind === 'rectangle') return <Rect {...hitProps} fillEnabled={false} x={a.position.x} y={a.position.y} width={a.width} height={a.height} stroke={a.color} strokeWidth={a.strokeWidth} />
  return <Arrow {...hitProps} points={[a.from.x, a.from.y, a.to.x, a.to.y]} stroke={a.color} fill={a.color} strokeWidth={a.strokeWidth} pointerLength={a.strokeWidth * 4} pointerWidth={a.strokeWidth * 3} lineCap="round" lineJoin="round" />
}

export function AnnotationLayer({ viewport, draft, erasedIds }: { viewport: ViewportState; draft: Annotation | null; erasedIds: ReadonlySet<string> }) {
  const annotations = useWorkbenchStore(s => s.annotations)
  const erasing = useWorkbenchStore(s => s.annotationMode && s.annotationTool === 'eraser')
  return <Layer listening={erasing}><Group x={viewport.x} y={viewport.y} scaleX={viewport.scale} scaleY={viewport.scale}>
    {annotations.filter(a => !erasedIds.has(a.id)).map(a => <AnnotationShape key={a.id} annotation={a} scale={viewport.scale} />)}
    {draft && <AnnotationShape annotation={draft} scale={viewport.scale} />}
  </Group></Layer>
}
