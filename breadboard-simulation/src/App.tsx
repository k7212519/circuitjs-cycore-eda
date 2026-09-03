import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { BreadboardCanvas } from '@/components/BreadboardCanvas'
import { Inspector } from '@/components/Inspector'
import { Palette } from '@/components/Palette'
import { ProjectDialog } from '@/components/ProjectDialog'
import { Toolbar } from '@/components/Toolbar'
import { parseDocument, serializeDocument } from '@/domain/document'
import { projectApi } from '@/services/api'
import { ensureAuthenticated, type AccessMode } from '@/services/auth'
import { CircuitJsEngine } from '@/services/CircuitJsEngine'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

const DRAFT_KEY = 'cycore_breadboard_draft_v1'
const THEME_KEY = 'darkMode'
type Theme = 'dark' | 'light'

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem(THEME_KEY) === 'false' ? 'light' : 'dark')
  const [authReady, setAuthReady] = useState(false)
  const [accessMode, setAccessMode] = useState<AccessMode>('guest')
  const [dialog, setDialog] = useState<'open' | 'saveAs' | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  const [fullscreenSnapshot, setFullscreenSnapshot] = useState<{ left: boolean; right: boolean } | null>(null)
  const canvasFullscreen = fullscreenSnapshot !== null
  const queryClient = useQueryClient()

  const toggleCanvasFullscreen = useCallback(() => {
    if (fullscreenSnapshot) {
      setLeftSidebarCollapsed(fullscreenSnapshot.left)
      setRightSidebarCollapsed(fullscreenSnapshot.right)
      setFullscreenSnapshot(null)
    } else {
      setFullscreenSnapshot({ left: leftSidebarCollapsed, right: rightSidebarCollapsed })
      setLeftSidebarCollapsed(true)
      setRightSidebarCollapsed(true)
    }
  }, [fullscreenSnapshot, leftSidebarCollapsed, rightSidebarCollapsed])

  const document = useWorkbenchStore((state) => state.document)
  const projectId = useWorkbenchStore((state) => state.projectId)
  const running = useWorkbenchStore((state) => state.running)
  const closedContacts = useWorkbenchStore((state) => state.closedContacts)
  const newProject = useWorkbenchStore((state) => state.newProject)
  const loadProject = useWorkbenchStore((state) => state.loadProject)
  const setProjectIdentity = useWorkbenchStore((state) => state.setProjectIdentity)
  const markSaved = useWorkbenchStore((state) => state.markSaved)
  const setReadings = useWorkbenchStore((state) => state.setReadings)
  const setSimulationStatus = useWorkbenchStore((state) => state.setSimulationStatus)
  const deleteSelected = useWorkbenchStore((state) => state.deleteSelected)
  const undo = useWorkbenchStore((state) => state.undo)
  const redo = useWorkbenchStore((state) => state.redo)
  const setActiveTool = useWorkbenchStore((state) => state.setActiveTool)

  useEffect(() => {
    const isDark = theme === 'dark'
    globalThis.document.documentElement.dataset.theme = theme
    globalThis.document.body.classList.toggle('dark-mode', isDark)
    globalThis.document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#171a18' : '#f4f3ea')
    localStorage.setItem(THEME_KEY, String(isDark))
  }, [theme])

  const saveMutation = useMutation({
    mutationFn: async ({ saveAsName }: { saveAsName?: string }) => {
      if (saveAsName || !projectId) {
        const name = saveAsName || document.projectName
        const response = await projectApi.create(name, { ...document, projectName: name })
        setProjectIdentity(response.projectId, response.projectName)
        return response
      }
      return projectApi.update(projectId, document.projectName, document)
    },
    onSuccess: () => {
      markSaved()
      localStorage.removeItem(DRAFT_KEY)
      queryClient.invalidateQueries({ queryKey: ['breadboard-projects'] })
      setToast({ kind: 'ok', message: '项目已安全保存到云端' })
    },
    onError: (cause) => setToast({ kind: 'error', message: cause instanceof Error ? cause.message : '保存失败' }),
  })

  useEffect(() => {
    ensureAuthenticated().then((mode) => {
      setAccessMode(mode)
      setAuthReady(true)
    }).catch((cause) => {
      if (!String(cause).includes('REDIRECT')) {
        setAccessMode('guest')
        setAuthReady(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!authReady) return
    const draft = localStorage.getItem(DRAFT_KEY)
    if (!draft) return
    try {
      const parsed = JSON.parse(draft) as { projectId: number | null; document: unknown }
      loadProject(parsed.projectId ?? 0, parseDocument(parsed.document))
      if (!parsed.projectId) useWorkbenchStore.setState({ projectId: null })
      useWorkbenchStore.setState({ dirty: true })
      queueMicrotask(() => setToast({ kind: 'ok', message: '已恢复上次未保存的本地草稿' }))
    } catch {
      localStorage.removeItem(DRAFT_KEY)
    }
  }, [authReady, loadProject])

  useEffect(() => {
    if (!authReady) return
    const timer = window.setTimeout(() => {
      const state = useWorkbenchStore.getState()
      if (state.dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify({ projectId: state.projectId, document: JSON.parse(serializeDocument(state.document)) }))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [authReady, document])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches('input, textarea')) return
      if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected()
      if (event.key === 'Escape') {
        setActiveTool('select')
        if (canvasFullscreen) toggleCanvasFullscreen()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (accessMode === 'guest') setToast({ kind: 'error', message: '访客模式不能保存云项目，本地恢复草稿会自动保留' })
        else if (projectId) saveMutation.mutate({})
        else setDialog('saveAs')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [accessMode, canvasFullscreen, deleteSelected, projectId, redo, saveMutation, setActiveTool, toggleCanvasFullscreen, undo])

  if (!authReady) {
    return <div className="boot-screen"><span className="brand-mark large"><span>+</span><span>−</span></span><LoaderCircle className="spin" /><strong>正在准备面包板实验台…</strong></div>
  }

  const requestNew = () => {
    if (!useWorkbenchStore.getState().dirty || window.confirm('新建项目会清空当前画布，未保存更改仍可从本地草稿恢复。继续吗？')) newProject()
  }

  return (
    <div className={`app-shell ${canvasFullscreen ? 'is-canvas-fullscreen' : ''}`}>
      <Toolbar
        onNew={requestNew}
        onOpen={() => setDialog('open')}
        onSave={() => projectId ? saveMutation.mutate({}) : setDialog('saveAs')}
        onSaveAs={() => setDialog('saveAs')}
        saving={saveMutation.isPending}
        cloudEnabled={accessMode === 'authenticated'}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      />
      <div className={`workspace-grid ${leftSidebarCollapsed ? 'is-left-collapsed' : ''} ${rightSidebarCollapsed ? 'is-right-collapsed' : ''}`}>
        <Palette />
        <BreadboardCanvas isFullscreen={canvasFullscreen} onToggleFullscreen={toggleCanvasFullscreen} />
        <Inspector />
        <button
          type="button"
          className="sidebar-toggle sidebar-toggle-left"
          aria-label={leftSidebarCollapsed ? '展开元器件栏' : '折叠元器件栏'}
          title={leftSidebarCollapsed ? '展开元器件栏' : '折叠元器件栏'}
          onClick={() => setLeftSidebarCollapsed((collapsed) => !collapsed)}
        >
          {leftSidebarCollapsed ? <ChevronRight size={21} /> : <ChevronLeft size={21} />}
        </button>
        <button
          type="button"
          className="sidebar-toggle sidebar-toggle-right"
          aria-label={rightSidebarCollapsed ? '展开属性栏' : '折叠属性栏'}
          title={rightSidebarCollapsed ? '展开属性栏' : '折叠属性栏'}
          onClick={() => setRightSidebarCollapsed((collapsed) => !collapsed)}
        >
          {rightSidebarCollapsed ? <ChevronLeft size={21} /> : <ChevronRight size={21} />}
        </button>
      </div>

      <CircuitJsEngine document={document} closedContacts={closedContacts} running={running} onReadings={setReadings} onStatus={setSimulationStatus} />

      {dialog ? (
        <ProjectDialog
          mode={dialog}
          currentName={document.projectName}
          onClose={() => setDialog(null)}
          onOpen={loadProject}
          onSaveAs={(name) => saveMutation.mutateAsync({ saveAsName: name }).then(() => undefined)}
        />
      ) : null}
      {toast ? <div className={`toast toast-${toast.kind}`}>{toast.kind === 'ok' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}{toast.message}</div> : null}
    </div>
  )
}
