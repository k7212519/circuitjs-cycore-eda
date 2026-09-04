import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ComponentKind, ComponentPlacementOptions, ToolKind } from '@/domain/types'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

type GlyphKind = 'wire' | 'resistor' | 'capacitor' | 'ceramic' | 'electrolytic' | 'led' | 'diode' | 'switch' | 'transistor' | 'npn' | 'pnp' | 'seven-segment' | 'chip'

interface DirectItem {
  kind: 'wire' | 'resistor'
  label: string
  glyph: GlyphKind
}

interface MenuChild {
  id: string
  tool: ComponentKind
  label: string
  glyph: GlyphKind
  accent?: string
  glyphColor?: string
  options: Partial<ComponentPlacementOptions>
}

interface PartsMenu {
  id: string
  label: string
  glyph: GlyphKind
  children: MenuChild[]
}

const directItems: DirectItem[] = [
  { kind: 'wire', label: '导线', glyph: 'wire' },
  { kind: 'resistor', label: '电阻', glyph: 'resistor' },
]

const menus: PartsMenu[] = [
  {
    id: 'switch', label: '开关', glyph: 'switch',
    children: [
      { id: 'button', tool: 'button', label: '按键', glyph: 'switch', options: { value: 1, label: '瞬时按键' } },
      { id: 'toggle', tool: 'switch', label: '开关', glyph: 'switch', options: { value: 1, label: '保持型开关' } },
    ],
  },
  {
    id: 'led', label: 'LED', glyph: 'led',
    children: [
      { id: 'red', tool: 'led', label: '红色 LED', glyph: 'led', accent: '#ef3d32', options: { color: '#ef3d32', label: '红色 LED' } },
      { id: 'green', tool: 'led', label: '绿色 LED', glyph: 'led', accent: '#48b96b', options: { color: '#48b96b', label: '绿色 LED' } },
      { id: 'blue', tool: 'led', label: '蓝色 LED', glyph: 'led', accent: '#3f82d7', options: { color: '#3f82d7', label: '蓝色 LED' } },
    ],
  },
  {
    id: 'seven-segment', label: '数码管', glyph: 'seven-segment',
    children: [
      {
        id: 'single-common-cathode',
        tool: 'seven-segment',
        label: '1位数码管',
        glyph: 'seven-segment',
        accent: '#b8b8b8',
        glyphColor: '#ef3d32',
        options: { value: 0.01, color: '#ef3d32', label: 'SC56-11EWA' },
      },
    ],
  },
  {
    id: 'capacitor', label: '电容', glyph: 'capacitor',
    children: [
      { id: 'ceramic', tool: 'capacitor', label: '瓷片电容', glyph: 'ceramic', options: { variant: 'ceramic', value: 100e-9, label: '100 nF' } },
      { id: 'electrolytic', tool: 'capacitor', label: '电解电容', glyph: 'electrolytic', options: { variant: 'electrolytic', value: 10e-6, label: '10 µF' } },
    ],
  },
  {
    id: 'diode', label: '二极管', glyph: 'diode',
    children: [
      { id: '1n4148', tool: 'diode', label: '小信号二极管', glyph: 'diode', options: { label: '1N4148', variant: 'small-signal' } },
      { id: '1n4007', tool: 'diode', label: '整流二极管', glyph: 'diode', options: { label: '1N4007', variant: 'rectifier' } },
      { id: '1n5819', tool: 'diode', label: '肖特基二极管', glyph: 'diode', options: { label: '1N5819', variant: 'schottky' } },
    ],
  },
  {
    id: 'transistor', label: '三极管', glyph: 'transistor',
    children: [
      { id: 'npn', tool: 'npn', label: 'NPN 三极管', glyph: 'npn', options: { value: 100, label: '2N3904' } },
      { id: 'pnp', tool: 'pnp', label: 'PNP 三极管', glyph: 'pnp', options: { value: 100, label: '2N3906' } },
    ],
  },
  {
    id: 'chip', label: '芯片', glyph: 'chip',
    children: [
      { id: 'cd4017', tool: 'cd4017', label: 'CD4017', glyph: 'chip', options: { value: 1, label: 'CD4017' } },
    ],
  },
]

function CircuitGlyph({ kind, color }: { kind: GlyphKind; color?: string }) {
  let shape: React.ReactNode
  if (kind === 'wire') {
    shape = <><path d="M3 12h18" /><circle cx="3" cy="12" r="1.8" /><circle cx="21" cy="12" r="1.8" /></>
  } else if (kind === 'resistor') {
    shape = <path d="M2 12h3l2.2-5 3.2 10 3.2-10 3.2 10 2.2-5h3" />
  } else if (kind === 'capacitor') {
    shape = <><path d="M3 12h6M9 5v14M15 5v14M15 12h6" /></>
  } else if (kind === 'ceramic') {
    shape = <><path d="M6 21v-5M18 21v-5" /><circle cx="12" cy="11" r="7" fill="#d9a72e" stroke="#f0c75f" /><path d="M8.5 8c1-1.3 2.2-1.8 3.8-1.9" stroke="#fff2af" opacity=".7" /></>
  } else if (kind === 'electrolytic') {
    shape = <><path d="M7 21v-5M17 21v-5" /><path d="M6 6c0-2 12-2 12 0v10c0 2-12 2-12 0Z" /><path d="M6 6c0 2 12 2 12 0M15 9v5" /></>
  } else if (kind === 'led') {
    shape = <><path d="M8 21v-4M16 21v-4M6 14h12v3H6Z" /><path d="M7 14V9a5 5 0 0 1 10 0v5Z" fill="currentColor" fillOpacity=".22" /><path d="M9.5 9c.2-1.8 1-2.8 2.5-3.2" opacity=".65" /></>
  } else if (kind === 'diode') {
    shape = <path d="M3 12h4M7 7l7 5-7 5ZM15 6v12M15 12h6" />
  } else if (kind === 'switch') {
    shape = <><path d="M2 15h4M18 15h4" /><circle cx="7" cy="15" r="1.8" /><circle cx="17" cy="15" r="1.8" /><path d="M8.5 13.8 16 7" /></>
  } else if (kind === 'seven-segment') {
    shape = <path d="M9 4h6M7 6v4M17 6v4M9 12h6M7 14v4M17 14v4M9 20h6" />
  } else if (kind === 'chip') {
    shape = <><rect x="4" y="7" width="16" height="10" rx="1.5" /><path d="M7 4v3M12 4v3M17 4v3M7 17v3M12 17v3M17 17v3" /><circle cx="7.5" cy="13.5" r=".7" fill="currentColor" stroke="none" /></>
  } else {
    shape = <path d="M5 12h5M10 5v14M10 9l7-4M10 15l7 4" />
  }
  return <svg className="circuit-glyph" viewBox="0 0 24 24" aria-hidden="true" style={color ? { color } : undefined}>{shape}</svg>
}

export function Palette() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const activeTool = useWorkbenchStore((state) => state.activeTool)
  const setActiveTool = useWorkbenchStore((state) => state.setActiveTool)
  const placementOptions = useWorkbenchStore((state) => state.placementOptions)
  const updatePlacementOptions = useWorkbenchStore((state) => state.updatePlacementOptions)

  const childIsActive = (child: MenuChild): boolean => {
    if (activeTool !== child.tool) return false
    const current = placementOptions[child.tool]
    if (child.options.variant) return current.variant === child.options.variant
    if (child.options.color) return current.color === child.options.color
    return !child.options.label || current.label === child.options.label
  }

  const chooseChild = (child: MenuChild) => {
    updatePlacementOptions(child.tool, child.options)
    setActiveTool(child.tool)
  }

  const startDrag = (event: React.DragEvent, tool: ToolKind, child?: MenuChild) => {
    if (tool === 'wire' || tool === 'select' || tool === 'pan') return
    if (child) updatePlacementOptions(child.tool, child.options)
    event.dataTransfer.setData('application/x-breadboard-component', tool)
    event.dataTransfer.effectAllowed = 'copy'
    setActiveTool(tool)
  }

  return (
    <aside className="palette panel palette-menu" aria-label="元器件库">
      <div className="parts-list">
        {directItems.map(({ kind, label, glyph }, index) => (
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
            <span className="part-icon"><CircuitGlyph kind={glyph} /></span>
            <span className="part-copy"><strong>{label}</strong></span>
            <span className="part-grip" aria-hidden="true">••</span>
          </button>
        ))}

        {menus.map(({ id, label, glyph, children }, menuIndex) => {
          const expanded = openMenu === id
          const active = children.some(childIsActive)
          return (
            <div className={`parts-menu ${expanded ? 'is-open' : ''} ${active ? 'is-active' : ''}`} key={id}>
              <button
                type="button"
                className="part-card part-menu-trigger"
                aria-expanded={expanded}
                aria-controls={`parts-submenu-${id}`}
                onClick={() => setOpenMenu(expanded ? null : id)}
                style={{ '--delay': `${(menuIndex + directItems.length) * 35}ms` } as React.CSSProperties}
                data-testid={`part-menu-${id}`}
              >
                <span className="part-icon"><CircuitGlyph kind={glyph} /></span>
                <span className="part-copy"><strong>{label}</strong></span>
                <ChevronDown className="menu-chevron" size={15} aria-hidden="true" />
              </button>

              {expanded ? (
                <div className="part-sublist" id={`parts-submenu-${id}`} role="group" aria-label={`${label}类型`}>
                  {children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className={`part-subitem ${childIsActive(child) ? 'is-active' : ''}`}
                      draggable
                      onDragStart={(event) => startDrag(event, child.tool, child)}
                      onClick={() => chooseChild(child)}
                      data-testid={`part-${id}-${child.id}`}
                    >
                      <span className="subitem-mark" style={child.accent ? { '--subitem-accent': child.accent } as React.CSSProperties : undefined}><CircuitGlyph kind={child.glyph} color={child.glyphColor} /></span>
                      <span><strong>{child.label}</strong></span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
