import {
  ChevronDown, Cloud, FilePlus2, FolderOpen, Moon, Pause, Play, Redo2,
  RotateCcw, Save, Sun, Undo2,
} from 'lucide-react'
import logoUrl from '../../imgs/logo.svg'
import { useWorkbenchStore } from '@/store/useWorkbenchStore'

interface Props {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  saving: boolean
  cloudEnabled: boolean
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function Toolbar({ onNew, onOpen, onSave, onSaveAs, saving, cloudEnabled, theme, onToggleTheme }: Props) {
  const document = useWorkbenchStore((state) => state.document)
  const projectId = useWorkbenchStore((state) => state.projectId)
  const dirty = useWorkbenchStore((state) => state.dirty)
  const past = useWorkbenchStore((state) => state.past)
  const future = useWorkbenchStore((state) => state.future)
  const undo = useWorkbenchStore((state) => state.undo)
  const redo = useWorkbenchStore((state) => state.redo)
  const running = useWorkbenchStore((state) => state.running)
  const toggleRunning = useWorkbenchStore((state) => state.toggleRunning)
  const status = useWorkbenchStore((state) => state.simulationStatus)

  return (
    <header className="toolbar">
      <div className="brand-block">
        <img className="brand-logo" src={logoUrl} alt="CyCore logo" />
        <div>
          <div className="brand-name">CYCORE <em>BREADBOARD</em></div>
          <div className="brand-subtitle">INTERACTIVE CIRCUIT LAB</div>
        </div>
      </div>

      <div className={`project-title-wrap ${cloudEnabled ? '' : 'is-guest'}`}>
        <span className={`save-dot ${dirty ? 'is-dirty' : ''}`} />
        <div>
          <strong>{document.projectName}</strong>
          <small>{cloudEnabled
            ? `${projectId ? `云端项目 #${projectId}` : '本地草稿'} · ${dirty ? '有未保存更改' : '已保存'}`
            : `访客模式 · ${dirty ? '本地草稿已自动恢复' : '仅限本地仿真'}`}</small>
        </div>
        <ChevronDown size={15} />
      </div>

      <nav className="tool-actions" aria-label="项目操作">
        <div className="tool-cluster">
          <button type="button" className="icon-button" onClick={onNew} title="新建"><FilePlus2 size={17} /></button>
          <button type="button" className="icon-button" onClick={onOpen} disabled={!cloudEnabled} title={cloudEnabled ? '打开' : '访客模式不能打开云项目'}><FolderOpen size={17} /></button>
          <button type="button" className="icon-button" onClick={onSave} disabled={saving || !cloudEnabled} title={cloudEnabled ? '保存' : '访客模式不能保存云项目'}><Save size={17} /></button>
          <button type="button" className="text-button" onClick={onSaveAs} disabled={saving || !cloudEnabled} title={cloudEnabled ? '另存' : '访客模式不能另存到云端'}>另存</button>
        </div>
        <div className="tool-cluster">
          <button type="button" className="icon-button" onClick={undo} disabled={!past.length} title="撤销"><Undo2 size={17} /></button>
          <button type="button" className="icon-button" onClick={redo} disabled={!future.length} title="重做"><Redo2 size={17} /></button>
        </div>
        <button type="button" className={`run-button ${running ? 'is-running' : ''}`} onClick={toggleRunning}>
          {running ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          {running ? '暂停仿真' : '运行仿真'}
        </button>
      </nav>

      <div className="toolbar-status">
        <div className={`engine-pill status-${status}`} title="CircuitJS 求解器状态">
          {status === 'running' || status === 'ready' ? <Cloud size={14} /> : <RotateCcw size={14} />}
          <span>{status === 'running' ? '实时求解' : status === 'ready' ? '求解器就绪' : status === 'paused' ? '已暂停' : status === 'offline' ? '求解器离线' : status === 'error' ? '电路异常' : '正在连接'}</span>
        </div>
        <button
          type="button"
          className="theme-button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          aria-pressed={theme === 'dark'}
          title={theme === 'dark' ? '当前为深色模式，点击切换到浅色模式' : '当前为浅色模式，点击切换到深色模式'}
        >
          {theme === 'dark' ? <Moon size={22} fill="currentColor" /> : <Sun size={22} fill="currentColor" />}
        </button>
      </div>
    </header>
  )
}
