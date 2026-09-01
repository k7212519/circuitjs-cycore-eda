import { AlertTriangle, Gauge, RotateCw, Trash2 } from 'lucide-react'
import { boardPointLabel } from '@/domain/board'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

const names = {
  resistor: '电阻', capacitor: '电容', led: '发光二极管', diode: '二极管', npn: 'NPN 三极管', pnp: 'PNP 三极管',
}

function formatEngineering(value: number, unit: string): string {
  const abs = Math.abs(value)
  if (abs === 0) return `0 ${unit}`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)} M${unit}`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)} k${unit}`
  if (abs < 1e-6) return `${(value * 1e9).toFixed(2)} n${unit}`
  if (abs < 1e-3) return `${(value * 1e6).toFixed(2)} µ${unit}`
  if (abs < 1) return `${(value * 1e3).toFixed(2)} m${unit}`
  return `${value.toFixed(3)} ${unit}`
}

export function Inspector() {
  const selectedId = useWorkbenchStore((state) => state.selectedId)
  const document = useWorkbenchStore((state) => state.document)
  const reading = useWorkbenchStore((state) => selectedId ? state.readings[selectedId] : undefined)
  const issues = useWorkbenchStore((state) => state.issues)
  const updateSelected = useWorkbenchStore((state) => state.updateSelected)
  const deleteSelected = useWorkbenchStore((state) => state.deleteSelected)
  const rotateSelected = useWorkbenchStore((state) => state.rotateSelected)

  const component = document.components.find((item) => item.id === selectedId)
  const wire = document.wires.find((item) => item.id === selectedId)
  const selectedIssues = issues.filter((issue) => !issue.targetId || issue.targetId === selectedId)

  return (
    <aside className="inspector panel" aria-label="属性与测量">
      <div className="panel-heading">
        <span className="eyebrow">INSPECT / 03</span>
        <h2>属性与测量</h2>
        <p>{component || wire ? '正在检查选中对象' : '选择元件查看实时数据'}</p>
      </div>

      {!component && !wire ? (
        <div className="empty-inspector">
          <Gauge size={42} strokeWidth={1.2} />
          <strong>等待选中元件</strong>
          <p>单击元件后，这里会显示参数、引脚节点、电压与电流。</p>
        </div>
      ) : null}

      {component ? (
        <div className="property-stack">
          <div className="selected-summary">
            <span className={`component-badge badge-${component.kind}`}>{component.kind.toUpperCase()}</span>
            <div><strong>{names[component.kind]}</strong><small>{component.label}</small></div>
          </div>

          <label className="field-label">
            <span>{component.kind === 'capacitor' ? '容量 (F)' : component.kind === 'npn' || component.kind === 'pnp' ? '放大倍数 β' : '数值'}</span>
            <input
              type="number"
              min="0.000000001"
              step="any"
              value={component.value}
              onChange={(event) => updateSelected({ value: Math.max(Number(event.target.value), 1e-12) })}
            />
          </label>

          {component.kind === 'led' ? (
            <label className="field-label color-field">
              <span>发光颜色</span>
              <input type="color" value={component.color ?? '#ef3d32'} onChange={(event) => updateSelected({ color: event.target.value })} />
            </label>
          ) : null}

          <div className="pin-table">
            <div className="section-label">PIN MAP</div>
            {component.pins.map((pin, index) => (
              <div className="pin-row" key={pin}>
                <span>P{index + 1}</span><strong>{boardPointLabel(pin)}</strong>
              </div>
            ))}
          </div>

          <div className="meter-grid">
            <div className="meter-card"><span>VOLTAGE</span><strong>{formatEngineering(reading?.voltage ?? 0, 'V')}</strong></div>
            <div className="meter-card"><span>CURRENT</span><strong>{formatEngineering(reading?.current ?? 0, 'A')}</strong></div>
            <div className="meter-card wide"><span>POWER</span><strong>{formatEngineering(reading?.power ?? 0, 'W')}</strong></div>
          </div>

          <div className="object-actions">
            <button type="button" onClick={rotateSelected}><RotateCw size={15} />旋转 90°</button>
            <button type="button" className="danger" onClick={deleteSelected}><Trash2 size={15} />删除</button>
          </div>
        </div>
      ) : null}

      {wire ? (
        <div className="property-stack">
          <div className="selected-summary">
            <span className="component-badge badge-wire">WIRE</span>
            <div><strong>跳线</strong><small>{boardPointLabel(wire.from)} → {boardPointLabel(wire.to)}</small></div>
          </div>
          <div className="wire-preview" style={{ '--wire': wire.color } as React.CSSProperties} />
          <button type="button" className="danger full-button" onClick={deleteSelected}><Trash2 size={15} />删除导线</button>
        </div>
      ) : null}

      <div className="diagnostics">
        <div className="section-label"><AlertTriangle size={13} /> 诊断</div>
        {selectedIssues.length ? selectedIssues.map((issue, index) => (
          <div className={`issue issue-${issue.level}`} key={`${issue.code}-${index}`}>
            <span />{issue.message}
          </div>
        )) : <div className="issue issue-ok"><span />当前接线未发现错误</div>}
      </div>
    </aside>
  )
}
