import { useEffect, useMemo, useRef, useState } from 'react'
import { buildCircuitJsNetlist, circuitElementType } from '@/domain/netlist'
import type { BreadboardDocument, SimulationReading, SimulationStatus } from '@/domain/types'

interface CircuitElementProxy {
  getType(): string
  getPostCount(): number
  getVoltage(index: number): number
  getVoltageDiff?(): number
  getCurrent?(): number
  getPower?(): number
}

interface CircuitJsProxy {
  importCircuit(circuit: string, subcircuitsOnly: boolean): void
  setSimRunning(running: boolean): void
  getElements(): CircuitElementProxy[]
  onupdate?: () => void
  onanalyze?: () => void
}

declare global {
  interface Window {
    CircuitJS1?: CircuitJsProxy
    oncircuitjsloaded?: () => void
  }
}

interface Props {
  document: BreadboardDocument
  running: boolean
  onReadings: (readings: Record<string, SimulationReading>) => void
  onStatus: (status: SimulationStatus) => void
}

export function CircuitJsEngine({ document, running, onReadings, onStatus }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [connected, setConnected] = useState(false)
  const simulatorRef = useRef<CircuitJsProxy | null>(null)
  const orderRef = useRef<string[]>([])
  const typeRef = useRef<string[]>([])
  const netlist = useMemo(() => buildCircuitJsNetlist(document), [document])
  const disabled = import.meta.env.VITE_DISABLE_ENGINE === 'true'
  const src = import.meta.env.VITE_CIRCUITJS_URL
    || (import.meta.env.DEV
      ? '/circuit-engine/circuitjs.html?hideSidebar=true&hideMenu=true&hideInfoBox=true&editable=false'
      : '/circuit/circuitjs.html?hideSidebar=true&hideMenu=true&hideInfoBox=true&editable=false')

  useEffect(() => {
    if (disabled) {
      onStatus('offline')
      return
    }
    const timer = window.setTimeout(() => {
      if (!simulatorRef.current) onStatus('offline')
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [disabled, onStatus])

  const connect = () => {
    const contentWindow = frameRef.current?.contentWindow
    if (!contentWindow) return
    const attach = () => {
      const simulator = contentWindow.CircuitJS1
      if (!simulator) return
      simulatorRef.current = simulator
      setConnected(true)
      simulator.onanalyze = () => onStatus(running ? 'running' : 'paused')
      simulator.onupdate = () => {
        const elements = simulator.getElements()
        const result: Record<string, SimulationReading> = {}
        let cursor = 0
        for (let index = 0; index < orderRef.current.length; index += 1) {
          const expectedType = typeRef.current[index]
          while (cursor < elements.length && elements[cursor]?.getType() !== expectedType) cursor += 1
          const element = elements[cursor]
          const componentId = orderRef.current[index]
          if (!element || !componentId) continue
          const postCount = element.getPostCount()
          const voltage = element.getVoltageDiff?.()
            ?? (element.getVoltage(0) - element.getVoltage(Math.max(0, postCount - 1)))
          const current = element.getCurrent?.() ?? 0
          result[componentId] = {
            voltage: Number.isFinite(voltage) ? voltage : 0,
            current: Number.isFinite(current) ? current : 0,
            power: Number.isFinite(element.getPower?.()) ? element.getPower?.() ?? 0 : voltage * current,
          }
          cursor += 1
        }
        onReadings(result)
      }
      onStatus('ready')
    }
    contentWindow.oncircuitjsloaded = attach
    attach()
  }

  useEffect(() => {
    const simulator = simulatorRef.current
    if (!simulator) return
    if (netlist.blocked) {
      simulator.setSimRunning(false)
      onStatus('error')
      return
    }
    const timer = window.setTimeout(() => {
      orderRef.current = netlist.componentOrder
      typeRef.current = document.components.map((component) => circuitElementType(component.kind))
      try {
        simulator.importCircuit(netlist.circuit, false)
        simulator.setSimRunning(running)
        onStatus(running ? 'running' : 'paused')
      } catch {
        onStatus('error')
      }
    }, 140)
    return () => window.clearTimeout(timer)
  }, [connected, document.components, netlist, onStatus, running])

  if (disabled) return null
  return <iframe ref={frameRef} onLoad={connect} className="circuit-engine-frame" title="CircuitJS 求解引擎" src={src} />
}
