import { AlertTriangle, Cable, Gauge, RotateCw, Settings2, Trash2 } from 'lucide-react'
import { boardPointLabel } from '@/domain/board'
import type { ComponentKind, ComponentPlacementOptions, ResistorBandCount, ToolKind } from '@/domain/types'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

const names = {
  resistor: '电阻', capacitor: '电容', led: '发光二极管', diode: '二极管', switch: '开关', button: '按键', npn: 'NPN 三极管', pnp: 'PNP 三极管',
}
const toolNames: Record<Exclude<ToolKind, 'select'>, string> = { wire: '导线', ...names }
const wireColors = ['#e4523d', '#232a28', '#e8b83f', '#277fbc', '#4a9b65']

function compactEngineering(value: number, unit: string): string {
  const scales = [
    { threshold: 1e6, divisor: 1e6, prefix: 'M' },
    { threshold: 1e3, divisor: 1e3, prefix: 'k' },
    { threshold: 1, divisor: 1, prefix: '' },
    { threshold: 1e-3, divisor: 1e-3, prefix: 'm' },
    { threshold: 1e-6, divisor: 1e-6, prefix: 'µ' },
    { threshold: 1e-9, divisor: 1e-9, prefix: 'n' },
    { threshold: 0, divisor: 1e-12, prefix: 'p' },
  ]
  const scale = scales.find((item) => Math.abs(value) >= item.threshold) ?? scales.at(-1)!
  return `${Number((value / scale.divisor).toPrecision(3))} ${scale.prefix}${unit}`
}

function numericValue(raw: string): number {
  const value = Number(raw)
  return Number.isFinite(value) ? Math.max(value, 1e-12) : 1e-12
}

function pinName(kind: ComponentKind, index: number): string {
  if (kind === 'npn' || kind === 'pnp') return ['B', 'C', 'E'][index] ?? `P${index + 1}`
  return `P${index + 1}`
}

function PlacementInspector({ tool }: { tool: Exclude<ToolKind, 'select'> }) {
  const placementOptions = useWorkbenchStore((state) => state.placementOptions)
  const updatePlacementOptions = useWorkbenchStore((state) => state.updatePlacementOptions)
  const wireColor = useWorkbenchStore((state) => state.wireColor)
  const setWireColor = useWorkbenchStore((state) => state.setWireColor)
  const options = tool === 'wire' ? null : placementOptions[tool]
  const placementName = tool === 'capacitor'
    ? options?.variant === 'electrolytic' ? '电解电容' : '瓷片电容'
    : tool === 'led'
      ? options?.label ?? 'LED'
      : tool === 'diode'
        ? `${options?.label ?? ''} 二极管`.trim()
        : tool === 'switch' || tool === 'button'
          ? options?.label ?? toolNames[tool]
        : tool === 'npn' || tool === 'pnp'
          ? `${tool.toUpperCase()} · ${options?.label ?? ''}`.trim()
          : toolNames[tool]

  const update = (kind: ComponentKind, patch: Partial<ComponentPlacementOptions>) => updatePlacementOptions(kind, patch)
  const setValue = (kind: ComponentKind, raw: string, unit: string) => {
    const value = numericValue(raw)
    update(kind, { value, label: compactEngineering(value, unit) })
  }

  return (
    <aside className="inspector panel placement-inspector" aria-label="放置选项">
      <div className="panel-heading">
        <span className="eyebrow">PLACE / 03</span>
        <h2>放置选项</h2>
        <p>设置 {placementName} 参数，然后在面包板选择孔位。</p>
      </div>

      <div className="placement-stack">
        <div className="placement-summary">
          <span className={`placement-icon ${tool === 'wire' ? 'is-wire' : ''}`}>
            {tool === 'wire' ? <Cable size={21} /> : tool.toUpperCase()}
          </span>
          <div><strong>{placementName}</strong><small>类型已在左侧选定，参数将应用到下一个元件</small></div>
        </div>

        {tool === 'wire' ? (
          <div className="option-group">
            <div className="option-label"><span>导线颜色</span><code>{wireColor.toUpperCase()}</code></div>
            <div className="option-color-row">
              {wireColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`option-color ${wireColor === color ? 'is-active' : ''}`}
                  style={{ backgroundColor: color }}
                  aria-label={`导线颜色 ${color}`}
                  aria-pressed={wireColor === color}
                  onClick={() => setWireColor(color)}
                />
              ))}
              <label className="custom-color" title="自定义颜色">
                <input aria-label="自定义导线颜色" type="color" value={wireColor} onChange={(event) => setWireColor(event.target.value)} />
              </label>
            </div>
          </div>
        ) : null}

        {tool === 'resistor' && options ? (
          <>
            <label className="field-label">
              <span>阻值 (Ω)</span>
              <input type="number" min="0.01" step="any" value={options.value} onChange={(event) => setValue('resistor', event.target.value, 'Ω')} />
            </label>
            <div className="option-presets" aria-label="常用阻值">
              {[220, 1000, 10000, 100000].map((value) => (
                <button key={value} type="button" onClick={() => update('resistor', { value, label: compactEngineering(value, 'Ω') })}>{compactEngineering(value, 'Ω')}</button>
              ))}
            </div>
            <div className="option-group">
              <div className="option-label"><span>色环数量</span><code>{options.bandCount ?? 4} BANDS</code></div>
              <div className="segmented-options">
                {([4, 5] as ResistorBandCount[]).map((count) => (
                  <button key={count} type="button" className={(options.bandCount ?? 4) === count ? 'is-active' : ''} aria-pressed={(options.bandCount ?? 4) === count} onClick={() => update('resistor', { bandCount: count })}>{count} 环</button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {tool === 'capacitor' && options ? (
          <>
            <label className="field-label">
              <span>容量 (F)</span>
              <input type="number" min="0.000000000001" step="any" value={options.value} onChange={(event) => setValue('capacitor', event.target.value, 'F')} />
            </label>
            <div className="option-presets" aria-label="常用容量">
              {[10e-9, 100e-9, 1e-6, 10e-6].map((value) => (
                <button key={value} type="button" onClick={() => update('capacitor', { value, label: compactEngineering(value, 'F') })}>{compactEngineering(value, 'F')}</button>
              ))}
            </div>
          </>
        ) : null}

        {(tool === 'npn' || tool === 'pnp') && options ? (
          <label className="field-label">
            <span>放大倍数 β</span>
            <input type="number" min="1" step="1" value={options.value} onChange={(event) => update(tool, { value: numericValue(event.target.value) })} />
          </label>
        ) : null}

        <div className="placement-guide">
          <Settings2 size={16} />
          <div><strong>参数已就绪</strong><span>{tool === 'wire' || tool === 'resistor' || tool === 'capacitor' || tool === 'led' || tool === 'diode' || tool === 'switch' || tool === 'button' ? '从起点孔拖到终点孔完成放置' : '在目标孔位单击完成放置'}</span></div>
        </div>
      </div>
    </aside>
  )
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
  const activeTool = useWorkbenchStore((state) => state.activeTool)
  const selectedIds = useWorkbenchStore((state) => state.selectedIds)
  const document = useWorkbenchStore((state) => state.document)
  const singleSelectedId = selectedIds.length === 1 ? selectedIds[0] : undefined
  const reading = useWorkbenchStore((state) => singleSelectedId ? state.readings[singleSelectedId] : undefined)
  const issues = useWorkbenchStore((state) => state.issues)
  const updateSelected = useWorkbenchStore((state) => state.updateSelected)
  const deleteSelected = useWorkbenchStore((state) => state.deleteSelected)
  const rotateSelected = useWorkbenchStore((state) => state.rotateSelected)
  const contactClosed = useWorkbenchStore((state) => singleSelectedId ? Boolean(state.closedContacts[singleSelectedId]) : false)

  const component = document.components.find((item) => item.id === singleSelectedId)
  const wire = document.wires.find((item) => item.id === singleSelectedId)
  const selectedIssues = issues.filter((issue) => !issue.targetId || issue.targetId === singleSelectedId)

  if (activeTool !== 'select') return <PlacementInspector tool={activeTool} />

  if (selectedIds.length > 1) {
    const selected = new Set(selectedIds)
    const componentCount = document.components.filter((item) => selected.has(item.id)).length
    const wireCount = document.wires.filter((item) => selected.has(item.id)).length
    return (
      <aside className="inspector panel" aria-label="属性与测量">
        <div className="panel-heading">
          <span className="eyebrow">MULTI / 03</span>
          <h2>已选择 {selectedIds.length} 个对象</h2>
          <p>拖动任一已选对象可整体移动。</p>
        </div>
        <div className="property-stack">
          <div className="selected-summary">
            <span className="component-badge badge-wire">{selectedIds.length}</span>
            <div><strong>批量选择</strong><small>{componentCount} 个元器件 · {wireCount} 根导线</small></div>
          </div>
          <button type="button" className="danger full-button" onClick={deleteSelected}><Trash2 size={15} />删除所选对象</button>
        </div>
      </aside>
    )
  }

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
            <div><strong>{component.kind === 'capacitor' ? component.variant === 'electrolytic' ? '电解电容' : '瓷片电容' : names[component.kind]}</strong><small>{component.label}</small></div>
          </div>

          {component.kind !== 'button' && component.kind !== 'switch' ? <label className="field-label">
            <span>{component.kind === 'capacitor' ? '容量 (F)' : component.kind === 'npn' || component.kind === 'pnp' ? '放大倍数 β' : '数值'}</span>
            <input
              type="number"
              min="0.000000001"
              step="any"
              value={component.value}
              onChange={(event) => updateSelected({ value: Math.max(Number(event.target.value), 1e-12) })}
            />
          </label> : (
            <div className={`contact-state ${contactClosed ? 'is-closed' : ''}`}>
              <span className="contact-state-light" />
              <div>
                <strong>{component.kind === 'switch'
                  ? contactClosed ? '开关已接通' : '开关已断开'
                  : contactClosed ? '按键已闭合' : '触点常开'}</strong>
                <small>{component.kind === 'switch' ? '单击画布上的闸刀切换通断' : '按住圆形按钮闭合电路'}</small>
              </div>
            </div>
          )}

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
                <span>{pinName(component.kind, index)}</span>
                <strong>{boardPointLabel(pin)}</strong>
                <small>
                  {formatEngineering(reading?.pinVoltages[index] ?? 0, 'V')} · {formatEngineering(reading?.pinCurrents[index] ?? 0, 'A')}
                </small>
              </div>
            ))}
          </div>

          <div className="meter-grid">
            <div className="meter-card"><span>{component.kind === 'npn' || component.kind === 'pnp' ? 'VCE' : 'VOLTAGE'}</span><strong>{formatEngineering(reading?.voltage ?? 0, 'V')}</strong></div>
            <div className="meter-card"><span>{component.kind === 'npn' || component.kind === 'pnp' ? 'IC' : 'CURRENT'}</span><strong>{formatEngineering(reading?.current ?? 0, 'A')}</strong></div>
            <div className="meter-card wide"><span>POWER</span><strong>{formatEngineering(reading?.power ?? 0, 'W')}</strong></div>
          </div>

          <div className={`object-actions ${component.kind === 'button' ? 'is-single' : ''}`}>
            {component.kind !== 'button' ? <button type="button" onClick={rotateSelected}><RotateCw size={15} />旋转 90°</button> : null}
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
