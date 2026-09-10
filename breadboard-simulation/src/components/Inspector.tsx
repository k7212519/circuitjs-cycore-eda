import { SENSOR_MODELS, endpointLabel, endpointKey } from '@/domain/sensors'
import { ESP32_S3_PINS } from '@/domain/esp32s3'
import { AlertTriangle, Cable, Gauge, RotateCw, Settings2, Trash2 } from 'lucide-react'
import { boardPointLabel, isRigidModule } from '@/domain/board'
import { CD4017_PHYSICAL_PIN_NAMES } from '@/domain/cd4017'
import { CD4026_PHYSICAL_PIN_NAMES } from '@/domain/cd4026'
import { SEVEN_SEGMENT_PHYSICAL_PIN_NAMES } from '@/domain/sevenSegment'
import type { ComponentKind, ComponentPlacementOptions, ResistorBandCount, ToolKind } from '@/domain/types'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

const names = {
  buzzer: '无源压电蜂鸣器', resistor: '电阻', capacitor: '电容', led: '发光二极管', diode: '二极管', switch: '开关', button: '按键', npn: 'NPN 三极管', pnp: 'PNP 三极管', 'seven-segment': '数码管', cd4017: 'CD4017', cd4026: 'CD4026', 'esp32-s3': 'ESP32-S3模型',
}
const toolNames: Record<Exclude<ToolKind, 'select' | 'pan'>, string> = { wire: '导线', ...names }
const wireColors = ['#f28c28', '#e8b83f', '#277fbc', '#4a9b65']

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

function pinName(kind: ComponentKind, index: number, variant?: ComponentPlacementOptions['variant']): string {
  if (kind === 'buzzer') return index === 0 ? '正极 +' : '负极 −'
  if (kind === 'esp32-s3') {
    const pin = ESP32_S3_PINS[index]!
    return `${pin.header}-${pin.number} · ${pin.name}`
  }
  if (kind === 'cd4017') return `${index + 1} · ${CD4017_PHYSICAL_PIN_NAMES[index] ?? '?'}`
  if (kind === 'cd4026') return `${index + 1} · ${CD4026_PHYSICAL_PIN_NAMES[index] ?? '?'}`
  if (kind === 'npn' || kind === 'pnp') return ['E', 'B', 'C'][index] ?? `P${index + 1}`
  if (kind === 'seven-segment') {
    const segment = (index === 2 || index === 7) && variant === 'common-anode'
      ? 'VCC'
      : SEVEN_SEGMENT_PHYSICAL_PIN_NAMES[index] ?? '?'
    return `P${index + 1} · ${segment}`
  }
  return `P${index + 1}`
}

function Cd4017Spec() {
  return (
    <div className="fixed-component-spec chip-spec">
      <span>CD4017 · 16 PINS</span>
      <strong>十进制计数器 / 脉冲分配器</strong>
      <small>16 脚 VDD 接 +5V，8 脚 VSS 接 GND。14 脚 CLK 上升沿计数；13 脚 INH 低电平允许计数；15 脚 RESET 高电平复位。</small>
      <small>Q0–Q9 依次输出，CO 在 Q0–Q4 时为高。上电从 Q0 开始；供电低于 3V 时输出高阻。LED 需外接限流电阻。</small>
      <small>固定 8×2 脚位，可跨 A–B、B–C、C–D。左下角为 1 脚，封装只能整体移动。</small>
    </div>
  )
}

function Cd4026Spec() {
  return (
    <div className="fixed-component-spec chip-spec">
      <span>CD4026 · 16 PINS</span>
      <strong>十进制计数器 / 七段显示译码器</strong>
      <small>16 脚 VDD 接 +5V，8 脚 VSS 接 GND。1 脚 CLK 上升沿计数；2 脚 INH 低电平允许计数；15 脚 RESET 复位。</small>
      <small>3 脚 DEI 高电平开启显示；6、7、9–13 脚输出 f、g、d、a、e、b、c，可驱动共阴极数码管，各段需外接限流电阻。</small>
      <small>4 脚 DEO、5 脚 CO、14 脚 UCS 用于级联。固定 8×2 脚位，左下角为 1 脚，封装只能整体移动。</small>
    </div>
  )
}

function PlacementInspector({ tool }: { tool: Exclude<ToolKind, 'select' | 'pan'> }) {
  const placementOptions = useWorkbenchStore((state) => state.placementOptions)
  const updatePlacementOptions = useWorkbenchStore((state) => state.updatePlacementOptions)
  const wireColor = useWorkbenchStore((state) => state.wireColor)
  const setWireColor = useWorkbenchStore((state) => state.setWireColor)
  const options = tool === 'wire' ? null : placementOptions[tool]
  const sevenSegmentCommonAnode = tool === 'seven-segment' && options?.variant === 'common-anode'
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
          : tool === 'seven-segment'
            ? '1位数码管'
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
        <p>设置 {placementName} 参数，然后选择孔位或模块引脚。</p>
      </div>

      <div className="placement-stack">
        <div className="placement-summary">
          <span className={`placement-icon ${tool === 'wire' ? 'is-wire' : ''}`}>
            {tool === 'wire' ? <Cable size={21} /> : tool.toUpperCase()}
          </span>
          <div><strong>{placementName}</strong><small>{tool === 'cd4017' ? '十进制计数器 · 固定 16 脚模块' : tool === 'cd4026' ? '计数器 + 七段译码器 · 固定 16 脚模块' : tool === 'seven-segment' ? 'SC56-11EWA · 红色 · 固定 10 脚封装' : '类型已在左侧选定，参数将应用到下一个元件'}</small></div>
        </div>

        {tool === 'esp32-s3' ? <Esp32S3Spec /> : null}
        {tool === 'buzzer' && <p>仅模型，不参与仿真。正极标有 +，默认引脚间距为两个孔距。</p>}
        {tool !== 'wire' && isRigidModule(tool) ? <div className="fixed-component-spec"><small>放置时按空格旋转 180°</small></div> : null}
        {tool === 'cd4017' ? <Cd4017Spec /> : null}
        {tool === 'cd4026' ? <Cd4026Spec /> : null}

        {tool === 'seven-segment' ? (
          <>
            <div className="option-group">
              <div className="option-label"><span>公共端类型</span><code>{sevenSegmentCommonAnode ? 'COMMON ANODE' : 'COMMON CATHODE'}</code></div>
              <div className="segmented-options">
                <button type="button" className={!sevenSegmentCommonAnode ? 'is-active' : ''} aria-pressed={!sevenSegmentCommonAnode} onClick={() => update('seven-segment', { variant: 'common-cathode' })}>共阴极</button>
                <button type="button" className={sevenSegmentCommonAnode ? 'is-active' : ''} aria-pressed={sevenSegmentCommonAnode} onClick={() => update('seven-segment', { variant: 'common-anode' })}>共阳极</button>
              </div>
            </div>
            <div className="fixed-component-spec">
              <span>{sevenSegmentCommonAnode ? 'COMMON ANODE' : 'COMMON CATHODE'}</span>
              <strong>3、8 脚内部相连</strong>
              <small>可跨沟槽或中间拼缝，将封装左边缘对准孔位后单击放置。</small>
            </div>
          </>
        ) : null}

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
          <div><strong>参数已就绪</strong><span>{tool === 'wire' ? '点击两端或拖动，连接孔位与模块引脚' : tool === 'buzzer' || tool === 'resistor' || tool === 'capacitor' || tool === 'led' || tool === 'diode' || tool === 'switch' || tool === 'button' ? '从起点孔拖到终点孔完成放置' : isRigidModule(tool) ? '在跨槽封装预览处单击完成放置' : '在目标孔位单击完成放置'}</span></div>
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
  const activeSensor = useWorkbenchStore(s => s.activeSensor)
  const sensorRotation = useWorkbenchStore(s => s.sensorRotation)
  const rotateSensorPlacement = useWorkbenchStore(s => s.rotateSensorPlacement)
  const updateSensorWire = useWorkbenchStore(s => s.updateSensorWire)
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

  const sensor = document.sensors?.find(s => s.id === singleSelectedId)
  const sensorWire = document.sensorWires?.find(w => w.id === singleSelectedId)
  if (activeSensor || sensor) {
    const model = SENSOR_MODELS[activeSensor ?? sensor!.kind]
    return <aside className="inspector panel" aria-label={activeSensor ? '放置选项' : '属性与测量'}>
      <div className="panel-heading"><span className="eyebrow">EXTERNAL MODULE</span><h2>{model.name}</h2><p>{model.model}</p></div>
      <div className="property-stack"><div className="fixed-component-spec chip-spec sensor-spec"><strong>仅模型，不参与仿真</strong><small>{activeSensor ? '在面包板外单击或拖放。空格旋转 90°。' : '拖动模块可自由移动，导线保持连接。使用导线工具连接引脚。'}</small></div>
        <button type="button" className="full-button" onClick={activeSensor ? rotateSensorPlacement : rotateSelected}><RotateCw size={15} />旋转 90° · {activeSensor ? sensorRotation : sensor!.rotation}°</button>
        <div className="pin-table sensor-pin-table">{model.pins.map((name, pin) => {
          const key = sensor ? endpointKey({ type: 'sensor', sensorId: sensor.id, pin }) : ''
          const connection = document.sensorWires?.find(w => [w.from, w.to].some(e => endpointKey(e) === key))
          const other = connection ? endpointKey(connection.from) === key ? connection.to : connection.from : null
          return <div className="sensor-pin-row" key={name}><strong>{name}</strong><span>{other ? endpointLabel(document, other) : '未连接'}</span></div>
        })}</div>
        {sensor && <button type="button" className="danger full-button" onClick={deleteSelected}><Trash2 size={15} />删除模块及接线</button>}
      </div>
    </aside>
  }
  if (sensorWire) return <aside className="inspector panel" aria-label="属性与测量">
    <div className="panel-heading"><h2>模块导线</h2><p>仅接线展示，不参与仿真</p></div>
    <div className="property-stack"><div className="fixed-component-spec chip-spec sensor-spec"><strong>{endpointLabel(document, sensorWire.from)}</strong><small>连接到 {endpointLabel(document, sensorWire.to)}</small><small>拖动端点重新连接；拖动中间线段手柄调整路径。</small></div>
      <label>导线颜色 <input aria-label="模块导线颜色" type="color" value={sensorWire.color} onChange={e => updateSensorWire(sensorWire.id, { color: e.target.value })} /></label>
      <button type="button" className="full-button" onClick={() => updateSensorWire(sensorWire.id, { waypoints: undefined })}>恢复自动布线</button>
      <button type="button" className="danger full-button" onClick={deleteSelected}><Trash2 size={15} />删除导线</button>
    </div>
  </aside>

  if (activeTool !== 'select' && activeTool !== 'pan') return <PlacementInspector tool={activeTool} />

  if (selectedIds.length > 1) {
    const selected = new Set(selectedIds)
    const componentCount = document.components.filter((item) => selected.has(item.id)).length + (document.sensors ?? []).filter(s => selected.has(s.id)).length
    const wireCount = document.wires.filter((item) => selected.has(item.id)).length + (document.sensorWires ?? []).filter(w => selected.has(w.id)).length
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

          {component.kind === 'buzzer' ? <p>仅模型，不参与仿真</p> : component.kind === 'esp32-s3' ? <Esp32S3Spec /> : component.kind === 'cd4017' ? <Cd4017Spec /> : component.kind === 'cd4026' ? <Cd4026Spec /> : component.kind === 'seven-segment' ? (
            <>
              <div className="option-group">
                <div className="option-label"><span>公共端类型</span><code>{component.variant === 'common-anode' ? 'COMMON ANODE' : 'COMMON CATHODE'}</code></div>
                <div className="segmented-options">
                  <button type="button" className={component.variant !== 'common-anode' ? 'is-active' : ''} aria-pressed={component.variant !== 'common-anode'} onClick={() => updateSelected({ variant: 'common-cathode' })}>共阴极</button>
                  <button type="button" className={component.variant === 'common-anode' ? 'is-active' : ''} aria-pressed={component.variant === 'common-anode'} onClick={() => updateSelected({ variant: 'common-anode' })}>共阳极</button>
                </div>
              </div>
              <div className="fixed-component-spec">
                <span>0.56 INCH · RED</span>
                <strong>{component.variant === 'common-anode' ? '共阳极七段数码管' : '共阴极七段数码管'}</strong>
                <small>右下小数点 · 外接限流电阻 · 3、8 脚内部相连</small>
              </div>
            </>
          ) : component.kind !== 'button' && component.kind !== 'switch' ? (
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
          ) : (
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

          <div className={`pin-table ${isRigidModule(component.kind) ? 'chip-pin-table' : ''}`}>
            <div className="section-label">PIN MAP</div>
            {component.pins.map((pin, index) => (
              <div className="pin-row" key={pin}>
                <span>{pinName(component.kind, index, component.variant)}</span>
                <strong>{boardPointLabel(pin)}</strong>
                {component.kind !== 'esp32-s3' && component.kind !== 'buzzer' && <small>
                  {formatEngineering(reading?.pinVoltages[index] ?? 0, 'V')} · {component.kind === 'seven-segment' && (index === 2 || index === 7) ? `公共端合计 ${formatEngineering(reading?.pinCurrents[index] ?? 0, 'A')}` : formatEngineering(reading?.pinCurrents[index] ?? 0, 'A')}
                </small>}
              </div>
            ))}
          </div>

          {component.kind !== 'esp32-s3' && component.kind !== 'buzzer' && <div className="meter-grid">
            <div className="meter-card"><span>{component.kind === 'cd4017' || component.kind === 'cd4026' ? 'VDD − VSS' : component.kind === 'npn' || component.kind === 'pnp' ? 'VCE' : component.kind === 'seven-segment' ? 'MAX VF' : 'VOLTAGE'}</span><strong>{formatEngineering(reading?.voltage ?? 0, 'V')}</strong></div>
            <div className="meter-card"><span>{component.kind === 'cd4017' || component.kind === 'cd4026' ? 'IDD' : component.kind === 'npn' || component.kind === 'pnp' ? 'IC' : component.kind === 'seven-segment' ? 'COM CURRENT' : 'CURRENT'}</span><strong>{formatEngineering(reading?.current ?? 0, 'A')}</strong></div>
            <div className="meter-card wide"><span>POWER</span><strong>{formatEngineering(reading?.power ?? 0, 'W')}</strong></div>
          </div>}

          <div className={`object-actions ${component.kind === 'button' ? 'is-single' : ''}`}>
            {component.kind !== 'button' ? <button type="button" onClick={rotateSelected}><RotateCw size={15} />旋转 {isRigidModule(component.kind) ? '180°' : '90°'}</button> : null}
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

function Esp32S3Spec() {
  return <div className="fixed-component-spec"><span>双 TYPE-C · 44 PIN</span><strong>ESP32-S3-WROOM-1-N16R8</strong><small>16 MB Flash · 8 MB PSRAM · 仅模型，不参与仿真</small></div>
}
