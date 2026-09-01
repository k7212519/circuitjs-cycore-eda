import { Cable, CircleDot, Lightbulb, Minus, Radio, ToggleRight, Zap } from 'lucide-react'
import type { ToolKind } from '@/domain/types'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

const items: Array<{ kind: ToolKind; label: string; meta: string; icon: typeof Cable }> = [
  { kind: 'wire', label: '导线', meta: '点选两个孔', icon: Cable },
  { kind: 'resistor', label: '电阻', meta: '1 kΩ', icon: Radio },
  { kind: 'capacitor', label: '电容', meta: '100 nF', icon: CircleDot },
  { kind: 'led', label: 'LED', meta: '红色 · 2V', icon: Lightbulb },
  { kind: 'diode', label: '二极管', meta: '1N4148', icon: Minus },
  { kind: 'npn', label: 'NPN 三极管', meta: '2N3904', icon: ToggleRight },
  { kind: 'pnp', label: 'PNP 三极管', meta: '2N3906', icon: ToggleRight },
]

export function Palette() {
  const activeTool = useWorkbenchStore((state) => state.activeTool)
  const setActiveTool = useWorkbenchStore((state) => state.setActiveTool)
  const wireColor = useWorkbenchStore((state) => state.wireColor)
  const setWireColor = useWorkbenchStore((state) => state.setWireColor)

  const startDrag = (event: React.DragEvent, kind: ToolKind) => {
    if (kind === 'wire' || kind === 'select') return
    event.dataTransfer.setData('application/x-breadboard-component', kind)
    event.dataTransfer.effectAllowed = 'copy'
    setActiveTool(kind)
  }

  return (
    <aside className="palette panel" aria-label="元器件库">
      <div className="panel-heading">
        <span className="eyebrow">PARTS / 01</span>
        <h2>元器件库</h2>
        <p>拖到面包板，或点选后在孔位放置。</p>
      </div>

      <div className="parts-list">
        {items.map(({ kind, label, meta, icon: Icon }, index) => (
          <button
            key={kind}
            type="button"
            className={`part-card ${activeTool === kind ? 'is-active' : ''}`}
            draggable={kind !== 'wire'}
            onDragStart={(event) => startDrag(event, kind)}
            onClick={() => setActiveTool(kind)}
            style={{ '--delay': `${index * 35}ms` } as React.CSSProperties}
            data-testid={`part-${kind}`}
          >
            <span className="part-icon"><Icon size={20} strokeWidth={1.6} /></span>
            <span className="part-copy">
              <strong>{label}</strong>
              <small>{meta}</small>
            </span>
            <span className="part-grip" aria-hidden="true">••</span>
          </button>
        ))}
      </div>

      <div className="wire-colors" aria-label="导线颜色">
        <div className="section-label"><Zap size={13} /> 导线色</div>
        <div className="color-row">
          {['#e4523d', '#232a28', '#e8b83f', '#277fbc', '#4a9b65'].map((color) => (
            <button
              type="button"
              key={color}
              className={`color-chip ${wireColor === color ? 'is-active' : ''}`}
              style={{ backgroundColor: color }}
              aria-label={`选择 ${color} 导线`}
              onClick={() => { setWireColor(color); setActiveTool('wire') }}
            />
          ))}
        </div>
      </div>

      <div className="palette-note">
        <span className="note-index">TIP</span>
        <p>同列五孔内部连通；红轨固定 +5V，蓝轨固定 GND。</p>
      </div>
    </aside>
  )
}
