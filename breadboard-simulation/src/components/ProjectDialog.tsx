import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cloud, FolderOpen, LoaderCircle, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { parseDocument } from '@/domain/document'
import { projectApi } from '@/services/api'

interface Props {
  mode: 'open' | 'saveAs'
  currentName: string
  onClose: () => void
  onOpen: (projectId: number, document: unknown) => void
  onSaveAs: (name: string) => Promise<void>
}

export function ProjectDialog({ mode, currentName, onClose, onOpen, onSaveAs }: Props) {
  const [name, setName] = useState(currentName === '未命名实验' ? '' : `${currentName} 副本`)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const projects = useQuery({
    queryKey: ['breadboard-projects'],
    queryFn: () => projectApi.list(),
    enabled: mode === 'open',
  })
  const remove = useMutation({
    mutationFn: projectApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breadboard-projects'] }),
  })

  const openProject = async (projectId: number) => {
    try {
      const detail = await projectApi.get(projectId)
      onOpen(projectId, parseDocument(detail.projectData))
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '项目读取失败')
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('请输入项目名称'); return }
    try {
      await onSaveAs(trimmed)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '项目保存失败')
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title">
        <header>
          <div>
            <span className="eyebrow">CLOUD PROJECTS</span>
            <h2 id="project-dialog-title">{mode === 'open' ? '打开面包板项目' : '另存为新项目'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={19} /></button>
        </header>

        {mode === 'saveAs' ? (
          <form className="save-form" onSubmit={save}>
            <Cloud size={38} strokeWidth={1.25} />
            <label>
              <span>项目名称</span>
              <input autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：LED 限流实验" />
            </label>
            <p>项目会保存到当前 L1 账户，仅你本人可以访问。</p>
            <button type="submit" className="primary-button">保存到云端</button>
          </form>
        ) : (
          <div className="project-list">
            {projects.isLoading ? <div className="loading-state"><LoaderCircle className="spin" />正在读取项目…</div> : null}
            {projects.data?.records.map((project) => (
              <article className="project-row" key={project.projectId}>
                <button type="button" className="project-open" onClick={() => openProject(project.projectId)}>
                  <span className="project-file-icon"><FolderOpen size={19} /></span>
                  <span><strong>{project.projectName}</strong><small>更新于 {new Date(project.updateTime ?? project.createTime).toLocaleString('zh-CN')}</small></span>
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  title="删除项目"
                  onClick={() => { if (window.confirm(`确定删除“${project.projectName}”吗？`)) remove.mutate(project.projectId) }}
                ><Trash2 size={16} /></button>
              </article>
            ))}
            {!projects.isLoading && !projects.data?.records.length ? <div className="empty-projects">还没有云端项目，先搭建一块电路吧。</div> : null}
          </div>
        )}
        {(error || projects.error) ? <div className="dialog-error">{error || (projects.error as Error)?.message}</div> : null}
      </section>
    </div>
  )
}
