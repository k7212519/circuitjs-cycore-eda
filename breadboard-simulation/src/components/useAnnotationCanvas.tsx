import { useCallback, useEffect, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from 'react'
import { drawAnnotation, type Annotation, type AnnotationStyle, type AnnotationTool } from '@/domain/annotations'
import type Konva from 'konva'
import type { Point } from '@/domain/types'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

type Gesture = { pointerId: number; start: Point; tool: Exclude<AnnotationTool, 'text' | 'eraser'>; style: AnnotationStyle; annotation: Annotation }
type TextDraft = { position: Point; style: AnnotationStyle; text: string }

export function useAnnotationCanvas(stageRef: RefObject<Konva.Stage | null>) {
  const enabled = useWorkbenchStore(s => s.annotationMode)
  const tool = useWorkbenchStore(s => s.annotationTool)
  const viewport = useWorkbenchStore(s => s.document.viewport)
  const surface = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const eraser = useRef<{ pointerId: number; previous: Point; ids: Set<string> } | null>(null)
  const [erasedIds, setErasedIds] = useState<ReadonlySet<string>>(new Set())
  const textRef = useRef<TextDraft | null>(null)
  const pointers = useRef(new Map<number, Point>())
  const pan = useRef<Point | null>(null)
  const [draft, setDraft] = useState<Annotation | null>(null)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)

  const cancel = useCallback(() => {
    const hadDraft = gesture.current !== null || eraser.current !== null || textRef.current !== null
    gesture.current = null
    eraser.current = null
    setErasedIds(new Set())
    textRef.current = null
    pan.current = null
    for (const pointerId of pointers.current.keys()) {
      if (surface.current?.hasPointerCapture(pointerId)) surface.current.releasePointerCapture(pointerId)
    }
    pointers.current.clear()
    setDraft(null)
    setTextDraft(null)
    return hadDraft
  }, [])

  useEffect(() => useWorkbenchStore.subscribe((state, previous) => {
    if (state.annotationMode !== previous.annotationMode || state.annotationTool !== previous.annotationTool || state.annotationSession !== previous.annotationSession || state.annotations !== previous.annotations) cancel()
  }), [cancel])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!useWorkbenchStore.getState().annotationMode || event.key !== 'Escape' || event.isComposing) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!cancel()) useWorkbenchStore.getState().setAnnotationMode(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [cancel])

  useEffect(() => {
    const element = surface.current
    if (!enabled || !element) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (textRef.current || pointers.current.size) return
      const rect = element.getBoundingClientRect()
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const state = useWorkbenchStore.getState(), current = state.document.viewport
      const scale = Math.min(3.5, Math.max(0.25, current.scale * (event.deltaY > 0 ? 0.9 : 1.1)))
      const ratio = scale / current.scale
      state.setViewport({ x: screen.x - (screen.x - current.x) * ratio, y: screen.y - (screen.y - current.y) * ratio, scale })
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [enabled])

  const screenPoint = (event: ReactPointerEvent): Point => {
    const rect = surface.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const worldPoint = (screen: Point): Point => {
    const v = useWorkbenchStore.getState().document.viewport
    return { x: (screen.x - v.x) / v.scale, y: (screen.y - v.y) / v.scale }
  }
  const updateGesture = (screen: Point) => {
    const current = gesture.current
    if (!current) return
    const end = worldPoint(screen)
    if (current.annotation.kind === 'pen') {
      const points = current.annotation.points
      if (Math.hypot(end.x - points[points.length - 2]!, end.y - points[points.length - 1]!) < 0.5) return
      current.annotation = { ...current.annotation, points: [...points, end.x, end.y] }
    } else current.annotation = drawAnnotation(current.tool, current.start, end, current.style, current.annotation.id)
    setDraft(current.annotation)
  }
  const updateEraser = (screen: Point) => {
    const current = eraser.current
    const layer = stageRef.current?.getLayers().at(-1)
    if (!current || !layer) return
    // Refresh hits after a cancelled preview, without waiting for the next animation frame.
    layer.drawHit()
    // Sample the travelled segment so quick strokes also hit thin lines.
    const steps = Math.max(1, Math.ceil(Math.hypot(screen.x - current.previous.x, screen.y - current.previous.y) / 6))
    const before = current.ids.size
    for (let step = 1; step <= steps; step++) {
      const point = { x: current.previous.x + (screen.x - current.previous.x) * step / steps, y: current.previous.y + (screen.y - current.previous.y) * step / steps }
      const hit = layer.getIntersection(point)
      if (hit) current.ids.add(hit.id())
    }
    current.previous = screen
    if (current.ids.size !== before) setErasedIds(new Set(current.ids))
  }
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (textRef.current || (event.button !== 0 && event.button !== 1)) return
    const screen = screenPoint(event)
    pointers.current.set(event.pointerId, screen)
    event.currentTarget.setPointerCapture(event.pointerId)
    if (pointers.current.size >= 2) { gesture.current = null; eraser.current = null; setErasedIds(new Set()); pan.current = null; setDraft(null); return }
    if (event.button === 1) { pan.current = screen; return }
    const start = worldPoint(screen), state = useWorkbenchStore.getState()
    if (state.annotationTool === 'eraser') {
      eraser.current = { pointerId: event.pointerId, previous: screen, ids: new Set() }
      updateEraser(screen)
      return
    }
    if (state.annotationTool === 'text') {
      textRef.current = { position: start, style: { ...state.annotationStyle }, text: '' }
      setTextDraft(textRef.current)
      return
    }
    const annotation = drawAnnotation(state.annotationTool, start, start, state.annotationStyle, crypto.randomUUID())
    gesture.current = { pointerId: event.pointerId, start, tool: state.annotationTool, style: { ...state.annotationStyle }, annotation }
    setDraft(annotation)
  }
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    const screen = screenPoint(event)
    const previous = [...pointers.current.values()]
    pointers.current.set(event.pointerId, screen)
    if (textRef.current) return
    if (pointers.current.size === 2) {
      const next = [...pointers.current.values()]
      const center = (points: Point[]) => ({ x: (points[0]!.x + points[1]!.x) / 2, y: (points[0]!.y + points[1]!.y) / 2 })
      const distance = (points: Point[]) => Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y)
      const oldDistance = distance(previous)
      if (oldDistance < 1) return
      const before = center(previous), after = center(next), world = worldPoint(before)
      const state = useWorkbenchStore.getState(), current = state.document.viewport
      const scale = Math.min(3.5, Math.max(0.25, current.scale * distance(next) / oldDistance))
      state.setViewport({ x: after.x - world.x * scale, y: after.y - world.y * scale, scale })
    } else if (pan.current) {
      const state = useWorkbenchStore.getState(), current = state.document.viewport
      state.setViewport({ ...current, x: current.x + screen.x - pan.current.x, y: current.y + screen.y - pan.current.y })
      pan.current = screen
    } else if (eraser.current?.pointerId === event.pointerId) updateEraser(screen)
    else if (gesture.current?.pointerId === event.pointerId) updateGesture(screen)
  }
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (eraser.current?.pointerId === event.pointerId) {
      // A click erases only the topmost object; do not hit again at the same
      // point after its preview disappears and accidentally erase underneath.
      const screen = screenPoint(event)
      if (Math.hypot(screen.x - eraser.current.previous.x, screen.y - eraser.current.previous.y) > 0) updateEraser(screen)
      const ids = [...eraser.current.ids]
      eraser.current = null
      setErasedIds(new Set())
      useWorkbenchStore.getState().eraseAnnotations(ids)
    }
    if (gesture.current?.pointerId === event.pointerId) {
      updateGesture(screenPoint(event))
      const annotation = gesture.current.annotation
      gesture.current = null
      setDraft(null)
      const valid = annotation.kind === 'pen' || (annotation.kind === 'rectangle' && annotation.width > 0 && annotation.height > 0) || (annotation.kind === 'arrow' && Math.hypot(annotation.to.x - annotation.from.x, annotation.to.y - annotation.from.y) > 0)
      if (valid) useWorkbenchStore.getState().addAnnotation(annotation)
    }
    pointers.current.delete(event.pointerId)
    pan.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const commitText = () => {
    const current = textRef.current
    if (current?.text.trim()) useWorkbenchStore.getState().addAnnotation({ id: crypto.randomUUID(), kind: 'text', position: current.position, text: current.text, color: current.style.color, fontSize: current.style.fontSize })
    cancel()
  }

  const overlay = enabled && <>
    <div ref={surface} className={`annotation-surface annotation-${tool}`} data-testid="annotation-surface"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel}
      onLostPointerCapture={event => { if (pointers.current.has(event.pointerId)) cancel() }} onContextMenu={event => event.preventDefault()} />
    {textDraft && <div className="annotation-text-editor" style={{
      left: `clamp(0px, ${viewport.x + textDraft.position.x * viewport.scale}px, max(0px, calc(100% - 280px)))`,
      top: `clamp(0px, ${viewport.y + textDraft.position.y * viewport.scale}px, max(0px, calc(100% - 190px)))`,
    }}>
      <textarea autoFocus aria-label="标注文字" placeholder="输入课堂标注…" value={textDraft.text}
        style={{ color: textDraft.style.color, fontSize: Math.max(12, textDraft.style.fontSize * viewport.scale) }}
        onChange={event => { const next = { ...textDraft, text: event.target.value }; textRef.current = next; setTextDraft(next) }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); commitText() } }} />
      <div><span>Enter 换行 · Esc 取消</span><button type="button" onClick={commitText}>完成</button></div>
    </div>}
  </>
  return { draft, erasedIds, overlay, cancel, editingText: textDraft !== null }
}
