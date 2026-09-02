import { useEffect, useMemo, useRef, useState } from 'react'
import { buildCircuitJsNetlist } from '@/domain/netlist'
import type { ComponentBinding } from '@/domain/netlist'
import type { BreadboardDocument, SimulationReading, SimulationStatus } from '@/domain/types'

interface CircuitElementProxy {
  getType(): string
  getExternalId?(): string | null
  getInfo?(): string[]
  getPostCount(): number
  getVoltage(index: number): number
  getVoltageDiff(): number
  getCurrent(): number
  getPostCurrent?(index: number): number
  getPower?(): number
  getBrightness?(): number
}

interface CircuitJsProxy {
  importCircuit(circuit: string, subcircuitsOnly: boolean): void
  setSimRunning(running: boolean): void
  bindElement?(index: number, externalId: string, expectedType: string): boolean
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
  closedContacts: Readonly<Record<string, boolean>>
  running: boolean
  onReadings: (readings: Record<string, SimulationReading>) => void
  onStatus: (status: SimulationStatus) => void
}

const unitScales: Readonly<Record<string, number>> = {
  p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6,
  m: 1e-3, '': 1, k: 1e3, M: 1e6, G: 1e9,
}

function infoValue(element: CircuitElementProxy, label: string): number | undefined {
  const line = element.getInfo?.().find((item) => item.startsWith(`${label} =`))
  const match = line?.match(/=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([pnuµμmkMG]?)/)
  if (!match) return undefined
  const value = Number(match[1]) * (unitScales[match[2] ?? ''] ?? 1)
  return Number.isFinite(value) ? value : undefined
}

function fallbackPostCurrents(element: CircuitElementProxy, postCount: number, transistor: boolean): number[] {
  if (transistor) {
    const collector = infoValue(element, 'Ic')
    const base = infoValue(element, 'Ib')
    if (collector === undefined || base === undefined) throw new Error('Legacy CircuitJS did not expose transistor currents')
    return [base, collector, -base - collector]
  }
  const current = element.getCurrent()
  return Array.from({ length: postCount }, (_, index) => index === 0 ? current : index === 1 ? -current : 0)
}

function ledBrightness(current: number, maxBrightnessCurrent: number): number {
  const ratio = current / maxBrightnessCurrent
  return Math.min(1, Math.max(0, ratio > 0 ? 1 + 0.2 * Math.log(ratio) : 0))
}

export function CircuitJsEngine({ document, closedContacts, running, onReadings, onStatus }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [connected, setConnected] = useState(false)
  const simulatorRef = useRef<CircuitJsProxy | null>(null)
  const latestDocumentRef = useRef(document)
  const importedDocumentRef = useRef(document)
  const runningRef = useRef(running)
  const mappingReadyRef = useRef(false)
  const bindingsRef = useRef<ComponentBinding[]>([])
  const warnedLegacyBridgeRef = useRef(false)
  const netlist = useMemo(() => buildCircuitJsNetlist(document, closedContacts), [closedContacts, document])
  const disabled = import.meta.env.VITE_DISABLE_ENGINE === 'true'
  const src = import.meta.env.VITE_CIRCUITJS_URL
    || (import.meta.env.DEV
      ? '/circuit-engine/circuitjs.html?hideSidebar=true&hideMenu=true&hideInfoBox=true&editable=false'
      : '/circuit/circuitjs.html?hideSidebar=true&hideMenu=true&hideInfoBox=true&editable=false')

  useEffect(() => {
    runningRef.current = running
  }, [running])

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
      simulator.onanalyze = () => onStatus(runningRef.current ? 'running' : 'paused')
      simulator.onupdate = () => {
        if (!mappingReadyRef.current) return
        try {
          const elements = simulator.getElements()
          const components = new Map(latestDocumentRef.current.components.map((component) => [component.id, component]))
          const result: Record<string, SimulationReading> = {}
          // An empty breadboard only contains solver support elements. Do not require
          // the component bridge API for those elements, which also keeps startup
          // compatible with a previously cached CircuitJS runtime.
          if (components.size === 0) {
            onReadings(result)
            return
          }
          for (const binding of bindingsRef.current) {
            const element = elements[binding.elementIndex]
            const componentId = binding.componentId
            const component = components.get(componentId)
            if (!element || element.getType() !== binding.expectedType || !component || result[componentId]) {
              throw new Error('CircuitJS component binding is stale, duplicated, or has changed type')
            }
            const postCount = element.getPostCount()
            const pinVoltages = Array.from({ length: postCount }, (_, index) => element.getVoltage(index))
            const transistor = component.kind === 'npn' || component.kind === 'pnp'
            const pinCurrents = element.getPostCurrent
              ? Array.from({ length: postCount }, (_, index) => element.getPostCurrent!(index))
              : fallbackPostCurrents(element, postCount, transistor)
            if ([...pinVoltages, ...pinCurrents].some((value) => !Number.isFinite(value))) {
              throw new Error('CircuitJS returned a non-finite terminal reading')
            }
            const voltage = transistor
              ? (pinVoltages[1] ?? 0) - (pinVoltages[2] ?? 0)
              : element.getVoltageDiff()
            const current = transistor ? (pinCurrents[1] ?? 0) : element.getCurrent()
            const power = element.getPower?.()
              ?? pinVoltages.reduce((sum, pinVoltage, index) => sum + pinVoltage * (pinCurrents[index] ?? 0), 0)
            const brightness = component.kind === 'led'
              ? element.getBrightness?.() ?? ledBrightness(current, component.value)
              : undefined
            if (![voltage, current, power, brightness ?? 0].every(Number.isFinite)) {
              throw new Error('CircuitJS returned a non-finite component reading')
            }
            result[componentId] = {
              voltage,
              current,
              power,
              pinVoltages,
              pinCurrents,
              ...(brightness === undefined ? {} : { brightness: Math.min(1, Math.max(0, brightness)) }),
            }
          }
          if (Object.keys(result).length !== components.size) throw new Error('CircuitJS component binding is incomplete')
          onReadings(result)
        } catch (cause) {
          console.error('CircuitJS reading bridge failed', cause)
          mappingReadyRef.current = false
          simulator.setSimRunning(false)
          onReadings({})
          onStatus('error')
        }
      }
      onStatus('ready')
    }
    contentWindow.oncircuitjsloaded = attach
    attach()
  }

  useEffect(() => {
    const simulator = simulatorRef.current
    if (!simulator) return
    mappingReadyRef.current = false
    if (netlist.blocked) {
      simulator.setSimRunning(false)
      onReadings({})
      onStatus('error')
      return
    }
    const documentChanged = importedDocumentRef.current !== document
    importedDocumentRef.current = document
    const timer = window.setTimeout(() => {
      try {
        simulator.importCircuit(netlist.circuit, false)
        const elements = simulator.getElements()
        const indices = new Set<number>()
        const componentIds = new Set<string>()
        const supportsRuntimeBinding = typeof simulator.bindElement === 'function'
        if (!supportsRuntimeBinding && netlist.componentBindings.length > 0 && !warnedLegacyBridgeRef.current) {
          warnedLegacyBridgeRef.current = true
          console.warn('CircuitJS legacy bridge detected; using verified element-index compatibility mode')
        }
        if (netlist.componentBindings.length !== document.components.length) {
          throw new Error('Not every breadboard component has a CircuitJS binding')
        }
        for (const binding of netlist.componentBindings) {
          if (indices.has(binding.elementIndex) || componentIds.has(binding.componentId)) {
            throw new Error('Duplicate CircuitJS component binding')
          }
          indices.add(binding.elementIndex)
          componentIds.add(binding.componentId)
          const element = elements[binding.elementIndex]
          if (element?.getType() !== binding.expectedType) {
            throw new Error('CircuitJS component binding verification failed')
          }
          if (supportsRuntimeBinding) {
            if (!simulator.bindElement!(binding.elementIndex, binding.componentId, binding.expectedType)) {
              throw new Error('CircuitJS rejected a component binding')
            }
            if (element.getExternalId?.() !== binding.componentId) {
              throw new Error('CircuitJS component identity verification failed')
            }
          }
        }
        latestDocumentRef.current = document
        bindingsRef.current = netlist.componentBindings
        mappingReadyRef.current = true
        simulator.setSimRunning(running)
        onStatus(running ? 'running' : 'paused')
      } catch (cause) {
        console.error('CircuitJS component binding failed', cause)
        mappingReadyRef.current = false
        simulator.setSimRunning(false)
        onReadings({})
        onStatus('error')
      }
    }, documentChanged ? 140 : 0)
    return () => window.clearTimeout(timer)
  }, [connected, document, netlist, onReadings, onStatus, running])

  if (disabled) return null
  return <iframe ref={frameRef} onLoad={connect} className="circuit-engine-frame" title="CircuitJS 求解引擎" src={src} />
}
