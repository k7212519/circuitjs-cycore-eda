import { useEffect, useMemo, useRef, useState } from 'react'
import { buildCircuitJsNetlist } from '@/domain/netlist'
import type { ComponentBinding, NetlistBuildResult } from '@/domain/netlist'
import { cd4017PhysicalValues } from '@/domain/cd4017'
import {
  SEVEN_SEGMENT_COMMON_CORE_INDEX,
  SEVEN_SEGMENT_COMMON_PHYSICAL_INDICES,
  SEVEN_SEGMENT_CORE_TO_PHYSICAL_INDEX,
  SEVEN_SEGMENT_MAX_BRIGHTNESS_CURRENT,
} from '@/domain/sevenSegment'
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
  isRunning(): boolean
  setExtVoltage?(name: string, voltage: number): void
  bindElement?(index: number, externalId: string, expectedType: string): boolean
  getElements(): CircuitElementProxy[]
  onupdate?: () => void
  onanalyze?: () => void
  ontimestep?: () => void
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

// CircuitJS can return finite but astronomically large values while a nonlinear
// circuit is diverging (for example, driving a BJT base directly from an ideal
// 5 V source). Treat those values as a solver failure instead of rendering
// unrelated LEDs at full brightness.
const MAX_ABS_SOLVER_READING = 1e12
const isStableSolverValue = (value: number) => Number.isFinite(value) && Math.abs(value) <= MAX_ABS_SOLVER_READING

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
  if (postCount > 2) throw new Error('Legacy CircuitJS did not expose multi-terminal currents')
  const current = element.getCurrent()
  return Array.from({ length: postCount }, (_, index) => index === 0 ? current : index === 1 ? -current : 0)
}

function sevenSegmentPhysicalValues(coreValues: number[]): number[] {
  const physicalValues = Array.from({ length: 10 }, () => 0)
  SEVEN_SEGMENT_CORE_TO_PHYSICAL_INDEX.forEach((physicalIndex, coreIndex) => {
    physicalValues[physicalIndex] = coreValues[coreIndex] ?? 0
  })
  for (const physicalIndex of SEVEN_SEGMENT_COMMON_PHYSICAL_INDICES) {
    physicalValues[physicalIndex] = coreValues[SEVEN_SEGMENT_COMMON_CORE_INDEX] ?? 0
  }
  return physicalValues
}

function ledBrightness(current: number, maxBrightnessCurrent: number): number {
  const ratio = current / maxBrightnessCurrent
  return Math.min(1, Math.max(0, ratio > 0 ? 1 + 0.2 * Math.log(ratio) : 0))
}

function syncLiveContacts(simulator: CircuitJsProxy, controls: NetlistBuildResult['contactControls'], contacts: Readonly<Record<string, boolean>>) {
  if (controls.length === 0) return
  if (!simulator.setExtVoltage) throw new Error('CircuitJS external-voltage API is required for live clock contacts')
  for (const control of controls) simulator.setExtVoltage(control.sourceName, contacts[control.componentId] ? 5 : 0)
}

const noContacts: Readonly<Record<string, boolean>> = {}

export function CircuitJsEngine({ document, closedContacts, running, onReadings, onStatus }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [connected, setConnected] = useState(false)
  const simulatorRef = useRef<CircuitJsProxy | null>(null)
  const latestDocumentRef = useRef(document)
  const importedDocumentRef = useRef(document)
  const importedNetlistKeyRef = useRef('')
  const closedContactsRef = useRef(closedContacts)
  const runningRef = useRef(running)
  const mappingReadyRef = useRef(false)
  const readingsReadyRef = useRef(false)
  const bindingsRef = useRef<ComponentBinding[]>([])
  const warnedLegacyBridgeRef = useRef(false)
  const liveContacts = document.components.some((component) => component.kind === 'cd4017')
  const serializedContacts = liveContacts ? noContacts : closedContacts
  const netlist = useMemo(() => buildCircuitJsNetlist(document, serializedContacts), [serializedContacts, document])
  const netlistKey = useMemo(() => JSON.stringify([netlist.circuit, netlist.componentBindings]), [netlist])
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
      simulator.onanalyze = () => {
        readingsReadyRef.current = false
        onStatus(runningRef.current ? 'running' : 'paused')
      }
      // onupdate is also called for paint-only frames, before the first solve.
      // In particular, AnalogSwitchElm initializes its resistance in doStep(),
      // so a startup current can be 0/0 until an accepted timestep has completed.
      simulator.ontimestep = () => { readingsReadyRef.current = true }
      simulator.onupdate = () => {
        if (!mappingReadyRef.current) return
        try {
          if (runningRef.current && !simulator.isRunning()) {
            throw new Error('CircuitJS solver stopped before producing valid readings')
          }
          if (!readingsReadyRef.current) return
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
            const transistor = component.kind === 'npn' || component.kind === 'pnp'
            const sevenSegment = component.kind === 'seven-segment'
            const cd4017 = component.kind === 'cd4017'
            const corePinVoltages = Array.from({ length: postCount }, (_, index) => element.getVoltage(index))
            const corePinCurrents = element.getPostCurrent
              ? Array.from({ length: postCount }, (_, index) => element.getPostCurrent!(index))
              : fallbackPostCurrents(element, postCount, transistor)
            if ([...corePinVoltages, ...corePinCurrents].some((value) => !isStableSolverValue(value))) {
              throw new Error(`CircuitJS returned a divergent terminal reading: ${binding.expectedType} (${componentId}); core voltages=[${corePinVoltages.join(', ')}]; core currents=[${corePinCurrents.join(', ')}]`)
            }
            // CircuitJS exposes transistor posts as B-C-E. The breadboard stores
            // and displays its physical package pins from left to right as E-B-C.
            const pinVoltages = sevenSegment
              ? sevenSegmentPhysicalValues(corePinVoltages)
              : cd4017
              ? cd4017PhysicalValues(corePinVoltages)
              : transistor
              ? [corePinVoltages[2] ?? 0, corePinVoltages[0] ?? 0, corePinVoltages[1] ?? 0]
              : corePinVoltages.slice(0, component.pins.length)
            const pinCurrents = sevenSegment
              ? sevenSegmentPhysicalValues(corePinCurrents)
              : cd4017
              ? cd4017PhysicalValues(corePinCurrents)
              : transistor
              ? [corePinCurrents[2] ?? 0, corePinCurrents[0] ?? 0, corePinCurrents[1] ?? 0]
              : corePinCurrents.slice(0, component.pins.length)
            const commonVoltage = corePinVoltages[SEVEN_SEGMENT_COMMON_CORE_INDEX] ?? 0
            const sevenSegmentDirection = component.variant === 'common-anode' ? -1 : 1
            const voltage = sevenSegment
              ? Math.max(0, ...corePinVoltages.slice(0, 8).map((value) => sevenSegmentDirection * (value - commonVoltage)))
              : cd4017
              ? (pinVoltages[15] ?? 0) - (pinVoltages[7] ?? 0)
              : transistor
              ? (corePinVoltages[1] ?? 0) - (corePinVoltages[2] ?? 0)
              : element.getVoltageDiff()
            const current = sevenSegment
              ? Math.max(0, -sevenSegmentDirection * (corePinCurrents[SEVEN_SEGMENT_COMMON_CORE_INDEX] ?? 0))
              : cd4017 ? (pinCurrents[15] ?? 0)
              : transistor ? (corePinCurrents[1] ?? 0) : element.getCurrent()
            const terminalPower = corePinVoltages.reduce(
              (sum, pinVoltage, index) => sum + pinVoltage * (corePinCurrents[index] ?? 0),
              0,
            )
            const power = sevenSegment || cd4017 ? terminalPower : element.getPower?.() ?? terminalPower
            const brightness = component.kind === 'led'
              ? element.getBrightness?.() ?? ledBrightness(current, component.value)
              : undefined
            const segmentBrightness = sevenSegment
              ? corePinCurrents.slice(0, 8).map((segmentCurrent) => (
                  ledBrightness(sevenSegmentDirection * segmentCurrent, SEVEN_SEGMENT_MAX_BRIGHTNESS_CURRENT)
                ))
              : undefined
            if (![voltage, current, power].every(isStableSolverValue)
                || !Number.isFinite(brightness ?? 0)
                || segmentBrightness?.some((value) => !Number.isFinite(value))) {
              throw new Error('CircuitJS returned a divergent component reading')
            }
            result[componentId] = {
              voltage,
              current,
              power,
              pinVoltages,
              pinCurrents,
              ...(brightness === undefined ? {} : { brightness: Math.min(1, Math.max(0, brightness)) }),
              ...(segmentBrightness === undefined ? {} : { segmentBrightness }),
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
    closedContactsRef.current = closedContacts
    const simulator = simulatorRef.current
    if (!simulator || !mappingReadyRef.current) return
    try {
      syncLiveContacts(simulator, netlist.contactControls, closedContacts)
    } catch (cause) {
      console.error('CircuitJS live contact update failed', cause)
      mappingReadyRef.current = false
      simulator.setSimRunning(false)
      onStatus('error')
    }
  }, [closedContacts, netlist, connected, onStatus])

  useEffect(() => {
    const simulator = simulatorRef.current
    if (!simulator) return
    if (netlist.blocked) {
      mappingReadyRef.current = false
      readingsReadyRef.current = false
      simulator.setSimRunning(false)
      onReadings({})
      onStatus('error')
      return
    }
    if (mappingReadyRef.current && importedNetlistKeyRef.current === netlistKey) {
      // Pause/resume, viewport changes and live contacts must not reset the chip.
      latestDocumentRef.current = document
      importedDocumentRef.current = document
      simulator.setSimRunning(running)
      onStatus(running ? 'running' : 'paused')
      return
    }
    mappingReadyRef.current = false
    const documentChanged = importedDocumentRef.current !== document
    importedDocumentRef.current = document
    const timer = window.setTimeout(() => {
      try {
        readingsReadyRef.current = false
        onReadings({})
        simulator.importCircuit(netlist.circuit, false)
        syncLiveContacts(simulator, netlist.contactControls, closedContactsRef.current)
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
        importedNetlistKeyRef.current = netlistKey
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
  }, [connected, document, netlist, netlistKey, onReadings, onStatus, running])

  if (disabled) return null
  return <iframe ref={frameRef} onLoad={connect} className="circuit-engine-frame" title="CircuitJS 求解引擎" src={src} />
}
